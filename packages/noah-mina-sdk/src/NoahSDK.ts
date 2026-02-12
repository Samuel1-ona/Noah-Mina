/**
 * NoahSDK — High-Level SDK for Privacy-Preserving KYC on Mina
 *
 * The main entry point for developers integrating Noah-Mina KYC.
 * Wraps the smart contract, credential system, and attestation
 * into a clean, easy-to-use API.
 *
 * Usage:
 *   import { NoahSDK } from 'noah-mina-sdk';
 *
 *   const sdk = await NoahSDK.init({ network: 'local' });
 *   const credential = await sdk.issueCredential(owner, document);
 *   const presentation = await sdk.proveAge(credential, 18);
 *   const result = await sdk.registerKYC(commitment, issuerHash);
 */
import {
    Mina,
    PrivateKey,
    PublicKey,
    Field,
    UInt64,
    AccountUpdate,
    Poseidon,
    fetchAccount,
    Signature,
    Scalar,
    Transaction,
} from 'o1js';
import {
    Presentation,
    PresentationRequest,
} from 'mina-attestations';
import type { StoredCredential } from 'mina-attestations';
import {
    NoahKYCRegistry,
    KYCRecord,
    offchainState,
    StateProof,
} from './contracts/NoahKYCRegistry.js';
import {
    AgeVerificationSpec,
    NationalityExclusionSpec,
    String64,
    String128,
    computeCommitment,
} from './credentials/NoahCredential.js';
import {
    NoahAttester,
    type IdentityDocument,
    type AttestationResult,
} from './attester/NoahAttester.js';

// ============================================================
// Types
// ============================================================

export interface NoahConfig {
    /** Network: 'local' for local blockchain, or a GraphQL endpoint URL */
    network: 'local' | string;
    /** Optional Archive Node URL (needed for some state queries) */
    archiveUrl?: string;
    /** Private key of the fee payer (for signing transactions) */
    feePayerKey?: PrivateKey;
    /** Pre-deployed contract address (if not deploying new) */
    contractAddress?: PublicKey;
    /** Private key for the attester (issuer) */
    attesterKey?: PrivateKey;
}

export interface TransactionResult {
    success: boolean;
    hash?: string;
    error?: string;
    pendingTx?: Mina.PendingTransaction;
}

export interface VerificationResult {
    valid: boolean;
    issuerHash?: Field;
    error?: string;
}

// ============================================================
// SDK Class
// ============================================================

export class NoahSDK {
    /** The KYC registry contract instance */
    public contract: NoahKYCRegistry;
    /** The attester (credential issuer) */
    public attester: NoahAttester;
    /** The contract private key (needed for deployment signing) */
    public contractKey: PrivateKey;

    private feePayerKey: PrivateKey;
    private contractAddress: PublicKey;
    private isLocal: boolean;

    /** Get the fee payer's public key (in local mode, this is the user's address) */
    get feePayerPublicKey(): PublicKey | undefined {
        if (this.feePayerKey) return this.feePayerKey.toPublicKey();
        return undefined;
    }

    /** Get the fee payer's private key (needed for signing presentations in local mode) */
    get feePayerPrivateKey(): PrivateKey {
        return this.feePayerKey;
    }

    private constructor(
        contract: NoahKYCRegistry,
        attester: NoahAttester,
        feePayerKey: PrivateKey | undefined,
        contractAddress: PublicKey,
        contractKey: PrivateKey,
        isLocal: boolean
    ) {
        this.contract = contract;
        this.attester = attester;
        // @ts-ignore
        this.feePayerKey = feePayerKey;
        this.contractAddress = contractAddress;
        this.contractKey = contractKey;
        this.isLocal = isLocal;
    }

    // --- Initialization ---

