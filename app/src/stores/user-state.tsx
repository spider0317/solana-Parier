import { BN, Program, ProgramAccount, Provider } from "@project-serum/anchor";
import { useWallet, WalletContextState } from "@solana/wallet-adapter-react";
import { clusterApiUrl, Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import produce from "immer";
import create, { State } from "zustand";
import { UserAccount } from "../models/user-account";
import idl from '../idl.json'
import { failureToast, successToast } from "../shared/toasts";
import { useParierProvider } from "../models/contexts";

interface UserAccountState extends State {
    userAccount: UserAccount | null,
    userWagers: ProgramAccount[],
    usersBetStates: object,
    isAccountLoaded: boolean,
    actions: { [key: string]: (...args) => void },
    set: (x: any) => void
}

const userAccountStore = create<UserAccountState>((set, get) => {
    return {
        userAccount: null,
        userWagers: [],
        usersBetStates: {},
        isAccountLoaded: false,
        set: (fn) => set(produce(fn)),
        actions: {
            async getAccount(program: Program) {
                const set = get().set
                const keypair = Keypair.fromSeed(program.provider.wallet.publicKey.toBytes())
                const userAccount = await program.account.userAccount.fetchNullable(keypair.publicKey) as UserAccount

                if (userAccount) {
                    userAccount!.publicKey = keypair.publicKey
                    console.log(userAccount.currentBalance.div(new BN(LAMPORTS_PER_SOL)).toString())
                }

                set(state => {
                    state.isAccountLoaded = true
                    state.userAccount = userAccount
                })
            },
            async getWagers(program: Program) {
                const userPubKey = program.provider.wallet.publicKey.toBase58();

                const allWagers = await program.account.wagerDetail.all()
                const allBetStates = await program.account.betState.all()

                const userWagers = allWagers.filter(wager => wager.account.bettor.toBase58() == userPubKey)
                const userBetStatePubKeys = [...new Set(userWagers.map(wager => wager.account.betState.toBase58()))]
                const betStates = allBetStates.filter(state => userBetStatePubKeys.includes(state.publicKey.toBase58())).reduce((prev, curr) => {
                    prev[curr.publicKey.toBase58()] = curr.account
                    return prev;
                }, {})

                set(s => {
                    s.userWagers = userWagers
                    s.usersBetStates = betStates
                })
            },
            async cancelWager(index: number, program: Program) {
                const userWagers = get().userWagers
                const userAccount = get().userAccount
        
                const wagerDetail = userWagers[index]
        
                program.rpc.cancelWager({
                    accounts: {
                        betState: wagerDetail.account.betState,
                        wagerDetail: wagerDetail.publicKey,
                        userAccount: userAccount!.publicKey,
                        bettor: program.provider.wallet.publicKey
                    }
                })
                .then(_ => {
                    console.log('Successfully cancelled wager!')
                    successToast('Successfully cancelled wager!')
                    set(s => {
                        s.userWagers = userWagers.filter(wager => wager.publicKey.toBase58() != wagerDetail.publicKey.toBase58())
                    })

                    // Update account info
                    get().actions.getAccount(program)
                })
                .catch(e => {
                    console.error('Error trying to cancel wager: ', e)
                    failureToast('Error trying to cancel wager. Please try again.')
                })
            },
            async claimWinnings(winnings: number, index: number, program: Program) {
                const userWagers = get().userWagers
                const userAccount = get().userAccount
                const wagerDetail = userWagers[index]

                program.rpc.claimWinnings(new BN(winnings), {
                    accounts: {
                        betState: wagerDetail.account.betState,
                        wagerDetail: wagerDetail.publicKey,
                        userAccount: userAccount!.publicKey,
                        bettor: program.provider.wallet.publicKey
                    }
                })
                .then(_ => {
                    console.log('Successfully claimed winnings!')
                    successToast('Successfully claimed winnings!')
                    set(s => {
                        s.userWagers = userWagers.filter(wager => wager.publicKey.toBase58() != wagerDetail.publicKey.toBase58())
                    })

                    // Update account info
                    get().actions.getAccount(program)
                })
                .catch(e => {
                    console.error('Error trying to claim winnings: ', e)
                    failureToast('Error trying to claim winnings. Please try again.')
                })
            }
        }
    }
})

export default userAccountStore