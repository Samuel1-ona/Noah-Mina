# Noah-Mina SDK 🛠️

**The Core Logic Library for Privacy-Preserving KYC on Mina.**

This package (`noah-mina-sdk`) contains all the cryptographic primitives, smart contracts, and high-level APIs needed to integrate ZK Identity into your application.

##  Components

1.  **`NoahSDK` (Main Entry Point)**
    -   A high-level class that wraps all complexity.
    -   Handles: Wallet connection, Contract interaction, ZK Proof generation.
    
2.  **`NoahKYCRegistry` (Smart Contract)**
    -   The on-chain ZKApp that stores the *state* of user KYC (Verified/Not Verified).
    -   Uses **OffchainState** to minimize on-chain storage costs.

3.  **`NoahAttester` (Credential Issuer)**
    -   Logic for signing off-chain ZK Credentials.
    -   Verifies the user's raw identity data (e.g. from passport scan) and signs it.

4.  **`credentials/` (ZK Circuits)**
    -   Defines the ZK Program using `mina-attestations`.
    -   Circuit: `AgeVerification` (Proves `BirthDate <= Now - 18 years`).

## 💻 Installation

```bash
npm install noah-mina-sdk o1js
```

##  Basic Usage

```typescript
import { NoahSDK } from 'noah-mina-sdk';

// 1. Initialize (Connects to Mina Devnet)
const sdk = await NoahSDK.init({ network: 'devnet' });

// 2. Issue a Credential (Witness Step)
// In a real app, this happens on a secure server.
const credential = await sdk.issueCredential(userPublicKey, identityData);

// 3. Generate ZK Proof (Client-Side)
// Proof that user is > 18 without revealing DOB.
const proof = await sdk.proveAge(credential, 18);

// 4. Submit to Blockchain
const tx = await sdk.registerKYC(proof.commitment, proof.issuerHash);
console.log('Transaction Hash:', tx.hash);
```

##  Testing Locally

You can run the full flow without a blockchain by using the Local Blockchain mock:

```typescript
const sdk = await NoahSDK.init({ network: 'local' });
```

---

---

## 📚 API Reference

### Initialization & Setup

#### `static init(config: NoahConfig): Promise<NoahSDK>`
Initializes the SDK, connects to the network (local or remote), and sets up the contract instance.
- **config**: Network configuration (`local` or `string` URL), archive node, fee payer key, etc.

#### `compile(): Promise<void>`
Compiles the smart contract and off-chain state program. **Required** before generating any proofs or sending transactions.

#### `deploy(contractKey?: PrivateKey): Promise<TransactionResult>`
Deploys the `NoahKYCRegistry` contract to the network. Useful for testing or initial setup.

---

### Credential Management (Off-Chain)

#### `issueCredential(owner: PublicKey, document: IdentityDocument): Promise<AttestationResult>`
(Attester Role) Issues a cryptographically signed credential based on the user's identity document.
- **owner**: The user's public key.
- **document**: Parsed identity data (e.g. from MRZ scan).

#### `proveAge(credential: StoredCredential, minAge: number): Promise<Presentation>`
(User Role) Generates a Zero-Knowledge Proof that the user is at least `minAge` years old.
- **credential**: The signed credential from `issueCredential`.
- **minAge**: The age threshold (e.g. 18).

#### `proveNationality(credential: StoredCredential, ownerKey: PrivateKey, excludedNationality: string): Promise<Presentation>`
(User Role) Generates a ZK Proof that the user is **NOT** from the excluded nationality.
- **excludedNationality**: The ISO code to exclude (e.g. "USA").

#### `verifyAgeProof(presentation: Presentation, minAge: number): Promise<VerificationResult>`
(Verifier Role) Verifies an age proof off-chain. Useful for dApps checking proofs before on-chain submission (or for strictly off-chain use cases).

---

### Contract Interaction (On-Chain)

#### `registerKYC(commitment: Field, issuerHash: Field): Promise<TransactionResult>`
Submits a valid ZK proof commitment to the blockchain to register the user as "Verified".
- **commitment**: The hash of the user's identity (output from proof).
- **issuerHash**: The hash of the trusted attester's key.

#### `revokeKYC(user: PublicKey): Promise<TransactionResult>`
(Admin/Attester Role) Revokes a user's KYC status on-chain.

#### `settleState(): Promise<TransactionResult>`
Settles pending off-chain state actions onto the Mina ledger. Must be called after `registerKYC` to finalize the state update.

#### `getKYCStatus(user: PublicKey): Promise<KYCRecord | null>`
Queries the current on-chain KYC status of a specific user address. Returns the `KYCRecord` if found, or `null`.

#### `hasActiveKYC(user: PublicKey): Promise<boolean>`
Helper that returns `true` if the user has a valid, active KYC record on-chain.

---

### Utilities

#### `computeCommitment(fullNameHash, dateOfBirth, nationalityHash): Field`
Computes the Poseidon hash commitment of the user's identity data.

#### `getIssuerHash(): Field`
Returns the Poseidon hash of the configured Attester's public key.

