import { Dialog } from "@headlessui/react"
import { Program, Provider } from "@project-serum/anchor"
import { useWallet } from "@solana/wallet-adapter-react"
import { Cluster, Connection, Keypair, LAMPORTS_PER_SOL, SystemProgram } from "@solana/web3.js"
import React, { useEffect } from "react"
import { useState } from "react"
import { RPC_URL, SOL_TOKEN_LOGO } from "../../models/constants"
import idl from '../../idl.json'
import * as anchor from '@project-serum/anchor';
import * as nacl from 'tweetnacl';
import userAccountStore from "../../stores/user-state"
import { failureToast, successToast } from "../toasts"
import { useParierProvider } from "../../models/contexts"

type NewDialogProps = {
  isDialogOpen: boolean,
  onDialogClose: Function
}

const NewAccountDialog = (props: NewDialogProps) => {
  const wallet = useWallet();
  const program = useParierProvider(wallet)
  const [balance, setBalance] = useState(-1)
  const [amount, setAmount] = useState('')
  const connection = new Connection(RPC_URL, 'confirmed')

  // Retrieve account info from blockchain
  async function getBalance() {
    if (!wallet.connected) {
      return
    }

    const balance = await connection.getBalance(wallet.publicKey!, 'finalized') / LAMPORTS_PER_SOL
    setBalance(balance)
  }

  // Effects
  useEffect(() => {
    getBalance()
  }, [wallet.connected])

  // Helper functions
  async function createAccountAndDepositSOL() {
    if (Number(amount) > balance) {
      // Error handle here
    }

    const provider = program!.provider;
    const depositAmount = Number(amount) * LAMPORTS_PER_SOL
    const userAccountKP = Keypair.fromSeed(provider.wallet.publicKey.toBytes())

    const tx = program.transaction.initializeUserAccount({
      accounts: {
        userAccount: userAccountKP.publicKey,
        accountOwner: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId
      },
      signers: [userAccountKP]
    })

    tx.add(program.transaction.depositIntoAccount(new anchor.BN(depositAmount), {
      accounts: {
        userAccount: userAccountKP.publicKey,
        accountOwner: provider.wallet.publicKey
      },
      preInstructions: [
        await SystemProgram.transfer({
          fromPubkey: provider.wallet.publicKey,
          lamports: depositAmount,
          toPubkey: userAccountKP.publicKey
        })
      ],
      signers: [userAccountKP]
    }))

    tx.feePayer = provider.wallet.publicKey
    tx.recentBlockhash = (await provider.connection.getLatestBlockhash()).blockhash
    tx.sign(userAccountKP)
    
    const signedTx = await provider.wallet.signTransaction(tx)
    const txId = await provider.connection.sendRawTransaction(signedTx.serialize())
    provider.connection.confirmTransaction(txId).then(_ => {
      console.log('Successfully deposited.')
      successToast(`Account created and ${amount} ${SOL_TOKEN_LOGO} has been deposited!`)
  
      props.onDialogClose()
  
      // Refresh user wallet
      userAccountStore.getState().actions.getAccount(program)
    }).catch(e => {
      failureToast('Could not create account. Please try again.')
    })
  }

  return (
    <Dialog open={props.isDialogOpen} onClose={() => {}} as="div" className="fixed inset-0 z-10 top-1/4 overflow-y-auto">
      <Dialog.Overlay className="fixed inset-0 bg-black opacity-30" />

      <div className="relative bg-zinc-900 text-slate-200 rounded-lg max-w-md mx-auto p-8">
        <Dialog.Title className="text-slate-200 text-2xl font-bold mb-4">Create Account</Dialog.Title>
        <Dialog.Description>
          We need to create an account before you use this platform.
          This account will hold all your bet information as well as store SOL that will be used for bets.
        </Dialog.Description>


        <p className="text-xl font-semibold text-slate-200 mt-8">Deposit Amount:</p>
        <div className="flex w-full mb-2 justify-end">
          {balance != -1 ?
            <span className="mt-1 mr-4">Balance: {`${balance.toFixed(2)} `}<span className="mb-1">{SOL_TOKEN_LOGO}</span></span>
            : null}

          <button
            className="text-slate-400 bg-slate-900 px-2 py-0.5 border border-slate-400 rounded-lg hover:bg-slate-700"
            onClick={() => setAmount(balance.toString())}
          >Max</button>
        </div>
        <div className="bg-slate-800 mt-2 mb-4 py-2 w-full border border-slate-200/25 rounded-md">
          <input className="w-full bg-transparent text-slate-200 outline-none p-1" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target['value'])} />
        </div>
        <button className="w-full mt-8 py-4 rounded-lg bg-slate-800 hover:bg-slate-600" onClick={createAccountAndDepositSOL}>Deposit</button>

      </div>
    </Dialog>
  )
}

export default NewAccountDialog