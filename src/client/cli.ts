import prompts from 'prompts';
import algosdk from 'algosdk';
import WalletConnect from "@walletconnect/client";
import { SignTxnParams, SignTxnOpts, WalletTransaction } from '../types';
import { AlgorandWCClient } from './client';

async function main() {
  const account = algosdk.generateAccount();
  console.log('Client account:', account.addr);
  console.log('Client sk:', algosdk.secretKeyToMnemonic(account.sk));

  const client = new AlgorandWCClient({
    description: "This is a test client!",
    url: "https://example.com/client",
    icons: [],
    name: "Test Client",
  });

  let uri: string | undefined = undefined;

  console.log('No existing session, start a new one.');
  const inputs = await prompts({
    type: 'text',
    name: 'uri',
    message: 'WalletConnect URI:',
    validate: value => typeof(value) === 'string' && value.length > 0,
  });
  uri = inputs.uri;

  if (!uri) {
    throw new Error('URI is required');
  }

  console.log('Connecting to session...');
  const session = client.newSession(uri);

  session.onError((err) => {
    console.error("Session error:", err);
  });

  session.onDisconnect(() => {
    console.log("Session disconnected");
  });

  session.onSigningRequest((txns, message) => {
    let success = true;
    let result: Array<Uint8Array | null> = [];

    for (const walletTxn of txns) {
      const shouldSign = walletTxn.signers == null || walletTxn.signers.length !== 0;

      if (!shouldSign) {
        console.log(`Txn ${walletTxn.txn.txID()} received, no sig required`);
        result.push(null);
        continue;
      }

      if ((walletTxn.signers && walletTxn.signers.length > 1) || walletTxn.msig) {
        success = false;
        console.log(`Txn is multisig`);
        result.push(null);
        continue;
      }

      const signer = walletTxn.signers ? walletTxn.signers[0] : algosdk.encodeAddress(walletTxn.txn.from.publicKey);

      if (signer !== account.addr) {
        success = false;
        console.log(`Txn ${walletTxn.txn.txID()} has unknown signer: ${signer}`);
        result.push(null);
        continue;
      }

      console.log(`Txn ${walletTxn.txn.txID()} received, signing with ${signer}`);

      const signedTxn = walletTxn.txn.signTxn(account.sk);
      result.push(signedTxn);
    }

    if (success) {
      return result;
    }

    throw new Error("Transaction signing not successful");
  });

  await session.connect((peerMeta) => {
    console.log("Peer is: ", JSON.stringify(peerMeta));
    return [account.addr];
  });

  console.log('Connected');
}

main().catch(console.error);
