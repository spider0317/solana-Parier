import { Program, ProgramAccount, Provider } from "@project-serum/anchor";
import { useWallet } from "@solana/wallet-adapter-react";
import { Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";
import React, { useEffect, useState } from "react";
import ConnectWalletButton from "../../shared/components/connect-wallet-button";
import userAccountStore from "../../stores/user-state";
import idl from '../../idl.json'
import { SOL_TOKEN_LOGO } from "../../models/constants";
import useAssetsStore from "../../stores/stocks";
import { useParierProvider } from "../../models/contexts";
import { Link } from "react-router-dom";

const MyBetsPage = () => {
    const wallet = useWallet()
    const program = useParierProvider(wallet)
    const userAccount = userAccountStore(s => s.userAccount)
    const assets = useAssetsStore(s => s.assets)
    const isPythDataLoaded = useAssetsStore(s => s.isLoaded['pythProductData'])
    const actions = userAccountStore.getState().actions
    const userWagers = userAccountStore(s => s.userWagers)
    const userBetStates = userAccountStore(s => s.usersBetStates)
    const [currentBets, setCurrentBets] = useState<ProgramAccount[]>([])
    const [settledBets, setSettledBets] = useState<ProgramAccount[]>([])
    const ranges = {
        negThreeAndUnder: '<-3%',
        negThreeToNegTwo: '-2% - -3%',
        negTwoToNegOne: '-1% - -2%',
        negOneToZero: '0% - -1%',
        zeroToPosOne: '0% - 1%',
        posOneToPosTwo: '1% - 2%',
        posTwoToPosThree: '2% - 3%',
        posThreeAndOver: '>3%'
    }

    useEffect(() => {
        if (!userAccount) { return }

        actions.getWagers(program)
    }, [userAccount])

    useEffect(() => {
        if (userWagers.length == 0) {
            if (currentBets.length != 0) { setCurrentBets([]) }
            if (settledBets.length != 0) { setSettledBets([]) }

            return
        }

        const currBets: ProgramAccount[] = []
        const stldBets: ProgramAccount[] = []

        for (const wager of userWagers) {
            console.log('User Bet States: ', userBetStates, wager.account.betState.toBase58())

            if (userBetStates[wager.account.betState.toBase58()].status['open']) {
                currBets.push(wager)
            } else {
                stldBets.push(wager)
            }
        }

        setCurrentBets(currBets)
        setSettledBets(stldBets)
    }, [userWagers])

    function cancelWager(index: number) {
        const userWagerIndex = userWagers.indexOf(currentBets[index])
        actions.cancelWager(userWagerIndex, program)
    }

    function claimWinnings(index: number, winnings: number) {
        const userWagerIndex = userWagers.indexOf(settledBets[index])
        actions.claimWinnings(winnings, userWagerIndex, program)
    }

    function calculateWinnings(index: number) {
        const wager = settledBets[index].account
        const wageredAmount = wager.betValue.toNumber()
        const betState = userBetStates[wager.betState.toBase58()]
        const range = Object.keys(wager.rangeStatus)[0]

        // ex. negThreeToNegTwoPool
        const poolWeight = wageredAmount / betState[range + 'Pool']
        const winnings = poolWeight * betState.runningTotalPool
        return winnings
    }

    return (<>
        <div className="m-auto max-w-5xl mt-12">
            <div className="float-right">
                <ConnectWalletButton />
            </div>
            <div className="text-slate-50 text-left">
                <h1 className="text-4xl font-semibold my-4">My Bets</h1>
                <p className="text-m mt-8">Here you can place see the bets you have placed. You can cancel bets here as well as claim winning bets.</p>
            </div>
            <div className="h-1 border-b mt-8" style={{ borderColor: "#274060" }}></div>
            {isPythDataLoaded ?
                <div>
                    {(currentBets.length != 0) ?
                        <div>
                            <h2 className="text-2xl text-slate-200 font-semibold mt-12 mb-8">Current Bets:</h2>
                            <div id="current-bets" className="rounded-lg pt-0.5 bg-slate-700">
                                <table className="mt-2 text-slate-200 table-fixed w-full">
                                    <thead className="bg-slate-700">
                                        <tr className="">
                                            <th >Bet Type</th>
                                            <th className="pr-4">Expiration</th>
                                            <th>Wagered Amount</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-slate-900">
                                        {currentBets.map((wager, index) => {
                                            const betState = userBetStates[wager.account.betState.toBase58()]
                                            const betRange = Object.keys(wager.account.rangeStatus)[0]
                                            const expiration = new Date(betState.endTime.toNumber())

                                            return <tr key={`${betState.symbol}-${index}`}>
                                                <td className="text-center">${assets[betState.symbol]?.ticker} from {ranges[betRange]}</td>
                                                <td className="text-center">{expiration.toString()}</td>
                                                <td className="p-4 text-center">{(wager.account.betValue.toNumber() / LAMPORTS_PER_SOL).toFixed(2)} {SOL_TOKEN_LOGO}</td>
                                                <td className="p-4 text-center">
                                                    <button className="text-red-600 border-red-600 hover:bg-red-200/20 border rounded-lg p-1.5 mt-1" onClick={() => cancelWager(index)}>
                                                        <span>Cancel Bet</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        })}
                                    </tbody>
                                </table>
                                <div className="bg-slate-900 rounded-b-lg w-full h-2"></div>
                            </div>
                        </div>
                        : null}
                    {(settledBets.length != 0) ?
                        <div>
                            <h2 className="text-2xl text-slate-200 font-semibold mt-12 mb-8">Past Bets:</h2>
                            <div className="rounded-lg pt-0.5 bg-slate-700">
                                <table className="mt-2 text-slate-200 table-fixed w-full">
                                    <thead className="bg-slate-700">
                                        <tr className="">
                                            <th >Bet Type</th>
                                            <th className="pr-4">Expiration</th>
                                            <th>Wagered Amount</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-slate-900">
                                        {settledBets.map((wager, index) => {
                                            const betState = userBetStates[wager.account.betState.toBase58()]
                                            const betRange = Object.keys(wager.account.rangeStatus)[0]
                                            const expiration = new Date(betState.endTime.toNumber())
                                            const betOutcome = Object.keys(betState.winningBetRange)[0]
                                            const isWinningBet = wager.account.rangeStatus[betOutcome] != undefined
                                            let winnings;
                                            if (isWinningBet) { winnings = calculateWinnings(index) }

                                            return <tr key={`${betState.symbol}-${index}`}>
                                                <td className="text-center">${assets[betState.symbol]?.ticker} from {ranges[betRange]}</td>
                                                <td className="text-center">{expiration.toString()}</td>
                                                <td className="p-4 text-center">{(wager.account.betValue.toNumber() / LAMPORTS_PER_SOL).toFixed(2)} {SOL_TOKEN_LOGO}</td>
                                                <td className="p-4 text-center">
                                                    {isWinningBet ?
                                                        <button className="text-green-600 border-green-600 hover:bg-green-200/20 border rounded-lg p-1.5 mt-1" onClick={() => claimWinnings(index, winnings)}>Claim {(winnings / LAMPORTS_PER_SOL).toFixed(2)} {SOL_TOKEN_LOGO}</button>
                                                        : null}
                                                </td>
                                            </tr>
                                        })}
                                    </tbody>
                                </table>
                                <div className="bg-slate-900 rounded-b-lg w-full h-2"></div>
                            </div>
                        </div>
                        : null}
                    {(currentBets.length == 0 && settledBets.length == 0) ? 
                        <div>
                            <div className="rounded-lg pt-0.5 bg-slate-700 mt-8 w-full">
                                <h2 className="text-slate-200 font-bold text-center py-8">
                                    <span>You have no bets. Visit the </span>
                                    <Link to={'/'} key={'/'} className="text-blue-600 underline">Assets page</Link>
                                    <span> to see which asset you would like to bet on!</span>
                                </h2>
                            </div>
                        </div> 
                        : null}
                </div>
                : null}
        </div>
    </>)
}
export default MyBetsPage;