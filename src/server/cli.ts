import algosdk from "algosdk";
import { AlgorandWCServer } from "./server";

async function main() {
  const server = new AlgorandWCServer("https://bridge.walletconnect.org", {
    description: "This is a test server!",
      url: "https://example.com/server",
      icons: [],
      name: "Test Server",
  });

  console.log('Creating new session....');
  const session = await server.newSession();

  console.log('URI: ', session.getUri());

  session.onConnect((err, res) => {
    if (err) {
      console.error('onConnect error:', err);
      return;
    }

    console.log(`Peer ${res.peerId} connected with accounts ${res.accounts}`);

    // ask client to sign transaction in 1 second
    setTimeout(async () => {
      const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        from: res.accounts[0],
        to: "ERKK6KJUTU6VSZST5C5EH63PFVOXT5RMPS2SAAUGLRXSDBBMH6TJTI5XHU",
        amount: 1000000,
        suggestedParams: {
          fee: 1000,
          flatFee: true,
          firstRound: 10000,
          lastRound: 10200,
          genesisHash: 'SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=',
          genesisID: '',
        }
      });

      console.log('Asking client to sign transaction ', txn.txID());
      try {
        const response = await session.signTransaction(txn, "Please sign this transaction");
        console.log('Signed transaction: ', Buffer.from(response).toString('base64'));

        // end the session now
        await session.close();
      } catch (err) {
        console.log(err);
      }
    }, 1000);
  });

  session.onUpdate((err, res) => {
    if (err) {
      console.error('onUpdate error:', err);
      return;
    }

    console.log(`Peer ${session.peerId} changed accounts to ${res.accounts}`);
  });

  session.onDisconnect((err) => {
    if (err) {
      console.error('onDisconnect error:', err);
      return;
    }
  });
}

main().catch(console.error);
