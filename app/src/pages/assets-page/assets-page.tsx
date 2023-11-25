import { useEffect, useState } from "react";
import { AssetCard } from "./components/asset-card";
import React from 'react'
import useAssetsStore from "../../stores/stocks";
import { Link } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import ConnectWalletButton from "../../shared/components/connect-wallet-button";
import { BN } from "@project-serum/anchor";
import NewAccountDialog from "../../shared/components/new-account-dialog";
import userAccountStore from "../../stores/user-state";
import ActionMenu from "../../shared/components/action-menu/action-menu";
import { PARTY_ONE } from "../../models/constants";
import { useParierProvider } from "../../models/contexts";

const AssetsPage = () => {
    const wallet = useWallet();
    const program = useParierProvider(wallet)
    const assets = useAssetsStore(s => Object.keys(s.assets))
    const isAccountLoaded = userAccountStore(s => s.isAccountLoaded)
    const userAccount = userAccountStore(s => s.userAccount)
    const [displayCreateUserDialog, setDisplayCreateUserDialog] = useState(false)

    useEffect(() => {
        // setBetOutcome()
        if (!isAccountLoaded || userAccount) { return }

        setDisplayCreateUserDialog(true)
    }, [isAccountLoaded])

    async function setBetOutcome() {
        const provider = program.provider
        console.log(await program.account.betState.all())

        const betStatePK = (await program.account.betState.all())[0].publicKey
        const closeTx = program.transaction.closeBetState(new BN(Date.now()), {
            accounts: {
                betState: betStatePK,
                betCreator: provider.wallet.publicKey
            }
        })

        closeTx.add(program.transaction.decideBetStateOutcome(new BN(PARTY_ONE), {
            accounts: {
                betState: betStatePK,
                betCreator: provider.wallet.publicKey
            }
        }))

        closeTx.feePayer = provider.wallet.publicKey
        closeTx.recentBlockhash = (await provider.connection.getLatestBlockhash()).blockhash

        const signedTx = await provider.wallet.signTransaction(closeTx)
        const txId = await provider.connection.sendRawTransaction(signedTx.serialize())
        await provider.connection.confirmTransaction(txId)
        console.log('Confirmed successfully!')
    }

    return (<>
        <div className="float-right flex flex-col">
            <ConnectWalletButton />
            {wallet.connected ? <div className="mt-2"><ActionMenu /></div> : null}
        </div>
        <div className="text-slate-50 text-left">
            <h1 className="text-4xl font-semibold my-4">Assets</h1>
            <p className="text-m mt-8">Select an asset to place your bets on!</p>
            <p className="mt-8"><b>Note:</b></p>
            <p className="text-sm">
                <ul>
                    <li>The responsive design in the project is not responsive for mobile. Only desktop.</li>
                    <li><b>This application will only work with Devnet so please change your Phantom settings to Devnet.</b></li>
                </ul>
            </p>
        </div>
        <div className="h-1 border-b mt-8" style={{ borderColor: "#274060" }}></div>

        {assets.length != 0 ? <div className="mt-10 grid gap-y-8 gap-x-24 grid-cols-3">
            {assets.map(ticker => {
                return (
                    <Link
                        to={`/assets/${ticker}`}
                        key={ticker}>
                        <AssetCard ticker={ticker} key={ticker}></AssetCard>
                    </Link>
                )
            })} </div> : <div>
                <h1 className="animate-pulse text-slate-200 text-2xl mt-16">Loading assets...</h1>
        </div>}
        <NewAccountDialog isDialogOpen={displayCreateUserDialog} onDialogClose={() => setDisplayCreateUserDialog(false)}></NewAccountDialog>
    </>)
}

export default AssetsPage