    /**
     * Initialize the SDK. This handles:
     * - Setting up the Mina network instance
     * - Compiling the offchain state program
     * - Compiling the smart contract
     * - Connecting to an existing contract or preparing for deployment
     */
    static async init(config: {
        network: 'local' | string;
        archiveUrl?: string;
        contractAddress?: PublicKey;
        attesterKey?: PrivateKey;
        feePayerKey?: PrivateKey;
    }): Promise<NoahSDK> {
        let feePayerKey: PrivateKey | undefined = config.feePayerKey;
        let isLocal = false;

        // Set up network
        if (config.network === 'local') {
            let localBlockchain: any;
            let attempts = 0;
            const maxAttempts = 5;

            while (attempts < maxAttempts) {
                localBlockchain = await Mina.LocalBlockchain({
                    proofsEnabled: false,
                });
                Mina.setActiveInstance(localBlockchain);

                // Use first test account as fee payer
                // o1js v2 often uses .privateKey, v1 used .key
                const account0 = localBlockchain.testAccounts[0] as any;
                feePayerKey = config.feePayerKey ?? (account0?.privateKey || account0?.key);

                if (feePayerKey) break;

                console.warn(`[NoahSDK] Attempt ${attempts + 1}: testAccounts[0] not ready. Retrying in 500ms...`);
                await new Promise((resolve) => setTimeout(resolve, 500));
                attempts++;
            }

            if (!feePayerKey) {
                const account0 = localBlockchain?.testAccounts?.[0];
                console.error('[NoahSDK] Failed to resolve feePayerKey from localBlockchain.testAccounts[0]');
                if (account0) {
                    console.log('[NoahSDK] Account0 structure:', Object.keys(account0));
                } else {
                    console.log('[NoahSDK] testAccounts is empty or undefined');
                }
                throw new Error('Fee payer key not found in local test accounts after retries');
            }

            isLocal = true;
        } else {
            const network = Mina.Network({
                mina: config.network,
                archive: config.archiveUrl,
            });
            Mina.setActiveInstance(network);
            if (config.feePayerKey) {
                feePayerKey = config.feePayerKey;
                // Fetch fee payer account to avoid 'account not found' errors
                try {
                    await fetchAccount({ publicKey: feePayerKey.toPublicKey() });
                } catch (e) {
                    console.warn('[NoahSDK] Could not fetch fee payer account:', e);
                }
            } else {
                console.warn('[NoahSDK] No Fee Payer Key provided. Using wallet injection mode.');
            }
        }

        // Set up contract
        const contractKey = PrivateKey.random();
        const contractAddress =
            config.contractAddress ?? contractKey.toPublicKey();
        const contract = new NoahKYCRegistry(contractAddress);

        // Set up offchain state
        contract.offchainState.setContractInstance(contract);

        // Set up attester
        const attester = config.attesterKey
            ? new NoahAttester(config.attesterKey)
            : NoahAttester.createRandom();

        if (!isLocal && config.contractAddress) {
            try {
                await fetchAccount({ publicKey: config.contractAddress });
            } catch (e) {
                console.warn('[NoahSDK] Could not fetch contract account (might not be deployed yet)', e);
            }
        }

        return new NoahSDK(
            contract,
            attester,
            feePayerKey!,
            contractAddress,
            contractKey,
            isLocal
        );
    }

    /**
     * Compile the contract and offchain state programs.
     * Required before sending any transactions (when proofs are enabled).
     */
    async compile(): Promise<void> {
        console.log('[NoahSDK] Compiling offchain state program...');
        await offchainState.compile();
        console.log('[NoahSDK] Compiling NoahKYCRegistry contract...');
        await NoahKYCRegistry.compile();
        console.log('[NoahSDK] Compilation complete.');
    }

