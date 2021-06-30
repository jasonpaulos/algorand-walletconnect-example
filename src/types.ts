
/**
 * Options for creating and using a multisignature account.
 */
export interface MultisigMetadata {
    /**
     * Multisig version.
     */
    version: number;
   
    /**
     * Multisig threshold value. Authorization requires a subset of 
     * signatures, equal to or greater than the threshold value.
     */
    threshold: number;
   
    /**
     * List of Algorand addresses of possible signers for this
     * multisig. Order is important.
     */
    addrs: string[];
}
  
export interface WalletTransaction {
    /**
     * Base64 encoding of the canonical msgpack encoding of a     
     * Transaction.
     */
    txn: string;
   
    /**
     * Optional authorized address used to sign the transaction when 
     * the account is rekeyed. Also called the signor/sgnr.
     */
    authAddr?: string;
   
    /**
     * Optional multisig metadata used to sign the transaction
     */
    msig?: MultisigMetadata;
   
    /**
     * Optional list of addresses that must sign the transactions
     */
    signers?: string[];
   
    /**
     * Optional message explaining the reason of the transaction
     */
    message?: string;
}
   
export interface SignTxnOpts {
    /**
     * Optional message explaining the reason of the group of 
     * transactions.
     */
    message?: string;
    
    // other options may be present, but are not standard
}
  
export type SignTxnParams = [WalletTransaction[], SignTxnOpts?];
