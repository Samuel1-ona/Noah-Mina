import { fetchAccount, PublicKey, Mina } from 'o1js';

async function checkBalance() {
    const devnetUrl = 'https://api.minascan.io/node/devnet/v1/graphql';
    const address = 'B62qj2Cr7dowj188EsnKmoqZqHCCyV3qqQdJ9fKZ4TZLuU26dfba87E';

    Mina.setActiveInstance(Mina.Network(devnetUrl));

    console.log(`Checking balance for ${address}...`);
    try {
        const account = await fetchAccount({ publicKey: PublicKey.fromBase58(address) });
        if (account.account) {
            console.log(`Balance: ${account.account.balance.div(1e9).toString()} MINA`);
        } else {
            console.log('Account not found (0 MINA)');
        }
    } catch (e) {
        console.error('Error fetching account:', e);
    }
}

checkBalance();
