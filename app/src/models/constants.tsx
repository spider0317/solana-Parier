import { Cluster, clusterApiUrl, PublicKey } from "@solana/web3.js"

export const SOL_TOKEN_LOGO = '◎'

// MAGIC NUMBERS
export const PARTY_ONE = '1'
export const PARTY_TWO = '2'

export const TAKER_FEE = Number(process.env.TAKER_FEE || 0.02)

export const BET_CREATOR_WALLET = new PublicKey('5G7rj9q2AuxGrW5QSnypB2FBGqYw3cxRJYswK6BncFEk')
export const RPC_URL = process.env.CLUSTER == 'localhost' || null ? 'http://127.0.0.1:8899' : clusterApiUrl(process.env.CLUSTER as Cluster)

export const ASSET_RANGE_LABELS = {
    negativeThreeAndOver: '<-3%',
    negativeTwoToThree: '-2% - -3%',
    negativeOneToTwo: '-1% - -2%',
    negativeOneToZero: '0% - -1%',
    zeroToPositiveOne: '0% - 1%',
    positiveOneToTwo: '1% - 2%',
    positiveTwoToThree: '2% - 3%',
    positiveThreeAndOver: '>3%'
}

export const RANGE_ENUM = {
        negativeThreeAndOver: 0,
        negativeTwoToThree: 1,
        negativeOneToTwo: 2, 
        negativeOneToZero: 3,
        zeroToPositiveOne: 4,
        positiveOneToTwo: 5,
        positiveTwoToThree: 6,
        positiveThreeAndOver: 7
}