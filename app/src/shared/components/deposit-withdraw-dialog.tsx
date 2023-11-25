import { Dialog } from "@headlessui/react"
import { BN } from "@project-serum/anchor"
import { useWallet } from "@solana/wallet-adapter-react"
import { Connection, LAMPORTS_PER_SOL } from "@solana/web3.js"
import React, { useEffect } from "react"
import { useState } from "react"
import { SOL_TOKEN_LOGO } from "../../models/constants"
import userAccountStore from "../../stores/user-state"
import { failureToast, successToast } from "../toasts"
import { LoadingAnimation } from "./svgs"
import { useParierProvider } from "../../models/contexts"

type NewDialogProps = {
    isDialogOpen: boolean,
    onDialogClose: Function,
    isDeposit: boolean
}

const DepositWithdrawDialog = (props: NewDialogProps) => {
    const wallet = useWallet();
    const program = useParierProvider(wallet);
    const [walletBalance, setWalletBalance] = useState(-1)
    const [accountBalance, setAccountBalance] = useState(-1)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [amount, setAmount] = useState('')
    const userAccount = userAccountStore(s => s.userAccount)
    const network = "http://127.0.0.1:8899";
    const connection = new Connection(network, 'confirmed')

    // Retrieve account info from blockchain
    async function getBalance() {
        const balance = await connection.getBalance(wallet.publicKey!, 'finalized') / LAMPORTS_PER_SOL
        setWalletBalance(balance)
    }

    // Effects
    useEffect(() => {
        if (!wallet.connected) {
            return
        }
        getBalance()
    }, [wallet.connected])

    useEffect(() => {
        if (!userAccount) { return }
        setAccountBalance(userAccount!.currentBalance.toNumber() / LAMPORTS_PER_SOL)
    }, [userAccount])

    function withdraw() {
        if (Number(amount) > accountBalance || Number(amount) <= 0) {
            failureToast('Error: Insufficient amount of SOL to withdraw')
            return
        }

        setIsSubmitting(true)

        program.rpc.withdrawFromAccount(new BN(Number(amount) * LAMPORTS_PER_SOL), {
            accounts: {
                userAccount: userAccount!.publicKey,
                accountOwner: program.provider.wallet.publicKey
            }
        }).then(_ => {
            successToast('Successfully withdrew your funds! Please check your wallet if you received them.')
            props.onDialogClose()

            // Refresh user wallet
            userAccountStore.getState().actions.getAccount(program)
        }).catch(e => {
            console.log('Error trying to withdraw from account: ', e)
            failureToast('Error: Could not withdraw funds at this time. Please try again.')
        }).finally(() => setIsSubmitting(false))
    }

    function deposit() {
        if (Number(amount) > walletBalance || Number(amount) <= 0) {
            failureToast('Error: Insufficient amount of SOL to withdraw')
            return
        }

        setIsSubmitting(true)

        program.rpc.depositIntoAccount(new BN(Number(amount) * LAMPORTS_PER_SOL), {
            accounts: {
                userAccount: userAccount!.publicKey,
                accountOwner: program.provider.wallet.publicKey
            }
        }).then(_ => {
            successToast('Successfully deposited SOL into your betting account!')
            props.onDialogClose()

            // Refresh user wallet
            userAccountStore.getState().actions.getAccount(program)
        }).catch(e => {
            console.log('Error trying to deposit from account: ', e)
            failureToast('Error: Could not deposit funds at this time. Please try again.')
        }).finally(() => setIsSubmitting(false))
    }

    return (
        <>
            <Dialog open={props.isDialogOpen} onClose={() => props.onDialogClose()} as="div" className="fixed inset-0 z-10 top-1/4 overflow-y-auto">
                <Dialog.Overlay className="fixed inset-0 bg-black opacity-30" />

                <div className="relative bg-zinc-900 text-slate-200 rounded-lg max-w-md mx-auto p-8">
                    <Dialog.Title className="text-slate-200 text-2xl font-bold mb-4">{props.isDeposit ? 'Deposit To' : 'Withdraw From'} Account</Dialog.Title>
                    <Dialog.Description>
                    </Dialog.Description>


                    <p className="text-xl font-semibold text-slate-200 mt-8">Amount:</p>
                    <div className="flex w-full mb-2 justify-end">
                        {props.isDeposit && walletBalance != -1 ?
                            <span className="mt-1 mr-4">Balance: {`${walletBalance.toFixed(2)} `}<span className="mb-1">{SOL_TOKEN_LOGO}</span></span>
                            : null}
                        {!props.isDeposit && accountBalance != -1 ?
                            <span className="mt-1 mr-4">Balance: {`${accountBalance.toFixed(2)} `}<span className="mb-1">{SOL_TOKEN_LOGO}</span></span>
                            : null}
                        <button
                            className="text-slate-400 bg-slate-900 px-2 py-0.5 border border-slate-400 rounded-lg hover:bg-slate-700"
                            onClick={() => setAmount(props.isDeposit ? walletBalance.toString() : accountBalance.toString())}
                        >Max</button>
                    </div>
                    <div className="bg-slate-800 mt-2 mb-4 py-2 w-full border border-slate-200/25 rounded-md">
                        <input className="w-full bg-transparent text-slate-200 outline-none p-1" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target['value'])} />
                    </div>
                    <div className="flex w-full mt-16">
                        <button className="flex-1 border border-slate-300 text-slate-300 rounded-lg mr-4" onClick={() => props.onDialogClose()}>Cancel</button>
                        <button className="flex-1 py-4 rounded-lg bg-slate-800 hover:bg-slate-600" onClick={() => props.isDeposit ? deposit() : withdraw()}>
                            {isSubmitting ?
                                <span className="w-full flex justify-center"><LoadingAnimation /></span>
                                : <span>{props.isDeposit ? <span>Deposit</span> : <span>Withdraw</span>}</span>}

                        </button>
                    </div>
                </div>
            </Dialog></>
    )
}

export default DepositWithdrawDialog