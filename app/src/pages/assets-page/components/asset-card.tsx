import React, { useEffect, useState } from 'react'
import Tesla from '../../../assets/tesla.png'
import Apple from '../../../assets/apple.png'
import { SOL_TOKEN_LOGO } from '../../../models/constants'
import useAssetsStore from '../../../stores/stocks'
import { LoadingAnimation } from '../../../shared/components/svgs'

type AssetCardProps = {
    ticker?: string,
    price?: number,
    betAmount?: string,
    betPool?: string
}

export const AssetCard = (asset: AssetCardProps) => {
    const price = useAssetsStore(s => s.prices[asset.ticker!])

    useEffect(() => {
        console.log(`Price update for ${asset.ticker}: ${price}`)
    }, [price])

    const asset_mappings = {
        'TSLA': Tesla,
        'AAPL': Apple
    }
    return (<>
        <div className="bg-zinc-900 rounded-xl relative overflow-auto border-2 border-transparent hover:border-slate-50 cursor-pointer">
            <div className="p-6 flex">
                {asset.ticker == 'SPY' ? <div className="w-8 h-8 flex-initial"><Globe /></div> : null}
                {(asset.ticker && asset.ticker in asset_mappings) ?
                    <img src={asset_mappings[asset.ticker]} className="w-8 h-8 flex-initial" />
                    : null}
                <h1 className="flex-auto font-bold text-2xl text-slate-50 ml-4">{asset.ticker || 'N/A'}</h1>
            </div>
            <div className="h-1 border-b border-slate-50 mx-4"></div>
            <div>
                <p className="text-sm text-slate-50 mt-4">Current price:</p>
                {price ? 
                <h1 className="text-3xl text-slate-50 mb-4">${price?.toFixed(2) || "0.00"}</h1>
                : <h2 className="animate-pulse text-slate-300 text-2xl">Loading price...</h2>}      
            </div>
            {(asset.betAmount || asset.betPool) ?
                <div className="h-1 border-b border-slate-50 mx-4"></div>
                : null
            }
            <p className="mt-6 mb-4 mx-4 text-left">
                {asset.betAmount ?
                    <span>
                        <span className="text-xs text-slate-50">Your bet total: {asset.betAmount} {SOL_TOKEN_LOGO}</span>
                        <br></br>
                    </span> : null}
                {asset.betPool ?
                    <span>
                        <span className="text-xs text-slate-50">Total bet pool: {asset.betPool} {SOL_TOKEN_LOGO}</span>
                    </span>
                    : null}
            </p>
        </div>
    </>)
}

const Globe = () => {
    return (<>
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="#FFFFFF" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
        </svg>
    </>)
}

export default React.memo(AssetCard)