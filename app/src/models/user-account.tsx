import { BN } from "@project-serum/anchor";
import { Keypair, PublicKey } from "@solana/web3.js"

export interface UserAccount {
    publicKey: PublicKey,
    accountOwner: PublicKey,
    wins: BN,
    losses: BN,
    activeWagers: Array<PublicKey>,
    currentBalance: BN
}