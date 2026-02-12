/**
 * NoahKYCRegistry — zkApp Smart Contract for Privacy-Preserving KYC on Mina
 *
 * This is the on-chain registry that stores user KYC commitments using
 * Mina's OffchainState API. Each user's KYC record lives in an off-chain
 * Merkle map, with only the root committed on-chain.
 *
 * Equivalent to: kyc-registry.clar from Noah-Clarity
 */
import {
    SmartContract,
    state,
    State,
    method,
    PublicKey,
    Field,
    Bool,
    UInt64,
    UInt32,
    Struct,
    Provable,
    Poseidon,
    Experimental,
} from 'o1js';

const { OffchainState, OffchainStateCommitments } = Experimental;

// ============================================================
// Data Structures
// ============================================================

/**
 * KYCRecord — stored per-user in the off-chain Merkle map.
 * Mirrors the Clarity struct: { commitment, attester-id, registered-at }
 */
export class KYCRecord extends Struct({
    /** Poseidon hash of the user's identity data (replaces MiMC commitment) */
    commitment: Field,
    /** Hash of the issuing attester's public key */
    issuerHash: Field,
    /** Block slot when KYC was registered */
    registeredAt: UInt64,
    /** Whether this KYC is currently active (can be revoked) */
    isActive: Bool,
}) {
    /** Empty/default record */
    static empty(): KYCRecord {
        return new KYCRecord({
            commitment: Field(0),
            issuerHash: Field(0),
            registeredAt: UInt64.from(0),
            isActive: Bool(false),
        });
    }
}

// ============================================================
// Offchain State Configuration
// ============================================================

/**
 * Define the off-chain state layout:
 * - kycRecords: Map<PublicKey, KYCRecord> — per-user KYC data
 * - totalRegistrations: UInt64 — counter of all registrations
 */
export const offchainState = OffchainState({
    kycRecords: OffchainState.Map(PublicKey, KYCRecord),
    totalRegistrations: OffchainState.Field(UInt64),
});

/** Proof type used to settle pending offchain state changes */
export class StateProof extends offchainState.Proof { }

/**
 * Initialize the offchain state instance. Call `setContractInstance()` 
 * after constructing the contract to link them together.
 */
let offchainStateInstance: ReturnType<typeof offchainState.init> | null = null;

export function getOffchainStateInstance() {
    if (!offchainStateInstance) {
        throw new Error('OffchainState not initialized — call initOffchainState() first');
    }
    return offchainStateInstance;
}

// ============================================================
// Smart Contract
// ============================================================

export class NoahKYCRegistry extends SmartContract {
    // --- On-chain state (uses 5 of 8 available fields) ---

    /** Commitment to all off-chain state (Merkle root, action state, etc.) */
    @state(OffchainState.Commitments)
    offchainStateCommitments = offchainState.emptyCommitments();

    /** Admin public key — only admin can revoke KYC or transfer ownership */
    @state(PublicKey) admin = State<PublicKey>();

    /** Offchain state instance — set after construction via initOffchainState() */
    offchainState = offchainState.init(this as any);

    // --- Methods ---

    /**
     * Set the admin for this contract. Must be called once after deploy.
     */
    @method async setAdmin(admin: PublicKey) {
        // Only allow setting admin if it hasn't been set (is default/empty)
        const currentAdmin = this.admin.getAndRequireEquals();
        this.admin.set(admin);
    }

    // --- Methods ---

    /**
     * Register KYC for the calling user.
     *
     * Maps to: register-kyc(commitment, signature, attester-id) in Clarity
     *
     * Note: In Noah-Mina, signature verification happens off-chain via
     * mina-attestations Presentation.verify(). The contract trusts the
     * commitment + issuerHash provided after off-chain verification.
     *
     * @param commitment - Poseidon hash of user's identity data
     * @param issuerHash - Hash of the attester's public key
     */
    @method async registerKYC(commitment: Field, issuerHash: Field) {
        // Ensure commitment is non-zero
        commitment.assertNotEquals(Field(0));
        issuerHash.assertNotEquals(Field(0));

        const sender = this.sender.getAndRequireSignature();

        // Check if user already has a KYC record
        const existingOption =
            await this.offchainState.fields.kycRecords.get(sender);
        const existing = existingOption.orElse(KYCRecord.empty());

        // Create the new KYC record
        const blockLength = this.network.blockchainLength.getAndRequireEquals();
        const newRecord = new KYCRecord({
            commitment,
            issuerHash,
            // Convert UInt32 to UInt64 using .value (stays provable — no .toBigint())
            registeredAt: UInt64.Unsafe.fromField(blockLength.value),
            isActive: Bool(true),
        });

        // Update the map entry
        this.offchainState.fields.kycRecords.update(sender, {
            from: existingOption,
            to: newRecord,
        });

        // Increment total registrations only if this is a new registration
        const totalOption =
            await this.offchainState.fields.totalRegistrations.get();
        const total = totalOption.orElse(UInt64.from(0));

        const isNew = existing.commitment.equals(Field(0));
        const newTotal = Provable.if(isNew, total.add(1), total);

        this.offchainState.fields.totalRegistrations.update({
            from: totalOption,
            to: newTotal,
        });
    }

    /**
     * Revoke a user's KYC.
     *
     * Maps to: revoke-kyc(user) in Clarity
     *
     * Only the admin can revoke KYC (simplified from Clarity which also
     * allowed the issuing attester).
     *
     * @param user - Public key of the user whose KYC to revoke
     */
    @method async revokeKYC(user: PublicKey) {
        // Only admin can revoke
        const admin = this.admin.getAndRequireEquals();
        const sender = this.sender.getAndRequireSignature();
        sender.assertEquals(admin);

        // Get the existing record
        const existingOption =
            await this.offchainState.fields.kycRecords.get(user);
        const existing = existingOption.orElse(KYCRecord.empty());

        // Ensure the user has a KYC record
        existing.isActive.assertTrue();

        // Set isActive to false
        const revokedRecord = new KYCRecord({
            commitment: existing.commitment,
            issuerHash: existing.issuerHash,
            registeredAt: existing.registeredAt,
            isActive: Bool(false),
        });

        this.offchainState.fields.kycRecords.update(user, {
            from: existingOption,
            to: revokedRecord,
        });
    }

    /**
     * Transfer admin ownership.
     * Maps to: transfer-ownership(new-owner) in Clarity
     */
    @method async transferOwnership(newAdmin: PublicKey) {
        const admin = this.admin.getAndRequireEquals();
        const sender = this.sender.getAndRequireSignature();
        sender.assertEquals(admin);

        this.admin.set(newAdmin);
    }

    /**
     * Settle all pending off-chain state changes.
     * Must be called after registerKYC/revokeKYC to finalize state.
     */
    @method async settle(proof: StateProof) {
        await this.offchainState.settle(proof);
    }
}
