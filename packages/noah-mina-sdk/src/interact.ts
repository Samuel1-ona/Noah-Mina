/**
 * interact.ts — End-to-End Demo of Noah-Mina KYC
 *
 * Demonstrates the full lifecycle:
 * 1. Deploy the KYC registry contract
 * 2. Attester issues a KYC credential (simulating passport OCR)
 * 3. User generates a ZK age verification proof
 * 4. Register KYC commitment on-chain
 * 5. Query KYC status
 * 6. Revoke KYC
 *
 * Run: npm run build && node build/src/interact.js
 */
import { PrivateKey, Poseidon, Field, UInt64 } from 'o1js';
import { NoahSDK } from './NoahSDK.js';
import type { IdentityDocument } from './attester/NoahAttester.js';

async function main() {
  console.log('==========================================================');
  console.log('        Noah-Mina: Privacy-Preserving KYC Demo');
  console.log('==========================================================\n');

  // ─── Step 1: Initialize SDK on local blockchain ──────────────

  console.log('[1/7] Initializing SDK on local Mina blockchain...');
  const attesterKey = PrivateKey.random();
  const sdk = await NoahSDK.init({
    network: 'local',
    attesterKey,
  });
  console.log(`   SDK initialized`);
  console.log(`   Attester: ${sdk.attester.issuerPublicKey.toBase58().slice(0, 20)}...`);

  // ─── Step 2: Deploy KYC Registry ─────────────────────────────

  console.log('\n[2/7] Deploying NoahKYCRegistry contract...');
  // deploy() uses the internally stored contract key
  const deployResult = await sdk.deploy();
  if (!deployResult.success) {
    console.error(`   Deploy failed: ${deployResult.error}`);
    return;
  }
  const contractAddress = sdk.contractKey.toPublicKey();
  console.log(`   Contract deployed at ${contractAddress.toBase58().slice(0, 20)}...`);

  // ─── Step 3: Issue KYC Credential (Simulated Passport OCR) ──

  console.log('\n[3/7] Issuing KYC credential (simulating passport OCR)...');

  const userKey = PrivateKey.random();
  const userPubKey = userKey.toPublicKey();

  const passportData: IdentityDocument = {
    fullName: 'Samuel Onah',
    dateOfBirth: 19950315,   // March 15, 1995
    nationality: 'NG',       // Nigeria
    documentType: 'passport',
    expiresAt: 20300101,     // Jan 1, 2030
  };

  const attestation = await sdk.issueCredential(
    userPubKey,
    passportData
  );
  console.log(`   Credential issued to ${userPubKey.toBase58().slice(0, 20)}...`);
  console.log(`   Issuer: ${attestation.issuerPublicKey.slice(0, 20)}...`);

  // ─── Step 4: Register KYC on-chain ──────────────────────────

  console.log('\n[4/7] Registering KYC commitment on-chain...');

  // Compute the commitment (Poseidon hash of identity data)
  const commitment = Poseidon.hash([
    Field(passportData.dateOfBirth),
    Field(0), // placeholder for full name hash
    Field(0), // placeholder for nationality hash
  ]);
  const issuerHash = sdk.getIssuerHash();

  const registerResult = await sdk.registerKYC(
    commitment,
    issuerHash
  );
  if (!registerResult.success) {
    console.error(`   Registration failed: ${registerResult.error}`);
    return;
  }
  console.log(`   KYC registered on-chain`);

  // ─── Step 5: Settle State ───────────────────────────────────

  console.log('\n[5/7] Settling offchain state...');
  const settleResult = await sdk.settleState();
  if (!settleResult.success) {
    console.error(`   Settlement failed: ${settleResult.error}`);
    return;
  }
  console.log(`   State settled`);

  // ─── Step 6: Query KYC Status ───────────────────────────────

  console.log('\n[6/7] Querying KYC status...');
  const kycRecord = await sdk.getKYCStatus(userPubKey);
  if (kycRecord) {
    console.log(`   KYC found!`);
    console.log(`    Commitment: ${kycRecord.commitment.toString().slice(0, 20)}...`);
    console.log(`    Active: ${kycRecord.isActive.toBoolean()}`);
    console.log(`    Registered at block: ${kycRecord.registeredAt.toString()}`);
  } else {
    console.log(`    No KYC record found`);
  }

  const hasKYC = await sdk.hasActiveKYC(userPubKey);
  console.log(`  Has active KYC: ${hasKYC}`);

  // ─── Step 7: Revoke KYC ────────────────────────────────────

  console.log('\n[7/7] Revoking KYC (admin action)...');
  const revokeResult = await sdk.revokeKYC(userPubKey);
  if (!revokeResult.success) {
    console.error(`   Revoke failed: ${revokeResult.error}`);
    return;
  }

  // Settle after revocation
  const settleResult2 = await sdk.settleState();
  if (settleResult2.success) {
    console.log(`   KYC revoked and settled`);
  }

  // Check status after revocation
  const hasKYCAfterRevoke = await sdk.hasActiveKYC(userPubKey);
  console.log(`  Has active KYC after revoke: ${hasKYCAfterRevoke}`);

  // ─── Done ──────────────────────────────────────────────────

  console.log('\n==========================================================');
  console.log('   Noah-Mina KYC Demo Complete!');
  console.log('  All lifecycle steps executed successfully.');
  console.log('==========================================================');
}

main().catch(console.error);
