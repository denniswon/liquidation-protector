const { MarketStore } = require("../../execution_bot/market-store");
const {LiquidationStore } = require("../liquidation-store");
const {PriceUpdater} = require("../../execution_bot/priceUpdator");
const {Liquidator} = require("../liquidator");
const helper = require("../helper");
const {STORETYPE} = require('../enum');
const {ExecutionResult} = require('../../execution_bot/enum');

jest.mock("../helper", () => jest.fn())
describe('liquidator', () => {
    let liquidationStore;
    let liquidator;
    let marketPriceStore; 
    let marketPriceUpdater;
    let spyLiquidationStoreAdd;
    let spyLiquidationStoreValues;
    let spyLiquidationStoreRemove;
    let spyMarketStoreGetRangeByScore;

    beforeEach(() => {
        jest.clearAllMocks();
        liquidationStore = new LiquidationStore();
        marketPriceStore = new MarketStore();
        marketPriceUpdater = new PriceUpdater(marketPriceStore);
        liquidator = new Liquidator(liquidationStore, marketPriceStore);
        spyLiquidationStoreAdd = jest.spyOn(liquidationStore, "add");
        spyLiquidationStoreValues = jest.spyOn(liquidationStore, "values");
        spyLiquidationStoreContains = jest.spyOn(liquidationStore, "contains");
        spyLiquidationStoreRemove = jest.spyOn(liquidationStore, "remove");
        spyMarketStoreGetRangeByScore = jest.spyOn(marketPriceStore, "getRangeByScore");
    });

    async function setPrice(store, timestamp, id, price){
        await store.store.zadd(["MARKET", timestamp, `${id}-${price}`], function(err, result){
            return result;
        })
    }

    describe('Vault liquidator test', () => {
        test('Successfully liquidate vaults', async () => {
            spyLiquidationStoreAdd.mockImplementation(async (type, data) => {
                const result = await new Promise((res, rej) => {
                    liquidationStore.store.hset("VAULT", data.id, JSON.stringify(data), function(err,result){
                        res(result);
                    });
                });
                return result;
            })
            spyLiquidationStoreValues.mockImplementation(async (type) => {
                const values = await new Promise((res, rej) => {
                    liquidationStore.store.hvals(type, function (err,result){
                        res(result); 
                    });
                });
                return values;
            })
            spyLiquidationStoreRemove.mockImplementation(async (type, data) => {
                const removal = await new Promise((res, rej) => {
                    liquidationStore.store.hdel("VAULT", data.id, function(err,result){
                        res(result); 
                    });
                });
                return removal;
            })
            spyLiquidationStoreContains.mockImplementation(async(type, data) => {
                const contain = await new Promise((res, rej) => {
                    liquidationStore.store.hget("FAILEDVAULT", data.id, function(err,result){
                        res(result); 
                    });
                });
                return contain;
            })
            spyMarketStoreGetRangeByScore.mockImplementation(async (min,max) => {
                const result = await new Promise((res, rej) => {
                        marketPriceStore.store.zrangebyscore(["MARKET", min, max, 'withscores'], function(err,result){
                            const priceMap = result.reduce((acc, str) => {
                                if (str.includes('-')){
                                    acc.push({value: str});
                                }
                                else{
                                    acc[acc.length-1].score = str;
                                }
                                return acc;
                            }, [])
                            res(priceMap);
                        });
                    });
                return result;
            })

            liquidator._request = jest.fn().mockImplementation((data)=> getTestVaults());
            helper.liquidateVault = jest.fn((vault)=> ExecutionResult.TXSUCCEED);
            console.log("helper :", helper)

            setPrice(marketPriceStore, '1659782000', '1', '1035000000')
            setPrice(marketPriceStore, '1659788000', '2', '1080000000')
            const filteredVaults = await liquidator._getliquidableVaults();
            expect(spyLiquidationStoreAdd).toBeCalledTimes(5);
            expect(spyMarketStoreGetRangeByScore).toBeCalledTimes(1);
            expect(filteredVaults.length).toBe(2);
            expect(filteredVaults[0].id).toEqual(expect.stringMatching('0x7d'));
            await liquidator._liquidate(filteredVaults);
            const expectedVault1 = getTestVaults().vaults[1];
            const expectedVault2 = getTestVaults().vaults[2];
            expect(spyLiquidationStoreRemove).toHaveBeenNthCalledWith(1,STORETYPE.VAULT, {...expectedVault1,"liquidation_hit_round_Id" :"1" });
            expect(spyLiquidationStoreRemove).toHaveBeenNthCalledWith(2,STORETYPE.VAULT, {...expectedVault2,"liquidation_hit_round_Id" :"1" });

            const remainedVaults = await liquidationStore.values("VAULT");
            expect(remainedVaults.length).toBe(1); 

        })
    })
})

function getTestVaults () {
    const vaults = {
        vaults : [
            {
                "id": "0xe809b2f2b51406ab634035bfcea98d34b3894bf6",
                "debt": "999999520000000000000",
                "collateral": "961538000000000000",
                "liquidationPrice": "1040000000",
                "blockTimeStamp": "1659787657"
            },
            {
                "id": "0x7d20307d274757192fb6aa745fc285b59c61f8cc",
                "debt": "15977599040000000000000",
                "collateral": "15363076000000000000",
                "liquidationPrice": "1060000000",
                "blockTimeStamp": "1659781138"
            },
            {
                "id": "0xa1c344b64e1ac75a51d3a9f18b4ef8a7d01ec2fd",
                "debt": "416000000000000000000000",
                "collateral": "400000000000000000000",
                "liquidationPrice": "1040000000",
                "blockTimeStamp": "1659675004"
            }        ]
    }
    return vaults;
}