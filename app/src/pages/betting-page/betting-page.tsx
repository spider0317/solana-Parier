import { BN, Program, ProgramAccount, Provider } from '@project-serum/anchor'
import { useWallet } from '@solana/wallet-adapter-react'
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js'
import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Asset } from '../../models/asset-type'
import { BET_CREATOR_WALLET, PARTY_ONE, PARTY_TWO, RANGE_ENUM, SOL_TOKEN_LOGO, TAKER_FEE } from '../../models/constants'
import useAssetsStore from '../../stores/stocks'
import userAccountStore from '../../stores/user-state'
import idl from '../../idl.json'
import * as anchor from '@project-serum/anchor';
import './betting-page.scss';
import { LoadingAnimation } from '../../shared/components/svgs'
import { failureToast, successToast } from '../../shared/toasts'
import { Switch } from '@headlessui/react'
import { useParierProvider } from '../../models/contexts'

const BettingPage = () => {
    const params = useParams()
    const wallet = useWallet()
    const program = useParierProvider(wallet)
    // TODO: Add error handling for if ticker is empty
    const asset = useAssetsStore(s => s.assets[params["ticker"]!])
    const price = useAssetsStore(s => s.prices[params['ticker']!])
    const isLoaded = useAssetsStore(s => s.isLoaded["pythProductData"])
    const isAccountLoaded = userAccountStore(s => s.isAccountLoaded)
    const userAccount = userAccountStore(s => s.userAccount)
    const ranges = [[-Infinity, -0.03], [-0.03, -0.02], [-0.02, -0.01], [-0.01, 0], [0, 0.01], [0.01, 0.02], [0.02, 0.03], [0.03, Infinity]]
    const [balance, setBalance] = useState(-1)
    const [betState, setBetState] = useState<ProgramAccount>()
    const [wagerAmount, setWagerAmount] = useState('')
    const [selectedRange, setSelectedRange] = useState<number | null>(null)
    const [displayBetDialog, setDisplayBetDialog] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)

    useEffect(() => {
        if (!userAccount) { return }
        setBalance(userAccount!.currentBalance.toNumber() / LAMPORTS_PER_SOL || -1)

        getBetState()
    }, [userAccount])

    useEffect(() => {
        setDisplayBetDialog(selectedRange != null)
    }, [selectedRange])

    async function getBetState() {
        const betStates = await program.account.betState.all()
        const filteredStates = betStates.filter(state => state.account.symbol == asset.ticker)

        if (filteredStates.length == 0) {
            console.error('ERROR: Couldn\'t retrieve bet state. Please report error.')
        }

        setBetState(filteredStates[0])
    }

    async function placeWager() {
        let wager = Number(wagerAmount)
        if (wager > balance || wager < 0) {
            failureToast('Insufficient amount of SOL to bet with.')
            return
        }

        if (!wallet.connected) {
            console.error('Wallet not connected.')
            return
        }

        setIsSubmitting(true)
        const ticker = asset.ticker
        const betStates = await program.account.betState.all()
        const filteredStates = betStates.filter(state => state.account.symbol == ticker)

        if (filteredStates.length == 0) {
            console.error('ERROR: Couldn\'t retrieve bet state. Please report error.')
            failureToast('Could not find bet state at this time. Please try again.')
            return
        }
        
        const betState = filteredStates[0]

        const wagerDetailKP = Keypair.generate()
        // Here we are taking more than what the user offered. Consider if they have this amount
        // TODO: Check if user has this amount
        const wagerToPlace = new BN(wager * (1 + TAKER_FEE) * LAMPORTS_PER_SOL)

        program.rpc.placeWager(new BN(selectedRange!), wagerToPlace, {
            accounts: {
                betState: betState.publicKey,
                wagerDetail: wagerDetailKP.publicKey,
                userAccount: userAccount!.publicKey,
                bettorAccount: program.provider.wallet.publicKey,
                betCreator: program.provider.wallet.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId
            },
            signers: [wagerDetailKP]
        })
        .then(tx => {
            console.log('Wager successfully submitted.', tx)
            setIsSubmitting(false)
            successToast('Wager has been placed!')
    
            // Update user account
            userAccountStore.getState().actions.getAccount(program)
            setWagerAmount('')
            setSelectedRange(null)
        }).catch(e => {
            setIsSubmitting(false)
            failureToast('Error placing wager.')
        })
    }

    // Utility functions
    function rangeInDollars(index: number) {
        const range = ranges[index]

        if (range[0] == -Infinity) {
            return `<$${(price * (1 + range[1])).toFixed(2)}`
        } else if (range[1] == Infinity) {
            return `>$${(price * (1 + range[0])).toFixed(2)}`
        } else {
            return `$${(price * (1 + range[0])).toFixed(2)} - $${(price * (1 + range[1])).toFixed(2)}`
        }
    }

    function rangeInPercentages(index: number) {
        const range = ranges[index]
        if (range[0] == -Infinity) {
            return `<${range[1] * 100}%`
        } else if (range[1] == Infinity) {
            return `${range[0] * 100}%+`
        } else {
            return `${range[0] * 100}% -\ ${range[1] * 100}%`
        }
    }

    return (<>
        {isLoaded ? <>
            <div className="m-auto max-w-5xl mt-12">
                <div className="text-slate-50 text-left">
                    <h1 className="text-4xl font-semibold my-4">{asset.name}</h1>
                    <p className="text-m mt-8">Here you can place bets on what price ${asset.ticker} will open at for the next market open.</p>
                    <p className="text-m mt-8">Bets will be placed in methods of ranges. For example, if you select 1%-2%, you are betting that price for ${asset.ticker} will increase in that range next market session.   </p>
                    <p className="text-xl mt-8 text-slate-200 font-bold">Current Price: {price ? <span>${price.toFixed(2)}</span> : <span className='animate-pulse'>Loading price...</span>}</p>
                </div>
                <div className="h-1 border-b mt-8" style={{ borderColor: "#274060" }}></div>
                <div className="w-full">
                    <div>
                        <div className="grid grid-cols-4 gap-y-1 gap-x-1 w-full range-div mt-4">
                            {ranges.map((r, index) => {
                                return (<div className="flex-1" id={r[0].toString()} key={r[0]}>
                                    <div className={`range-container bg-slate-800 font-semibold text-m text-slate-200 pl-4 cursor-pointer hover:bg-slate-500 py-6 flex flex-col justify-center ${(selectedRange != null && ranges[selectedRange][0] == r[0]) ? 'selected' : ''}`} onClick={() => setSelectedRange(index)}>
                                        <p className="text-center">{rangeInPercentages(index)}</p>
                                        <p className="italic invisible opacity-0 text-sm price-range">{rangeInDollars(index)}</p>
                                    </div>
                                </div>)
                            })}
                        </div>
                    </div>
                    <div className="flex justify-center">
                        <div id="bet-dialog" className={`bg-slate-800 border border-slate-200 w-1/2 px-4 rounded-md block ${displayBetDialog ? 'display-header' : 'hide-header'}`}>
                            <h3 className="text-slate-200 text-lg text-center mt-4">
                                <span className="font-semibold">${asset.ticker}</span> bet for <span className="font-semibold">{selectedRange ? rangeInPercentages(selectedRange!) : ''}</span> by <span className="font-semibold">{new Date(betState?.account.startTime.toNumber()).toDateString()}</span>
                            </h3>
                            <div className="flex w-full mt-4 mb-2 justify-end">
                                {balance != -1 ?
                                    <span className="mt-1 mr-4 text-slate-200">Balance: {`${balance.toFixed(2)} `}<span className="mb-1">{SOL_TOKEN_LOGO}</span></span>
                                    : null}
                                <button className="text-slate-400 bg-slate-900 px-2 py-0.5 border border-slate-400 rounded-lg hover:bg-slate-700" onClick={() => setWagerAmount(balance.toString())}>Max</button>
                            </div>
                            <div className="bg-slate-600 mt-2 mb-2 py-2 w-full rounded-md">
                                <input className="w-full bg-transparent text-slate-200 outline-none p-0.5" placeholder="Amount" value={wagerAmount} onChange={(e) => setWagerAmount(e.target['value'])} />
                            </div>
                            <p className="text-right font-light italic text-slate-200">Taker fee: {(+wagerAmount * TAKER_FEE).toFixed(2)} {SOL_TOKEN_LOGO}</p>
                            <div className="flex w-full mt-12 mb-2">
                                <button className="flex-1 border border-slate-300 text-slate-300 rounded-lg mr-4" onClick={() => setSelectedRange(null)}>Cancel</button>
                                <button className="text-slate-300 flex-1 ml-4 bg-slate-900 rounded-lg py-3" onClick={placeWager}>
                                    {isSubmitting ? <span className="w-full flex justify-center"><LoadingAnimation /></span> : <span>Place Wager</span>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
            : null}

    </>)
}

export default BettingPage