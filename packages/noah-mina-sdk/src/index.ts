/**
 * noah-mina-sdk — Privacy-Preserving KYC for Mina Blockchain
 *
 * Public API exports.
 *
 * Usage:
 *   import { NoahSDK, NoahAttester, KYCRecord } from 'noah-mina-sdk';
 */

// --- Main SDK ---
export { NoahSDK } from './NoahSDK.js';
export type { NoahConfig, TransactionResult, VerificationResult } from './NoahSDK.js';

// --- Smart Contract ---
export { NoahKYCRegistry, KYCRecord, offchainState, StateProof } from './contracts/NoahKYCRegistry.js';

// --- Credentials & Presentation Specs ---
export {
    KYCCredentialData,
    KYCCredential,
    AgeVerificationSpec,
    NationalityExclusionSpec,
    FullKYCVerificationSpec,
    String64,
    String128,
    computeCommitment,
} from './credentials/NoahCredential.js';

// --- Attester ---
export { NoahAttester, createAttesterServer } from './attester/NoahAttester.js';
export type { IdentityDocument, AttestationResult } from './attester/NoahAttester.js';
