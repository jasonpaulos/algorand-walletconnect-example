import { EventEmitter } from "events";
import WalletConnect from "@walletconnect/client"; 
import { IClientMeta } from "@walletconnect/types";
import algosdk from "algosdk";
import { ALGORAND_SIGN_TRANSACTION_REQUEST } from "../constants";
import { SignTxnParams, MultisigMetadata } from "../types";

export interface SigningTransaction {
  txn: algosdk.Transaction;
  shouldSign: boolean;
  signers?: string[];
  message?: string;
  msig?: MultisigMetadata;
}

export class AlgorandWCClientSession {

  connector: WalletConnect;
  events: EventEmitter;
  peerId?: string;
  peerMeta?: IClientMeta;

  constructor(uri: string, details?: IClientMeta) {
    this.connector = new WalletConnect({
      uri,
      clientMeta: details,
    });

    this.events = new EventEmitter();
  }

  async connect(getAccounts: (chainId: number, peerMeta?: IClientMeta) => string[] | Promise<string[]>) {
    await this.connector.createSession();
  
    this.connector.on("session_update", (err, payload) => {
      if (err) {
        this.events.emit("error", err);
        return;
      }

      console.log(`Session update: ${JSON.stringify(payload)}`)

      // nothing to update
    });

    this.connector.on("call_request", async (err, payload) => {
      if (err) {
        this.events.emit("error", err);
        return;
      }

      if (payload.method === ALGORAND_SIGN_TRANSACTION_REQUEST) {
        this.events.emit("signTxn", payload);
      } else {
        const unknownRequestErr = new Error(`Unknown request type: ${payload.method}`);
        this.events.emit("error", unknownRequestErr);
      }
    });

    this.connector.on("disconnect", async (err, payload) => {
      if (err) {
        this.events.emit("error", err);
      }

      this.events.emit("disconnect");
    });

    await new Promise<void>((resolve, reject) => {
      this.connector.on("session_request", async (err, payload) => {
        if (err) {
          reject(err)
          return;
        }

        console.log(`Session connect request: ${JSON.stringify(payload)}`);
  
        const { peerId, peerMeta, chainId } = payload.params[0];

        let accounts: string[];
        try {
          accounts = await getAccounts(chainId, peerMeta);
        } catch (err) {
          this.connector.rejectSession({ message: "Client rejected session" });
          return;
        }

        this.peerId = peerId;
        this.peerMeta = peerMeta;
    
        this.connector.approveSession({ chainId, accounts });
        resolve();
      });
    });
  }

  onError(handler: (error: Error) => unknown) {
    this.events.on("error", handler);
  }

  onDisconnect(handler: () => unknown) {
    this.events.on("disconnect", handler);
  }

  onSigningRequest(handler: (txns: SigningTransaction[], message?: string) => Array<Uint8Array | null> | Promise<Array<Uint8Array | null>>) {
    this.events.on("signTxn", async (payload) => {
      const signingRequest: SignTxnParams = payload.params;

      const signingTxns: SigningTransaction[] = signingRequest[0].map(walletTxn => {
        const rawTxn = Buffer.from(walletTxn.txn, 'base64');
        const txn = algosdk.decodeUnsignedTransaction(rawTxn) as algosdk.Transaction;
        const dontSign = Array.isArray(walletTxn.signers) && walletTxn.signers.length === 0;
        return {
          txn,
          shouldSign: !dontSign,
          signers: walletTxn.signers,
          message: walletTxn.message,
          msig: walletTxn.msig,
        };
      });

      const signingOptions = signingRequest.length > 1 ? signingRequest[1] : undefined;
      const signingMessage = signingOptions ? signingOptions.message : undefined;

      let signingResponse: Array<Uint8Array | null>;
      try {
        signingResponse = await handler(signingTxns, signingMessage);
      } catch (err) {
        this.connector.rejectRequest({
          id: payload.id,
          error: { message: 'Request rejected by wallet.' },
        });
        return;
      }

      const result = signingResponse.map(sigOrNull => {
        if (!sigOrNull) {
          return null;
        }
        return Buffer.from(sigOrNull).toString('base64');
      });

      this.connector.approveRequest({
        id: payload.id,
        result,
      });
    });
  }
}

export class AlgorandWCClient {

  details?: IClientMeta;

  constructor(details?: IClientMeta) {
    this.details = details;
  }

  newSession(sessionUri: string): AlgorandWCClientSession {
    const session = new AlgorandWCClientSession(sessionUri, this.details);
    return session;
  }
}
