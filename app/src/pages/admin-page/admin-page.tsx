/**
 * This page is only used for localhost development. This handles initializing bet state, checking outstanding bets, 
 * determine winner, and settle bet state.
 */

import { BN, Program, ProgramAccount } from "@project-serum/anchor";
import { useAnchorWallet, useWallet } from "@solana/wallet-adapter-react";
import { Keypair, LAMPORTS_PER_SOL, SystemProgram } from "@solana/web3.js";
import React, { useState } from "react";
import { useEffect } from "react";
import { SOL_TOKEN_LOGO } from "../../models/constants";
import { useParierProvider } from "../../models/contexts";
import ConnectWalletButton from "../../shared/components/connect-wallet-button";
import useAssetsStore from "../../stores/stocks";

export const AdminPage = () => {
    const wallet = useWallet()
    const prices = useAssetsStore(s => s.prices)
    const program = useParierProvider(wallet)
    const LAMPORTS_PER_SOL_BN = new BN(LAMPORTS_PER_SOL)
    const [betStates, setBetStates] = useState<ProgramAccount[]>([])
    const [wagers, setWagers] = useState<ProgramAccount[]>([])

    useEffect(() => {
        if (!isEverythingSetup()) { return }

        initializeData()
    }, [wallet.connected, prices])

    function isEverythingSetup() {
        return Object.keys(prices).length == 3 && (wallet && wallet.connected)
    }

    async function initializeData() {
        const betStates = await program.account.betState.all()
        const wagers = await program.account.wagerDetail.all()

        console.log('BN: ', (new BN(100000).toNumber() / LAMPORTS_PER_SOL).toString())
        // await initializeBetStates(program)

        if (betStates.length == 0) {
            await initializeBetStates(program)
            // Since program context is 'finalized', you won't get bet states initially here. Have to use 'processed'
            const betStates = await program.account.betState.all()
            setBetStates(betStates)
        } else {
            setBetStates(betStates)
        }

        setWagers(wagers)

        console.log('Current bet states: ', betStates)
        console.log('Current wagers: ', wagers)
    }

    async function initializeBetStates(program: Program) {
        const tickers = ["TSLA", "AAPL", "SPY"]

        for (const ticker of tickers) {
            const keypair = Keypair.generate()
            const start = new BN(Date.now())
            const duration = new BN(1000 * 60 * 60)
            const price = new BN(prices[ticker] * 100)

            console.log('Attempted to upload ', ticker, prices, price.toNumber())

            await program.rpc.initializeBetState(start, duration, ticker, price, {
                accounts: {
                    betState: keypair.publicKey,
                    betCreator: program.provider.wallet.publicKey,
                    systemProgram: SystemProgram.programId
                },
                signers: [keypair]
            })

            console.log(`${ticker} bet state has been created successfully!`)
        }

        console.log('Initialized all bet states...')
    }

    async function decideBetStateOutcome() {
        // Here we will make SPY go down
        const symbol = 'SPY'
        const betState = betStates.filter(state => state.account.symbol == symbol)[0]

        if (betState.account.status['open']) {
            console.log('Closing bet state...')

            await program.rpc.closeBetState(betState.account.endTime, {
                accounts: {
                    betState: betState.publicKey,
                    betCreator: wallet.publicKey!
                }
            })
        }

        console.log('Deciding bet state outcome...')

        await program.rpc.decideBetStateOutcome(2, {
            accounts: {
                betState: betState.publicKey,
                betCreator: wallet.publicKey!
            }
        })
        console.log('closed bet state!')
        initializeData()
    }

    return (<div>
        <div className="float-right flex flex-col">
            <ConnectWalletButton />
        </div>
        <section id="bet-states">
            <button className="text-slate-200 mt-36" onClick={decideBetStateOutcome}>Decide Bet State Outcome</button>
            <h2 className="text-slate-200  mb-8">Bet States</h2>
            <div id="current-bets" className="rounded-lg pt-0.5 bg-slate-700">
                <table className="mt-2 text-slate-200 table-fixed w-full">
                    <thead className="bg-slate-700">
                        <tr className="">
                            <th >Ticker</th>
                            <th className="pr-4">Start Time</th>
                            <th>End Time</th>
                            <th>Price</th>
                            <th>Status</th>
                            <th>Pool Size</th>
                        </tr>
                    </thead>
                    <tbody className="bg-slate-900">
                        {betStates.map(state => {
                            return <tr key={state.account.symbol}>
                                <td className="text-center">{state.account.symbol}</td>
                                <td>{new Date(state.account.startTime.toNumber()).toString()}</td>
                                <td>{new Date(state.account.endTime.toNumber()).toString()}</td>
                                <td>${(state.account.snapshotPrice.toNumber() / 100).toFixed(2)}</td>
                                <td>{Object.keys(state.account.status).at(0)}</td>
                                <td>{(state.account.runningTotalPool.toNumber() / LAMPORTS_PER_SOL).toFixed(2)} {SOL_TOKEN_LOGO}</td>
                            </tr>
                        })}
                    </tbody>
                </table>
                <div className="bg-slate-900 rounded-b-lg w-full h-2"></div>
            </div>
        </section>
        <section id="wagers">
            <h2 className="text-slate-200 mt-36 mb-8">Wagers</h2>
            <div className="rounded-lg pt-0.5 bg-slate-700">
                <table className="mt-2 text-slate-200 table-fixed w-full">
                    <thead className="bg-slate-700">
                        <tr className="">
                            <th >Bettor</th>
                            <th className="pr-4">Ticker</th>
                            <th>Price at Bet</th>
                            <th>Range</th>
                            <th>Amount of Bet</th>
                            <th>Expiry</th>
                        </tr>
                    </thead>
                    <tbody className="bg-slate-900">
                        {wagers.map((wager) => {
                            const wagerBetStatePK = wager.account.betState.toBase58()
                            const betState = betStates.filter(state => state.publicKey.toBase58() == wagerBetStatePK)[0]

                            return <tr key={wager.publicKey.toBase58()}>
                                <td className="text-center break-words" >{wager.account.bettor.toBase58()}</td>
                                <td>{betState.account.symbol}</td>
                                <td>${betState.account.snapshotPrice.toNumber().toFixed(2)}</td>
                                <td>{Object.keys(wager.account.rangeStatus).at(0)}</td>
                                <td>{(wager.account.betValue.toNumber() / LAMPORTS_PER_SOL).toFixed(2)} {SOL_TOKEN_LOGO}</td>
                                <td>{new Date(betState.account.endTime.toNumber()).toString()}</td>
                            </tr>
                        })}
                    </tbody>
                </table>
                <div className="bg-slate-900 rounded-b-lg w-full h-2"></div>
            </div>
        </section>

    </div>)
}

export default AdminPage;