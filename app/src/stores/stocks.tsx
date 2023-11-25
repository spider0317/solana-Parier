import { getMultipleAccounts } from "@project-serum/anchor/dist/cjs/utils/rpc";
import { getPythProgramKeyForCluster, parseBaseData, parseMappingData, parsePriceData, parseProductData, ProductData, PythConnection } from "@pythnetwork/client";
import { clusterApiUrl, Connection, PublicKey } from "@solana/web3.js";
import produce from "immer";
import create, { State } from "zustand";
import { Asset } from "../models/asset-type";

interface AssetStore extends State {
    pythProductData: Array<ProductData>,
    isLoaded: { [key: string]: boolean },
    assets: PythAsset,
    prices: PricesState,
    actions: { [key: string]: (args?) => void },
    set: (x: any) => void
}

enum AccountType {
    Unknown,
    Mapping,
    Product,
    Price,
    Test,
}

interface PythAsset {
    [ticker: string]: Asset;
}

interface PricesState {
    [ticker: string]: number
}

const useAssetsStore = create<AssetStore>((set, get) => {
    const tickers = process.env.ASSETS || ["TSLA", "SPY", "AAPL"]

    return {
        pythProductData: [],
        isLoaded: {},
        assets: {},
        prices: {},
        set: (fn) => set(produce(fn)),
        actions: {
            async getPythProductData() {
                // Get all products under Pyth account and save them in the store
                const set = get().set
                const connection = new Connection(clusterApiUrl('testnet'), 'recent');
                const accounts = await connection.getProgramAccounts(getPythProgramKeyForCluster('testnet'), 'finalized');
                const actions = get().actions
                const products: ProductData[] = []

                for (const account of accounts) {
                    const parsedAccount = parseBaseData(account.account.data)
                    if (!parsedAccount || parsedAccount!.type !== AccountType.Product) {
                        continue
                    }

                    const product = parseProductData(account.account.data)

                    if (product.product.asset_type !== 'Equity') {
                        continue
                    }

                    products.push(product)
                }

                set(state => {
                    state.pythProductData = products
                })
                
                for (const ticker of tickers) {
                    actions.initializeAsset(ticker)
                }

                set(state => {
                    state.isLoaded["pythProductData"] = true
                })
            },
            async getUserAccount() {

            },
            async getPrice(asset: Asset) {
                const connection = new Connection(clusterApiUrl('testnet'), 'recent');
                const set = get().set

                await asset.getPrice(connection, 'recent')

                set(state => {
                    state.prices[asset.ticker] = asset.price
                })
            },
            async initializeAsset(ticker: string) {
                // Initialize asset for price tracking
                // TODO: Create context so that one Connection object can be shared cross project
                const connection = new Connection(clusterApiUrl('testnet'), 'recent');
                const productData = get().pythProductData.filter(p => p.product["base"] === ticker)
                const actions = get().actions
                const set = get().set

                if (productData.length == 0) {
                    console.error('Error: Product for this ticker symbol was not found in Pyth products list.')
                    return
                }

                const product = productData[0]
                const asset = new Asset(product.product["base"], product.product["description"], product.priceAccountKey, connection, 'finalized')
                actions.getPrice(asset)

                set(state => {
                    state.assets[ticker] = asset
                })
            }
        }
    }
})

export default useAssetsStore