    /**
     * Deploy the KYC registry contract.
     * Only needed once — subsequent interactions use the deployed address.
     * Uses the internally stored contract key by default.
     */
    async deploy(contractKey?: PrivateKey): Promise<TransactionResult> {
        try {
            const key = contractKey ?? this.contractKey;
            const sender = this.feePayerKey.toPublicKey();

            const tx = await Mina.transaction(
                { sender, fee: 0.1e9 },
                async () => {
                    AccountUpdate.fundNewAccount(sender);
                    await this.contract.deploy();
                }
            );
            await tx.prove();
            await tx.sign([this.feePayerKey, key]).send();

            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    // --- Attester (Issuer) ---

    /**
     * Issue a KYC credential to a user.
     *
     * The attester validates the document data (from OCR) and signs
     * a Native credential using their Mina private key.
     *
     * @param owner - The user's Mina public key
     * @param document - Identity data extracted via OCR
     * @returns Signed credential and issuer public key
     */
    async issueCredential(
        owner: PublicKey,
        document: IdentityDocument
    ): Promise<AttestationResult> {
        return this.attester.issueCredential(owner, document);
    }

    // --- User (Presentation / ZK Proof) ---

    /**
     * Generate a ZK proof that the user is at least `minAge` years old.
     * This runs client-side — the user's identity data never leaves their browser.
     *
     * @param credential - The user's signed KYC credential
     * @param ownerKey - The user's private key (for signing the presentation)
     * @param minAge - Minimum age in years
     * @returns A Presentation (ZK proof) that can be verified
     */
    async proveAge(
        credential: StoredCredential,
        minAge: number
    ): Promise<any> {
        console.log('[NoahSDK] version: 2026-02-11T13:05 - proveAge started', { minAge });

        try {
            // HYDRATION STEP: Restore Credential from plain JSON if needed
            // The frontend passes a plain object where BigInts might be strings
            const hydratedCredential = this.hydrateCredential(credential);

            const now = new Date();
            const yyyy = now.getFullYear();
            const mm = now.getMonth() + 1;
            const dd = now.getDate();
            const dateVal = yyyy * 10000 + mm * 100 + dd;

            console.log('[NoahSDK] currentDate inputs:', { yyyy, mm, dd, dateVal });

            if (isNaN(dateVal)) {
                throw new Error(`Invalid current date calculation: ${dateVal}`);
            }

            const currentDate = UInt64.from(dateVal);

            console.log('[NoahSDK] minAge:', minAge, 'type:', typeof minAge);
            if (isNaN(minAge)) {
                throw new Error(`Invalid minAge: ${minAge}`);
            }
            const minAgeScaled = minAge * 10000;
            console.log('[NoahSDK] minAgeScaled:', minAgeScaled, 'type:', typeof minAgeScaled);

            const minAgeDelta = UInt64.from(minAgeScaled);
            console.log('[NoahSDK] currentDate:', currentDate.toString());

            const request = PresentationRequest.noContext(AgeVerificationSpec, {
                currentDate,
                minAgeDelta,
            });

            console.log('[NoahSDK] Compiling presentation request...');
            const compiled = await Presentation.compile(request);

            console.log('[NoahSDK] Creating presentation...');
            let presentation;

            if (this.feePayerKey) {
                // Server/Local mode with private key
                presentation = await Presentation.create(this.feePayerKey, {
                    request: compiled,
                    credentials: [hydratedCredential],
                    context: undefined,
                });
            } else {
                // Browser Wallet mode
                const prepared = await Presentation.prepare({
                    request: compiled,
                    credentials: [hydratedCredential],
                    context: undefined,
                });

                const mina = (window as any).mina;
                if (!mina) throw new Error('No wallet found');

                console.log('[NoahSDK] Requesting signature from wallet...');
                const { signature } = await mina.signFields({
                    message: prepared.messageFields,
                });
                console.log('[NoahSDK] Wallet signature response:', signature);

                // Handle both string (Base58) and object signature formats
                let ownerSignature;
                if (typeof signature === 'string') {
                    ownerSignature = Signature.fromBase58(signature);
                } else {
                    ownerSignature = Signature.fromObject({
                        r: Field(signature.field),
                        s: Scalar.from(BigInt(signature.scalar)),
                    });
                }

                presentation = await Presentation.finalize(
                    compiled,
                    ownerSignature,
                    prepared
                );
            }

            console.log('[NoahSDK] Presentation created successfully');
            return presentation;
        } catch (error: any) {
            console.error('[NoahSDK] Error in proveAge:', error);
            throw error;
        }
    }

    /**
     * Helper to restore a Credential object from a plain JSON object.
     * Often needed because BigInts/UInt64s become strings/numbers over JSON.
     */
    /**
     * Helper to restore a Credential object from a plain JSON object.
     * Often needed because BigInts/UInt64s become strings/numbers over JSON.
     */
    private hydrateCredential(raw: any): any {
        // If it's already got the right methods/structure, return it
        if (!raw || typeof raw !== 'object') return raw;

        const data = raw.data || {};

        // Helper to safely convert any value to UInt64
        const safeUInt64 = (val: any): UInt64 => {
            let v = val;
            // Unwrap object if needed
            if (v && typeof v === 'object' && v.value !== undefined) v = v.value;

            // Handle primitives
            if (v === null || v === undefined) return UInt64.from(0);

            if (typeof v === 'number') {
                return UInt64.from(isNaN(v) ? 0 : v);
            }

            if (typeof v === 'string') {
                // Try parsing string to number first
                const n = Number(v);
                if (!isNaN(n)) return UInt64.from(n);
                // Fallback: try ignoring it or return 0
                return UInt64.from(0);
            }

            return UInt64.from(0);
        };

        // Helper for strings
        const safeString = (val: any): string => {
            if (val === null || val === undefined) return '';
            let v = val;
            if (typeof v === 'object' && v.value !== undefined) v = v.value;
            return String(v);
        };

        // Re-construct the data fields with correct types
        console.log('[NoahSDK] Hydrating credential data (SAFE):', data);

        const hydratedData = {
            fullName: String128.from(safeString(data.fullName)),
            dateOfBirth: safeUInt64(data.dateOfBirth),
            nationality: String64.from(safeString(data.nationality)),
            documentType: String64.from(safeString(data.documentType)),
            expiresAt: safeUInt64(data.expiresAt),
        };

        let signature = raw.signature;
        if (signature && typeof signature === 'object') {
            try {
                // Try to hydrate signature if it's not already an instance
                if (!(signature instanceof Signature)) {
                    // Robust way: check if it has r/s and convert
                    const r = signature.r?.value?.[0]?.[1] ?? signature.r;
                    const s = signature.s?.value?.[0]?.[1] ?? signature.s;

                    if (r && s) {
                        signature = Signature.fromJSON({ r, s });
                    }
                }
            } catch (e) {
                console.warn('[NoahSDK] Failed to hydrate signature, using raw', e);
            }
        }

        return {
            ...raw,
            data: hydratedData,
            signature
        };
    }

    /**
     * Generate a ZK proof that the user is NOT from an excluded nationality.
     *
     * @param credential - The user's signed KYC credential
     * @param ownerKey - The user's private key
     * @param excludedNationality - The nationality to prove you are NOT from
     * @returns A Presentation (ZK proof)
     */
    async proveNationality(
        credential: StoredCredential,
        ownerKey: PrivateKey,
        excludedNationality: string
    ): Promise<any> {
        const now = new Date();
        const currentDate = UInt64.from(
            now.getFullYear() * 10000 +
            (now.getMonth() + 1) * 100 +
            now.getDate()
        );

        const request = PresentationRequest.noContext(NationalityExclusionSpec, {
            currentDate,
            excludedNationality: String64.from(excludedNationality),
        });

        const compiled = await Presentation.compile(request);
        const presentation = await Presentation.create(ownerKey, {
            request: compiled,
            credentials: [credential],
            context: undefined,
        });

        return presentation;
    }

    // --- Verifier ---

    /**
     * Verify an age verification presentation.
     */
    async verifyAgeProof(
        presentation: any,
        minAge: number
    ): Promise<VerificationResult> {
        try {
            const now = new Date();
            const currentDate = UInt64.from(
                now.getFullYear() * 10000 +
                (now.getMonth() + 1) * 100 +
                now.getDate()
            );
            const minAgeDelta = UInt64.from(minAge * 10000);

            const request = PresentationRequest.noContext(AgeVerificationSpec, {
                currentDate,
                minAgeDelta,
            });

            const output = await Presentation.verify(
                request,
                presentation,
                undefined
            );

            return { valid: true, issuerHash: output as Field };
        } catch (error: any) {
            return { valid: false, error: error.message };
        }
    }

    // --- On-Chain Registry ---

    /**
     * Register a user's KYC commitment on-chain.
     *
     * @param commitment - Poseidon hash of the user's identity data
     * @param issuerHash - Hash of the attester's public key
     */
    async getSender(): Promise<PublicKey> {
        if (this.feePayerKey) {
            return this.feePayerKey.toPublicKey();
        } else {
            // Browser wallet support
            const mina = (window as any).mina;
            if (!mina) throw new Error('No wallet found (window.mina missing)');
            const accounts = await mina.requestAccounts();
            if (accounts.length === 0) throw new Error('No accounts connected');
            return PublicKey.fromBase58(accounts[0]);
        }
    }

    /**
     * Register a user's KYC commitment on-chain.
     *
     * @param commitment - Poseidon hash of the user's identity data
     * @param issuerHash - Hash of the attester's public key
     */
    async registerKYC(
        commitment: Field,
        issuerHash: Field
    ): Promise<TransactionResult> {
        try {
            const sender = await this.getSender();

            const tx = await Mina.transaction(
                { sender, fee: 0.1e9 },
                async () => {
                    await this.contract.registerKYC(commitment, issuerHash);
                }
            );
            await tx.prove();

            let pendingTx;
            let hash;

            if (this.feePayerKey) {
                pendingTx = await tx.sign([this.feePayerKey]).send();
                hash = pendingTx.hash;
            } else {
                // Browser wallet signing
                const transactionJSON = tx.toJSON();
                const response = await (window as any).mina.sendTransaction({
                    transaction: transactionJSON,
                    feePayer: {
                        fee: 0.1e9,
                        memo: '',
                    },
                });
                hash = response.hash;
            }

            return { success: true, pendingTx, hash };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Revoke a user's KYC (admin only).
     *
     * @param user - Public key of the user to revoke
     */
    async revokeKYC(user: PublicKey): Promise<TransactionResult> {
        try {
            const sender = await this.getSender();

            const tx = await Mina.transaction(
                { sender, fee: 0.1e9 },
                async () => {
                    await this.contract.revokeKYC(user);
                }
            );
            await tx.prove();

            let pendingTx;
            let hash;

            if (this.feePayerKey) {
                pendingTx = await tx.sign([this.feePayerKey]).send();
                hash = pendingTx.hash;
            } else {
                // Browser wallet signing
                const transactionJSON = tx.toJSON();
                const response = await (window as any).mina.sendTransaction({
                    transaction: transactionJSON,
                    feePayer: {
                        fee: 0.1e9,
                        memo: '',
                    },
                });
                hash = response.hash;
            }

            return { success: true, pendingTx, hash };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Settle all pending offchain state changes.
     * Must be called after registerKYC/revokeKYC to finalize state updates.
     */
    async settleState(): Promise<TransactionResult> {
        try {
            const sender = await this.getSender();
            console.log('[NoahSDK] Creating settlement proof...');
            const proof = await this.contract.offchainState.createSettlementProof();
            console.log('[NoahSDK] Settlement proof created.');

            const tx = await Mina.transaction(
                { sender, fee: 0.1e9 },
                async () => {
                    await this.contract.settle(proof);
                }
            );
            await tx.prove();

            let pendingTx;
            let hash;

            if (this.feePayerKey) {
                pendingTx = await tx.sign([this.feePayerKey]).send();
                hash = pendingTx.hash;
            } else {
                // Browser wallet signing
                const transactionJSON = tx.toJSON();
                const response = await (window as any).mina.sendTransaction({
                    transaction: transactionJSON,
                    feePayer: {
                        fee: 0.1e9,
                        memo: '',
                    },
                });
                hash = response.hash;
            }

            return { success: true, pendingTx, hash };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Query a user's KYC status from the offchain state.
     *
     * @param user - Public key of the user to query
     * @returns The KYC record, or null if not found
     */
    async getKYCStatus(user: PublicKey): Promise<KYCRecord | null> {
        try {
            const recordOption =
                await this.contract.offchainState.fields.kycRecords.get(user);
            const record = recordOption.orElse(KYCRecord.empty());

            // If commitment is 0, user has no KYC record
            if (record.commitment.equals(Field(0)).toBoolean()) {
                return null;
            }

            return record;
        } catch {
            return null;
        }
    }

    /**
     * Check if a user has an active KYC record.
     */
    async hasActiveKYC(user: PublicKey): Promise<boolean> {
        const record = await this.getKYCStatus(user);
        return record !== null && record.isActive.toBoolean();
    }

    // --- Utilities ---

    /**
     * Compute the Poseidon commitment for identity data.
     * This is the value stored on-chain.
     */
    computeCommitment(
        fullNameHash: Field,
        dateOfBirth: number,
        nationalityHash: Field
    ): Field {
        return computeCommitment(
            fullNameHash,
            UInt64.from(dateOfBirth),
            nationalityHash
        );
    }

    /**
     * Get the issuer hash (Poseidon hash of attester's public key).
     */
    getIssuerHash(): Field {
        return Poseidon.hash(this.attester.issuerPublicKey.toFields());
    }
}
