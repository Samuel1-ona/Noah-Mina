import { PrivateKey, PublicKey, fetchAccount, Mina } from 'o1js';
import { NoahSDK } from '../build/src/NoahSDK.js';
import * as fs from 'fs';
import * as path from 'path';

async function deploy() {
    console.log('🚀 Starting Devnet Deployment...');

    // 1. Load keys
    const keysDir = path.join(process.cwd(), 'keys');
    const zkAppKeyJson = JSON.parse(fs.readFileSync(path.join(keysDir, 'devnet.json'), 'utf8'));
    const feePayerKeyJson = JSON.parse(fs.readFileSync(path.join(keysDir, 'feepayer.json'), 'utf8'));

    const zkAppKey = PrivateKey.fromBase58(zkAppKeyJson.privateKey);
    const feePayerKey = PrivateKey.fromBase58(feePayerKeyJson.privateKey);

    const devnetUrl = 'https://api.minascan.io/node/devnet/v1/graphql';
    const archiveUrl = 'https://api.minascan.io/archive/devnet/v1/graphql';

    console.log(`Checking fee payer balance for ${feePayerKey.toPublicKey().toBase58()}...`);

    // 2. Initialize Network
    const Network = Mina.Network({
        mina: devnetUrl,
        archive: archiveUrl,
    });
    Mina.setActiveInstance(Network);

    const account = await fetchAccount({ publicKey: feePayerKey.toPublicKey() });
    if (!account.account) {
        throw new Error('Fee payer account not found or not funded. Please fund it via the faucet.');
    }
    console.log(`Balance: ${account.account.balance.div(1e9).toString()} MINA`);

    // 3. Initialize SDK
    const sdk = await NoahSDK.init({
        network: devnetUrl,
        archiveUrl: archiveUrl,
        contractAddress: zkAppKey.toPublicKey(),
        feePayerKey: feePayerKey,
    });

    // 4. Compile
    console.log('Compiling contract (this may take 30-60s)...');
    await sdk.compile();

    // 5. Deploy
    console.log('Building deployment transaction...');
    const result = await sdk.deploy(zkAppKey);

    if (result.success) {
        console.log('\n✅ Deployment successful!');
        console.log(`Contract Address: ${zkAppKey.toPublicKey().toBase58()}`);
        console.log(`Next step: Update your frontend .env with VITE_CONTRACT_ADDRESS=${zkAppKey.toPublicKey().toBase58()}`);
    } else {
        console.error('❌ Deployment failed:', result.error);
    }
}

deploy().catch(console.error);
