require('dotenv').config();
const executeOption = require('./helper');
const {MarketStore} = require('./market-store');
const {gql, request, GraphQLClient } = require("graphql-request");

const delay = ms => new Promise(r => setTimeout(r, ms));

class PriceUpdater {

    marketStore;
    client;

    constructor(
        marketStore
    ) {
        this.marketStore = marketStore;
        const endpoint = 'https://api.thegraph.com/subgraphs/name/ivanzrx/kioracle';
        this.client = new GraphQLClient(endpoint, { headers: {} });
    }

    start = async () => {
        this._poll();
    }

    _poll = async () => {
         for (;;) {
            const marketUpdate = await this._update();

            await delay(Number(process.env.POLL_INTERVAL_MS));
        }
    }

    _update = async () => {

        const round = {};
        const response = (await this._request()).kiOracles;

        return await Promise.all(response.map(async data => {
            round.id = parseInt(data.id);
            round.timestamp = data.timestamp;
            round.price = data.price;
            const result = await this.marketStore.add(round);
            return result;
            })
        );
    }

    _request = async () => {
        const query = gql`
            query {
                kiOracles(first: 100, orderBy: id, orderDirection: desc) {
                        id
                        timestamp
                        price
                    }   
                }
            `;
        const response = await this.client.request(query);
        // console.log("get Price market response: ", response);
        return response;        
    }

    test = async () => {
        return await this.marketStore.getAll();
    }

}

module.exports = { PriceUpdater }