import { Program, Provider } from "@project-serum/anchor"
import { useWallet } from "@solana/wallet-adapter-react"
import { Connection } from "@solana/web3.js"
import React, { useEffect } from "react"
import { BrowserRouter, Route, Routes } from "react-router-dom"
import { ToastContainer } from "react-toastify"
// import { ParierProvider, useParierProvider } from "./models/contexts"
import AssetsPage from "./pages/assets-page/assets-page"
import BettingPage from "./pages/betting-page/betting-page"
import MyBetsPage from "./pages/my-bets-page/my-bets-page"
import TopNav from "./shared/components/top-nav/top-nav"
import useAssetsStore from "./stores/stocks"
import userAccountStore from "./stores/user-state"
import idl from './idl.json'
import { RPC_URL } from "./models/constants"
import AdminPage from "./pages/admin-page/admin-page"

function Mediator() {
    const wallet = useWallet()
    const isLoaded = useAssetsStore(s => s.isLoaded["pythProductData"])
    const actions = useAssetsStore.getState().actions
    const userAccountActions = userAccountStore.getState().actions
    const program = getProgram()

    useEffect(() => {
        if (!wallet.connected) { return }

        userAccountActions.getAccount(program)
    }, [wallet.connected])

    useEffect(() => {
        if (isLoaded) { return }
        actions.getPythProductData()

    }, [isLoaded])

    function getProgram() {
        const network = RPC_URL;
        const connection = new Connection(network, 'recent');
        // @ts-ignore
        const provider = new Provider(connection, wallet, 'processed')
        const programId = idl.metadata.address
        const program = new Program(idl as any, programId, provider)

        return program
    }

    return (
        <>
            <ToastContainer
                position="top-right"
                autoClose={5000}
                hideProgressBar={false}
                newestOnTop={false}
                closeOnClick
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover />
            {/* <ParierProvider.Provider value={program}> */}
                <BrowserRouter>
                    <Routes>
                        <Route path="/" element={<div>
                            <div className="mt-4"><TopNav /></div>
                            <div className="App m-auto max-w-5xl mt-12">
                                <AssetsPage></AssetsPage>
                            </div>
                        </div>} />
                        <Route path="assets/:ticker" element={<div>
                            <div className="mt-4"><TopNav /></div>
                            <BettingPage />
                        </div>} />
                        <Route path="my-bets" element={<div>
                            <div className="mt-4"><TopNav /></div>
                            <MyBetsPage />
                        </div>} />
                        <Route path="admin-page" element={<div>
                            <div className="mt-4"><TopNav /></div>
                            <AdminPage />
                        </div>} />
                    </Routes>
                </BrowserRouter>
            {/* </ParierProvider.Provider> */}
            <ToastContainer />
        </>

    )
}

export default Mediator;