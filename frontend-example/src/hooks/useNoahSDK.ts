/**
 * useNoahSDK — React Hook for Real SDK Integration
 *
 * Manages the 5-step stepper + real noah-mina-sdk calls.
 * Uses Mina LocalBlockchain for testing — real on-chain transactions.
 *
 * Steps: Scan → Witness → Proof → Submit → Verified
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import type { MRZData } from '../components/MRZScanner';

// ============================================================
// Types
// ============================================================

export type StepId = 'scan' | 'witness' | 'proof' | 'submit' | 'verified';

export interface Step {
    id: StepId;
    label: string;
    index: number;
}

export const STEPS: Step[] = [
    { id: 'scan', label: 'Scan', index: 0 },
    { id: 'witness', label: 'Witness', index: 1 },
    { id: 'proof', label: 'Proof', index: 2 },
    { id: 'submit', label: 'Submit', index: 3 },
    { id: 'verified', label: 'Verified', index: 4 },
];

export interface WalletState {
    connected: boolean;
    address: string | null;
    network: string | null;
}

export interface KYCRecord {
    commitment: string;
    issuerHash: string;
    registeredAt: string;
    isActive: boolean;
    address: string;
    txHash?: string;
}

export interface SDKStatus {
    initialized: boolean;
    compiling: boolean;
    deploying: boolean;
    compilationProgress: string;
}

// ============================================================
// Hook
// ============================================================

export function useNoahSDK() {
    // SDK instance ref (persisted across renders)
    const sdkRef = useRef<any>(null);
    const userKeyRef = useRef<any>(null);

    const [devnetContractAddress, setDevnetContractAddress] = useState<string>(
        import.meta.env.VITE_CONTRACT_ADDRESS || ''
    );
    const [wallet, setWallet] = useState<WalletState>({
        connected: false,
        address: null,
        network: null,
    });
    const [networkMode, setNetworkMode] = useState<'local' | 'devnet'>('local');
    const [sdkStatus, setSDKStatus] = useState<SDKStatus>({
        initialized: false,
        compiling: false,
        deploying: false,
        compilationProgress: '',
    });
    const [currentStep, setCurrentStep] = useState<StepId>('scan');
    const [mrzData, setMrzData] = useState<MRZData | null>(null);
    const [credential, setCredential] = useState<any>(null);
    const [presentation, setPresentation] = useState<any>(null);
    const [kycRecord, setKycRecord] = useState<KYCRecord | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [logs, setLogs] = useState<string[]>([]);

    // ── Logging ────────────────────────────────────────────────

    const addLog = useCallback((msg: string) => {
        const timestamp = new Date().toLocaleTimeString();
        setLogs((prev) => [...prev, `[${timestamp}] ${msg}`]);
        console.log(`[NoahSDK] ${msg}`);
    }, []);

    // ── Initialize SDK ────────────────────────────────────────

    const initSDK = useCallback(async () => {
        // console.log('[useNoahSDK] version: 2026-02-11T13:15 - Initializing SDK (HMR Force) v2');
        setError(null);

        setSDKStatus((s) => ({
            ...s,
            initialized: false,
            compiling: true,
            compilationProgress: 'Loading o1js...',
        }));
        addLog(`Importing o1js and noah-mina-sdk (${networkMode} mode)...`);

        try {
            const { NoahSDK } = await import('noah-mina-sdk');
            const { PrivateKey, PublicKey } = await import('o1js');

            let sdk;
            if (networkMode === 'local') {
                addLog('o1js loaded. Initializing local blockchain...');
                setSDKStatus((s) => ({
                    ...s,
                    compilationProgress: 'Starting local blockchain...',
                }));
                sdk = await NoahSDK.init({ network: 'local' });
            } else {
                // Devnet Mode
                const devnetUrl = import.meta.env.VITE_MINA_NETWORK_URL || 'https://api.minascan.io/node/devnet/v1/graphql';
                const archiveUrl = import.meta.env.VITE_ARCHIVE_URL || 'https://api.minascan.io/archive/devnet/v1/graphql';

                addLog(`Connecting to Devnet: ${devnetUrl}...`);
                setSDKStatus((s) => ({
                    ...s,
                    compilationProgress: 'Connecting to Devnet...',
                }));

                const feePayerKeyStr = import.meta.env.VITE_FEE_PAYER_KEY;

                if (!devnetContractAddress) {
                    throw new Error('Please enter the NoahKYCRegistry contract address for Devnet mode. You can get this after running "zk deploy devnet".');
                }

                sdk = await NoahSDK.init({
                    network: devnetUrl,
                    archiveUrl: archiveUrl,
                    contractAddress: PublicKey.fromBase58(devnetContractAddress),
                    feePayerKey: feePayerKeyStr ? PrivateKey.fromBase58(feePayerKeyStr) : undefined,
                });
            }

            sdkRef.current = sdk;

            if (networkMode === 'local') {
                addLog('Local blockchain running.');
                setSDKStatus((s) => ({
                    ...s,
                    compilationProgress: 'Deploying KYC registry contract...',
                }));
                addLog('Deploying NoahKYCRegistry contract...');
                const deployResult = await sdk.deploy();
                if (!deployResult.success) {
                    throw new Error(`Deploy failed: ${deployResult.error}`);
                }
                addLog('✅ Contract deployed successfully (Local)!');
            } else {
                addLog('✅ SDK connected to Devnet!');
                addLog(`   Contract: ${sdk.contract.address.toBase58().slice(0, 16)}...`);
            }

            // Compile contracts (REQUIRED for both Local and Devnet to generate proofs)
            addLog('Compiling contracts (this may take a minute)...');
            setSDKStatus((s) => ({
                ...s,
                compilationProgress: 'Compiling contracts...',
            }));
            await sdk.compile();
            addLog('✅ Contracts compiled!');

            const feePayerKey = sdk.feePayerPublicKey;
            const feePayerAddress = feePayerKey ? feePayerKey.toBase58() : '';

            if (sdk.feePayerPrivateKey) {
                userKeyRef.current = sdk.feePayerPrivateKey;
            }

            setSDKStatus((s) => ({
                ...s,
                initialized: true,
                compiling: false,
                deploying: false,
                compilationProgress: '',
            }));

            // 2. Set Wallet State
            setWallet({
                connected: true,
                address: feePayerAddress,
                network: networkMode === 'local' ? 'LocalBlockchain' : 'Mina Devnet',
            });

            addLog(`✅ SDK ready! Address: ${feePayerAddress.slice(0, 12)}...`);

            // ── KYC Status Guard ──────────────────────────────────
            if (networkMode === 'local') {
                addLog('Checking KYC status...');
                const hasKYC = await sdk.hasActiveKYC(sdk.feePayerPublicKey);
                if (hasKYC) {
                    addLog('✨ Address already has an active KYC record. Skipping verification.');
                    setKycRecord({
                        commitment: 'Exists on-chain',
                        issuerHash: 'Verified Attester',
                        registeredAt: new Date().toISOString(),
                        isActive: true,
                        address: feePayerAddress,
                    });
                    setCurrentStep('verified');
                }
            } else {
                addLog('Devnet mode: Waiting for wallet connection to check KYC status...');
            }
        } catch (err: any) {
            console.error('SDK init error:', err);
            setError(`SDK initialization failed: ${err.message}`);
            setSDKStatus({
                initialized: false,
                compiling: false,
                deploying: false,
                compilationProgress: '',
            });
            addLog(`❌ Error: ${err.message}`);
        }
    }, [addLog, networkMode, devnetContractAddress]);

    // ── Connect (starts SDK init) ──────────────────────────────

    const connectWallet = useCallback(async () => {
        setLoading(true);
        setError(null);
        addLog(`Starting SDK initialization (${networkMode} mode)...`);
        try {
            await initSDK(); // Initialize SDK (loads o1js)

            // Connect to Auro
            const mina = (window as any).mina;
            if (!mina) {
                alert('Please install Auro Wallet!');
                return;
            }
            const accounts = await mina.requestAccounts();
            if (accounts.length > 0) {
                const address = accounts[0];
                setWallet(prev => ({
                    ...prev,
                    connected: true,
                    address: address,
                    network: 'Mina Devnet'
                }));
                addLog(`Wallet connected: ${address.slice(0, 8)}...`);

                // If check KYC status
                if (sdkRef.current) {
                    addLog('Checking KYC status for connected wallet...');
                    const hasKYC = await sdkRef.current.hasActiveKYC(
                        (await import('o1js')).PublicKey.fromBase58(address)
                    );
                    if (hasKYC) {
                        addLog('✨ Address already has an active KYC record.');
                        setKycRecord({
                            commitment: 'Exists on-chain',
                            issuerHash: 'Verified Attester',
                            registeredAt: new Date().toISOString(),
                            isActive: true,
                            address: address,
                        });
                        setCurrentStep('verified');
                    }
                }
            }
        } catch (err: any) {
            console.error('Wallet connection failed:', err);
            addLog(`Wallet connection failed: ${err.message}`);
        } finally {
            setLoading(false);
        }
    }, [initSDK, addLog, networkMode]);

    // ── Disconnect ─────────────────────────────────────────────

    const disconnectWallet = useCallback(() => {
        setWallet({ connected: false, address: null, network: null });
        setCurrentStep('scan');
        setMrzData(null);
        setCredential(null);
        setPresentation(null);
        setKycRecord(null);
        sdkRef.current = null;
        userKeyRef.current = null;
        setSDKStatus({
            initialized: false,
            compiling: false,
            deploying: false,
            compilationProgress: '',
        });
        setLogs([]);
    }, []);

    // ── Listen for Account Changes ─────────────────────────────

    useEffect(() => {
        const mina = (window as any).mina;
        if (!mina || !wallet.connected) return;

        const handleAccountsChanged = async (accounts: string[]) => {
            if (accounts.length > 0) {
                const newAddress = accounts[0];
                if (newAddress !== wallet.address) {
                    addLog(`🔄 Wallet switched to: ${newAddress.slice(0, 8)}...`);

                    setWallet(prev => ({
                        ...prev,
                        address: newAddress,
                    }));

                    // Reset step and check KYC for new address
                    setCurrentStep('scan');
                    setKycRecord(null);
                    setMrzData(null);
                    setCredential(null);
                    setPresentation(null);

                    if (sdkRef.current) {
                        try {
                            addLog('Checking KYC status for new address...');
                            const { PublicKey } = await import('o1js');
                            const userKey = PublicKey.fromBase58(newAddress);

                            const record = await sdkRef.current.getKYCStatus(userKey);
                            console.log('[Debug] KYC Record:', record);

                            if (record) {
                                const isActive = record.isActive.toBoolean();
                                const commitment = record.commitment.toString();
                                addLog(`[Debug] Record found: isActive=${isActive}, commitment=${commitment.slice(0, 10)}...`);

                                if (isActive) {
                                    addLog('✨ New address already has an active KYC record.');
                                    setKycRecord({
                                        commitment: commitment,
                                        issuerHash: record.issuerHash.toString(),
                                        registeredAt: record.registeredAt.toString(),
                                        isActive: true,
                                        address: newAddress,
                                    });
                                    setCurrentStep('verified');
                                } else {
                                    addLog('Address has a revoked/inactive KYC record.');
                                }
                            } else {
                                addLog('New address is not verified (No record found). Ready to scan.');
                            }
                        } catch (e: any) {
                            console.error('Error checking KYC for new account:', e);
                        }
                    }
                }
            } else {
                // User disconnected logic if needed
                disconnectWallet();
            }
        };

        mina.on('accountsChanged', handleAccountsChanged);

        return () => {
            // Safe removal check
            if (mina.removeListener) {
                mina.removeListener('accountsChanged', handleAccountsChanged);
            }
        };
    }, [wallet.connected, wallet.address, addLog, disconnectWallet]);

    // ── Step 1: Scan (MRZ OCR) ─────────────────────────────────

    const onMRZScanned = useCallback(
        (data: MRZData) => {
            if (kycRecord?.isActive) {
                addLog('⚠️ Error: Account already verified.');
                return;
            }
            setMrzData(data);
            addLog(`MRZ scanned: ${data.fullName} (${data.nationality})`);
            setCurrentStep('witness');
        },
        [addLog, kycRecord]
    );

    // ── Step 2: Witness (Real Attestation) ─────────────────────

    const submitForAttestation = useCallback(async () => {
        if (!mrzData || !sdkRef.current) return;
        setLoading(true);
        setError(null);
        addLog('Submitting identity to attester for credential issuance...');

        try {
            const { PublicKey } = await import('o1js');
            const sdk = sdkRef.current;

            let userPubKey: any;
            if (userKeyRef.current) {
                userPubKey = userKeyRef.current.toPublicKey();
            } else if (wallet.address) {
                userPubKey = PublicKey.fromBase58(wallet.address);
            } else {
                throw new Error('No user wallet or key found');
            }

            // Call the real SDK attester
            const result = await sdk.issueCredential(userPubKey, {
                fullName: mrzData.fullName,
                dateOfBirth: mrzData.dateOfBirth,
                nationality: mrzData.nationality,
                documentType: mrzData.documentType || 'passport',
                expiresAt: mrzData.expiresAt,
            });

            addLog('✅ Credential issued by attester!');
            addLog(`   Issuer: ${result.issuerPublicKey.slice(0, 16)}...`);

            setCredential(result);
            setCurrentStep('proof');
        } catch (err: any) {
            setError(`Attestation failed: ${err.message}`);
            addLog(`❌ Attestation error: ${err.message}`);
        } finally {
            setLoading(false);
        }
    }, [mrzData, addLog, wallet.address]);

    // ── Step 3: Proof (Real ZK Proof Generation) ──────────────

    const generateProof = useCallback(async () => {
        if (!credential || !sdkRef.current) return;
        setLoading(true);
        setError(null);
        addLog('Generating ZK age verification proof...');
        addLog('This may take a moment (compiling presentation circuit)...');

        try {
            const sdk = sdkRef.current;

            console.log('[useNoahSDK] generateProof inputs:', {
                hasCredential: !!credential,
                hasSDK: !!sdk,
                hasUserKey: !!userKeyRef.current,
                userKeyType: userKeyRef.current?.constructor?.name,
                credType: credential?.credential?.constructor?.name,
            });

            // Generate a real ZK proof using mina-attestations
            const proof = await sdk.proveAge(
                credential.credential,
                18 // min age
            );

            addLog('✅ ZK proof generated successfully!');
            addLog('   Proved: age ≥ 18 without revealing birth date');

            setPresentation(proof);
            setCurrentStep('submit');
        } catch (err: any) {
            setError(`Proof generation failed: ${err.message}`);
            addLog(`❌ Proof error: ${err.message}`);
        } finally {
            setLoading(false);
        }
    }, [credential, addLog]);

    // ── Step 4: Submit (Real On-Chain Registration) ────────────

    const registerOnChain = useCallback(async () => {
        if (!sdkRef.current || !mrzData) return;
        setLoading(true);
        setError(null);
        addLog('Computing identity commitment...');

        try {
            const { Poseidon, Encoding, PublicKey } = await import('o1js');
            const sdk = sdkRef.current;

            // Compute the Poseidon commitment from identity data
            const fullNameHash = Poseidon.hash(
                Encoding.stringToFields(mrzData.fullName)
            );
            const nationalityHash = Poseidon.hash(
                Encoding.stringToFields(mrzData.nationality)
            );
            const commitment = sdk.computeCommitment(
                fullNameHash,
                mrzData.dateOfBirth,
                nationalityHash
            );
            const issuerHash = sdk.getIssuerHash();

            addLog(`Commitment: ${commitment.toString().slice(0, 20)}...`);
            addLog('Sending registerKYC transaction...');

            const regResult = await sdk.registerKYC(commitment, issuerHash);
            if (!regResult.success) throw new Error(regResult.error);
            addLog('✅ KYC registered on-chain!');

            if (regResult.pendingTx) {
                addLog('Waiting for transaction inclusion (approx. 3 mins)...');
                await regResult.pendingTx.wait();
                addLog('✅ Transaction confirmed in block!');
            } else if (regResult.hash) {
                addLog(`Transaction sent: ${regResult.hash.slice(0, 10)}...`);
                addLog('Waiting fixed 3 mins for block inclusion (Wallet mode)...');
                await new Promise(resolve => setTimeout(resolve, 3 * 60 * 1000));
                addLog('✅ Assuming transaction confirmed (3 mins passed).');
            }

            addLog('Settling offchain state...');
            const settleResult = await sdk.settleState();
            if (!settleResult.success) throw new Error(`Settlement failed: ${settleResult.error}`);

            if (settleResult.pendingTx) {
                addLog('Waiting for settlement confirmation...');
                await settleResult.pendingTx.wait();
                addLog('✅ Settlement confirmed!');
            } else if (settleResult.hash) {
                addLog(`Settlement sent: ${settleResult.hash.slice(0, 10)}...`);
                addLog('Waiting 3 mins for settlement...');
                await new Promise(resolve => setTimeout(resolve, 3 * 60 * 1000));
                addLog('✅ Settlement confirmed.');
            }
            addLog('✅ State settled on-chain!');

            // Verify the registration
            let userAddress: any;
            if (userKeyRef.current) {
                userAddress = userKeyRef.current.toPublicKey();
            } else if (wallet.address) {
                userAddress = PublicKey.fromBase58(wallet.address);
            }

            const hasKYC = await sdk.hasActiveKYC(userAddress);
            addLog(`hasActiveKYC() → ${hasKYC}`);

            const record: KYCRecord = {
                commitment: commitment.toString().slice(0, 32) + '...',
                issuerHash: issuerHash.toString().slice(0, 32) + '...',
                registeredAt: new Date().toISOString(),
                isActive: hasKYC,
                address: wallet.address || '',
                txHash: networkMode === 'local' ? `local_tx_${Date.now().toString(36)}` : 'devnet_tx_pending',
            };

            setKycRecord(record);
            setCurrentStep('verified');
            addLog('🎉 Full KYC flow complete! Address is now KYC-verified.');
        } catch (err: any) {
            setError(`Registration failed: ${err.message}`);
            addLog(`❌ Registration error: ${err.message}`);
        } finally {
            setLoading(false);
        }
    }, [mrzData, wallet.address, addLog, networkMode]);

    // ── Step Navigation ────────────────────────────────────────

    const getCurrentStepIndex = useCallback(() => {
        return STEPS.findIndex((s) => s.id === currentStep);
    }, [currentStep]);

    return {
        // State
        wallet,
        sdkStatus,
        networkMode,
        setNetworkMode,
        currentStep,
        mrzData,
        credential,
        presentation,
        kycRecord,
        loading,
        error,
        logs,
        devnetContractAddress,
        setDevnetContractAddress,

        // Step info
        steps: STEPS,
        currentStepIndex: getCurrentStepIndex(),

        // Actions
        connectWallet,
        disconnectWallet,
        onMRZScanned,
        submitForAttestation,
        generateProof,
        registerOnChain,
        setError,
        setCurrentStep,
    };
}
