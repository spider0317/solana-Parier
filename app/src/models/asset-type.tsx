import { parsePriceData } from "@pythnetwork/client";
import { Commitment } from "@solana/web3.js";
import { Connection } from "@solana/web3.js";
import { PublicKey } from "@solana/web3.js";

export enum AssetType {
    STOCK = "stock", CRYPTO = "crypto"
}

export class Asset {
    public ticker: string;
    public name: string;
    public price: number;

    public pricePubkey: PublicKey;
    private callbacks: Function[];
    private connection: Connection;
    private commitment: Commitment;

    constructor(ticker: string, name: string, priceAccountKey: PublicKey, connection: Connection, commitment: Commitment) {
        this.ticker = ticker;
        this.name = name;
        this.price = 0
        this.pricePubkey = priceAccountKey;
        this.callbacks = []
        this.commitment = commitment
        this.connection = connection

        this.getPrice(connection, commitment)
        // this.subscribeToPriceChange(connection, commitment)
    }

    public onPriceChange(callback: Function) {
        if (this.callbacks.includes(callback)) { return }

        this.callbacks.push(callback)
        this.getPrice(this.connection, this.commitment)
    }

    public async getPrice(connection: Connection, commitment: Commitment) {
        const priceData = await connection.getAccountInfo(this.pricePubkey, commitment)
        const priceInfo = parsePriceData(priceData!.data)
        this.price = priceInfo.price || priceInfo.aggregate.price || 0
        console.log('Price info for ', this.ticker, priceInfo.price, priceInfo.aggregate.price, '\n', this.price)

        for (const callback of this.callbacks) {
            callback();
        }
    }

    private subscribeToPriceChange(connection: Connection, commitment: Commitment) {
        connection.onAccountChange(this.pricePubkey, (account) => {
            // TODO: Look into status variable. Prices should only be used when status = training
            const priceInfo = parsePriceData(account.data)
            this.price = priceInfo.price || 0;
        }, commitment);
    }
}