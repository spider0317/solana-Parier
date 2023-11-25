import { Program, Provider } from "@project-serum/anchor";
import { Connection } from "@solana/web3.js";
import { createContext, useContext } from "react";
import idl from '../idl.json'
import { RPC_URL } from "./constants";

// export const ParierProvider = createContext<Program>(new Program(idl as any, idl.metadata.address))
export function useParierProvider(wallet) {
    // return useContext(ParierProvider)
    return getProgram(wallet)
}

export function getProgram(wallet) {
    const network = RPC_URL;
    const connection = new Connection(network, 'recent');
    // @ts-ignore
    const provider = new Provider(connection, wallet, 'processed')
    const programId = idl.metadata.address
    const program = new Program(idl as any, programId, provider)

    return program
}