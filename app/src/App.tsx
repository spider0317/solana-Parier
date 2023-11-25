import './App.css';
import React, { useEffect } from 'react'
import AssetsPage from './pages/assets-page/assets-page';
import useAssetsStore from './stores/stocks';
import { BrowserRouter, Route, Router, Routes } from 'react-router-dom';
import BettingPage from './pages/betting-page/betting-page';
import { ConnectionProvider, useWallet, WalletProvider } from '@solana/wallet-adapter-react';
import { PhantomWalletAdapter, SolletWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';
import userAccountStore from './stores/user-state';
import Mediator from './Mediator';

const wallets = [
  new PhantomWalletAdapter(),
  new SolletWalletAdapter(),
  new SolflareWalletAdapter()
]

function App() {
  // Load application info
  const endpoint = clusterApiUrl('testnet')

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <Mediator />
      </WalletProvider>
  </ConnectionProvider>
  );
}

export default App;
