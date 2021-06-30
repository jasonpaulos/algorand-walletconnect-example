import WalletConnect from "@walletconnect/client"; 
import { IClientMeta } from "@walletconnect/types";
import { formatJsonRpcRequest } from "@json-rpc-tools/utils";
import algosdk from "algosdk";
import { ALGORAND_CHAIN_ID, ALGORAND_SIGN_TRANSACTION_REQUEST } from "../constants";
import { WalletTransaction, SignTxnParams, MultisigMetadata } from "../types";

export interface SessionConnectResponse {
  peerId: string;
  peerMeta?: IClientMeta;
  accounts: string[];
}

export interface SessionUpdateResponse {
  accounts: string[];
}

export interface SessionDisconnectResponse {
  message?: string;
}

export interface TransactionInGroup {
  txn: algosdk.Transaction;
  shouldSign?: boolean;
  signer?: string | string[];
  msig?: MultisigMetadata;
  message?: string;
}

export class AlgorandWCServerSession {

  connector: WalletConnect;
  peerId?: string;
  peerMeta?: IClientMeta;
  accounts?: string[];

  constructor(bridgeUrl: string, details?: IClientMeta) {
    this.connector = new WalletConnect({
      bridge: bridgeUrl,
      clientMeta: details
    });
  }

  getUri(): string {
    return this.connector.uri;
  }

  async _listen(): Promise<void> {
    await this.connector.createSession({ chainId: ALGORAND_CHAIN_ID });
  }

  onConnect(handler: (error: Error | null, response: SessionConnectResponse) => unknown) {
    this.connector.on("connect", (err, payload) => {
      const { peerId, peerMeta, accounts }: SessionConnectResponse = payload.params[0];
      this.peerId = peerId;
      this.peerMeta = peerMeta;
      this.accounts = accounts;
      handler(err, { peerId, peerMeta, accounts });
    });
  }

  onUpdate(handler: (error: Error | null, response: SessionUpdateResponse) => unknown) {
    this.connector.on("session_update", (err, payload) => {
      const { accounts }: SessionUpdateResponse = payload.params[0];
      this.accounts = accounts;
      handler(err, { accounts });
    });
  }

  onDisconnect(handler: (error: Error | null, payload: SessionDisconnectResponse) => unknown) {
    this.connector.on("disconnect", (err, payload) => {
      const { message }: SessionDisconnectResponse = payload.params[0];
      handler(err, { message });
    });
  }

  async close() {
    await this.connector.killSession();
  }

  async signTransaction(txn: algosdk.Transaction, message?: string): Promise<Uint8Array> {
    const txnInGroup: TransactionInGroup = {
      txn,
      shouldSign: true,
    };
    const response = await this.signTransactionGroup([txnInGroup], message);
    if (response[0] == null) {
      throw new Error("Transaction was returned unsigned");
    }
    return response[0];
  }

  async signTransactionGroup(txns: TransactionInGroup[], message?: string): Promise<Array<Uint8Array | null>> {
    const walletTxns: WalletTransaction[] = txns.map(txn => {
      const encodedTxn = Buffer.from(algosdk.encodeUnsignedTransaction(txn.txn)).toString("base64");
      let signers: string[] | undefined;
      if (txn.shouldSign) {
        if (Array.isArray(txn.signer)) {
          signers = txn.signer;
        } else if (txn.signer) {
          signers = [txn.signer];
        } else {
          signers = undefined;
        }
      } else {
        signers = [];
      }

      return {
        signers,
        txn: encodedTxn,
        message: txn.message,
        msig: txn.msig,
      };
    });

    const requestParams: SignTxnParams = [walletTxns];
    if (message) {
      requestParams.push({ message });
    }
    const request = formatJsonRpcRequest(ALGORAND_SIGN_TRANSACTION_REQUEST, requestParams);
    const result: Array<string | null> = await this.connector.sendCustomRequest(request);
    const decodedResult = result.map(element => {
      return element ? new Uint8Array(Buffer.from(element, "base64")) : null;
    });

    return decodedResult;
  }
}

export class AlgorandWCServer {

  bridgeUrl: string;
  details?: IClientMeta;

  constructor(bridgeUrl: string, details?: IClientMeta) {
    this.bridgeUrl = bridgeUrl;
    this.details = details;
  }

  async newSession(): Promise<AlgorandWCServerSession> {
    const session = new AlgorandWCServerSession(this.bridgeUrl, this.details);
    await session._listen();
    return session;
  }
}
