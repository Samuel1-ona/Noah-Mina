import { PrivateKey } from 'o1js';
import * as fs from 'fs';
import * as path from 'path';

// This script generates keypairs for devnet deployment
async function generate() {
    const keysDir = path.join(process.cwd(), 'keys');
    if (!fs.existsSync(keysDir)) {
        fs.mkdirSync(keysDir);
    }

    // 1. Generate zkApp (contract) keypair
    const zkAppKey = PrivateKey.random();
    const zkAppJson = {
        privateKey: zkAppKey.toBase58(),
        publicKey: zkAppKey.toPublicKey().toBase58(),
    };
    fs.writeFileSync(
        path.join(keysDir, 'devnet.json'),
        JSON.stringify(zkAppJson, null, 2)
    );
    console.log('✅ Generated keys/devnet.json (zkApp)');
    console.log('Public Key:', zkAppJson.publicKey);

    // 2. Generate Fee Payer keypair (if not exists)
    // Normal zk config would use ~/.mina-config/accounts/MyFeePayer.json
    // But we can keep it local for simplicity or guidance
    const feePayerKey = PrivateKey.random();
    const feePayerJson = {
        privateKey: feePayerKey.toBase58(),
        publicKey: feePayerKey.toPublicKey().toBase58(),
    };
    fs.writeFileSync(
        path.join(keysDir, 'feepayer.json'),
        JSON.stringify(feePayerJson, null, 2)
    );
    console.log('\n✅ Generated keys/feepayer.json (Fee Payer)');
    console.log('Public Key:', feePayerJson.publicKey);
    console.log('\nNext steps:');
    console.log(`1. Visit https://faucet.minaprotocol.com/?address=${feePayerJson.publicKey}`);
    console.log('2. Request tMINA and wait for it to arrive.');
}

generate().catch(console.error);
