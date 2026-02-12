/**
 * NoahCredential — KYC Credential Schema & Presentation Specs
 *
 * Uses mina-attestations to define:
 * 1. The KYC credential data schema (what the attester signs)
 * 2. Presentation specs (what ZK proofs can be generated)
 *
 * Replaces: circuit/ (Go/gnark ZK circuit) from Noah-Clarity
 */
import {
    Credential,
    Spec as PresentationSpec,
    Operation,
    Claim,
    Constant,
    DynamicString,
} from 'mina-attestations';
import { Field, UInt64, Poseidon, PublicKey } from 'o1js';

// ============================================================
// Dynamic String Types
// ============================================================

/** Max-length string types for credential fields */
export const String64 = DynamicString({ maxLength: 64 });
export const String128 = DynamicString({ maxLength: 128 });

// ============================================================
// KYC Credential Schema
// ============================================================

/**
 * The data structure that an Attester signs and issues to a user.
 * After OCR extraction from a passport/ID document, these fields
 * are populated and signed by the attester.
 */
export const KYCCredentialData = {
    /** Full legal name from the identity document */
    fullName: String128,
    /** Date of birth in YYYYMMDD format (e.g. 19900115 = Jan 15, 1990) */
    dateOfBirth: UInt64,
    /** ISO 3166-1 nationality (e.g. "US", "NG", "DE") */
    nationality: String64,
    /** Type of identity document ("passport", "national_id", "drivers_license") */
    documentType: String64,
    /** Credential expiry date in YYYYMMDD format */
    expiresAt: UInt64,
};

/**
 * Native KYC Credential — signed by attester's Mina key
 * This is the credential spec used with mina-attestations
 */
export const KYCCredential = Credential.Native(KYCCredentialData);

// ============================================================
// Presentation Specs (ZK Proof Logic)
// ============================================================

/**
 * Age Verification Spec
 *
 * Proves that a user is at least `minAge` years old, without
 * revealing their exact date of birth, name, or nationality.
 *
 * Public inputs (claims):
 * - currentDate: today's date in YYYYMMDD format
 * - minAge: minimum age in years (as YYYYMMDD delta)
 *
 * Assertions:
 * 1. dateOfBirth + minAge <= currentDate (user is old enough)
 * 2. currentDate <= expiresAt (credential not expired)
 *
 * Public output: issuer hash (so verifier can check trust)
 *
 * Use case: DEX requiring 18+, gambling platforms, age-gated content
 */
export const AgeVerificationSpec = PresentationSpec(
    {
        kyc: KYCCredential,
        currentDate: Claim(UInt64),
        minAgeDelta: Claim(UInt64),
    },
    ({ kyc, currentDate, minAgeDelta }) => ({
        assert: [
            // User's DOB + age delta <= current date means age >= minAge
            Operation.lessThanEq(
                Operation.add(Operation.property(kyc, 'dateOfBirth'), minAgeDelta),
                currentDate
            ),
            // Credential is not expired
            Operation.lessThanEq(
                currentDate,
                Operation.property(kyc, 'expiresAt')
            ),
        ],
        // Expose the issuer hash so verifier can check it's a trusted attester
        outputClaim: Operation.issuer(kyc),
    })
);

/**
 * Nationality Exclusion Spec
 *
 * Proves that a user is NOT from a specific excluded country,
 * without revealing their actual nationality.
 *
 * Use case: DEX compliance (not from sanctioned region)
 */
export const NationalityExclusionSpec = PresentationSpec(
    {
        kyc: KYCCredential,
        currentDate: Claim(UInt64),
        excludedNationality: Claim(String64),
    },
    ({ kyc, currentDate, excludedNationality }) => ({
        assert: [
            // Nationality is NOT the excluded one
            Operation.not(
                Operation.equals(
                    Operation.property(kyc, 'nationality'),
                    excludedNationality
                )
            ),
            // Credential not expired
            Operation.lessThanEq(
                currentDate,
                Operation.property(kyc, 'expiresAt')
            ),
        ],
        outputClaim: Operation.issuer(kyc),
    })
);

/**
 * Full KYC Verification Spec
 *
 * Proves age >= minAge AND nationality is not excluded,
 * in a single presentation.
 *
 * Use case: Lending protocols requiring accredited investors from non-sanctioned countries
 */
export const FullKYCVerificationSpec = PresentationSpec(
    {
        kyc: KYCCredential,
        currentDate: Claim(UInt64),
        minAgeDelta: Claim(UInt64),
        excludedNationality: Claim(String64),
    },
    ({ kyc, currentDate, minAgeDelta, excludedNationality }) => ({
        assert: [
            // Age check
            Operation.lessThanEq(
                Operation.add(Operation.property(kyc, 'dateOfBirth'), minAgeDelta),
                currentDate
            ),
            // Nationality exclusion
            Operation.not(
                Operation.equals(
                    Operation.property(kyc, 'nationality'),
                    excludedNationality
                )
            ),
            // Credential not expired
            Operation.lessThanEq(
                currentDate,
                Operation.property(kyc, 'expiresAt')
            ),
        ],
        outputClaim: Operation.issuer(kyc),
    })
);

// ============================================================
// Helper: Compute commitment from identity data
// ============================================================

/**
 * Compute the Poseidon commitment from identity data fields.
 * This is the value stored on-chain in the KYC registry.
 *
 * Replaces: MiMC commitment from Noah-Clarity
 */
export function computeCommitment(
    fullNameHash: Field,
    dateOfBirth: UInt64,
    nationalityHash: Field
): Field {
    return Poseidon.hash([
        fullNameHash,
        dateOfBirth.value,
        nationalityHash,
    ]);
}
