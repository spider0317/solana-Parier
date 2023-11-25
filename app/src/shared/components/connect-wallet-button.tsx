import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { PhantomWalletAdapter, SolletWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets'
import { clusterApiUrl } from '@solana/web3.js'
import React from 'react'

const wallets = [
    new PhantomWalletAdapter(),
    new SolletWalletAdapter(),
    new SolflareWalletAdapter()
]

const ConnectWalletButton = () => {
    const endpoint = clusterApiUrl('testnet')

    return (<>
        <WalletModalProvider>
            <div className='text-right'>
                <WalletMultiButton />
            </div>
        </WalletModalProvider>
    </>)
}

export default ConnectWalletButton