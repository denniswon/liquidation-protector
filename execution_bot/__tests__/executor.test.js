const { MarketStore } = require("../market-store");
const {ExecutionStore} = require("../execution-store");
const {PriceUpdater} = require("../priceUpdator");
const {Executor} = require("../executor");
const helper = require("../helper");
const {ExecutionResult} = require('../enum');

jest.mock("../helper", () => jest.fn())
describe('executor', () => {

    let marketPriceStore; 
    let marketPriceUpdater;
    let executor;
    let executionStore;
    let spyMarketStoreAdd;
    let spyMarketStoreGetAll;
    let spyMarketStoreGetRangeByScore;
    let spyExeuctionStoreAdd;
    let spyExeuctionStoreValues;
    let spyExeuctionStoreRemove;

    beforeEach(() => {
        jest.clearAllMocks();
        executionStore = new ExecutionStore();
        marketPriceStore = new MarketStore();
        marketPriceUpdater = new PriceUpdater(marketPriceStore);
        executor = new Executor(executionStore, marketPriceStore);
        spyMarketStoreAdd = jest.spyOn(marketPriceStore, "add");
        spyMarketStoreGetAll = jest.spyOn(marketPriceStore, "getAll");
        spyMarketStoreGetRangeByScore = jest.spyOn(marketPriceStore, "getRangeByScore");
        spyExeuctionStoreAdd = jest.spyOn(executionStore, "add");
        spyExeuctionStoreValues = jest.spyOn(executionStore, "values");
        spyExeuctionStoreRemove = jest.spyOn(executionStore, "remove");
    });

    describe('priceUpdater test', () => {
        test('Sucessfully updates price list', async () => {
            marketPriceUpdater._request = jest.fn().mockImplementation(
                () => {
                    return (
                        { kiOracles :  [
                        { id: '0x1', timestamp: '1658891347', price: '140000000' },
                        { id: '0x2', timestamp: '1658891893', price: '130000000' },
                        { id: '0x3', timestamp: '1658898415', price: '120000000' },
                        { id: '0x4', timestamp: '1758898415', price: '120000000' }
                      ]})
                }
            );
            spyMarketStoreAdd.mockImplementation(
                (data) => {
                    marketPriceStore.store.zadd(["MARKET", data.timestamp, `${data.id}-${data.price}`], function(err, result){
                        return result;
                    })
                });
            spyMarketStoreGetAll.mockImplementation(
                (callback) => {
                    marketPriceStore.store.zrange(["MARKET", '0', '-1'], callback)
                }
            )
            
            const update = await marketPriceUpdater._update();
            expect(spyMarketStoreAdd).toBeCalledTimes(4);
            expect(update.length).toBe(4);
            
            marketPriceStore.getAll(function(err, values){
                expect(values.length).toBe(update.length);
                expect(values[0].split('-')[1]).toBe('140000000')
            });

            marketPriceStore.store.zremrangebyrank(["MARKET", '0', '-1'], function (err, result){
                expect(result).toBe(4);
            })

        });

    });

    describe('Option Executor test', () => {
        test('Sucessfully execute option list', async () => {
            
            spyExeuctionStoreAdd.mockImplementation(async (data) => {
                const result = await new Promise((res, rej) => {
                executionStore.store.hset("OPTION", data.id, JSON.stringify(data), function(err,result){
                        res(result);
                    });
                });
                return result;
            })
            spyExeuctionStoreValues.mockImplementation(async (type) => {

                const values = await new Promise((res, rej) => {
                    executionStore.store.hvals(type, function (err,result){
                        res(result); 
                    });
                });
                return values;
            })
            spyExeuctionStoreRemove.mockImplementation(async (data) => {
                const removal = await new Promise((res, rej) => {
                    executionStore.store.hdel("OPTION", data.id, function(err,result){
                        res(result); 
                    });
                });
                return removal;
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
                        //console.log("range :", result);
                        res(priceMap);
                    });
                });
                return result;
            })

            executor._request = jest.fn()
                                    .mockImplementationOnce((data) => getFirstOptions())
                                    .mockImplementationOnce((data) => getSecondOptions());

            helper.executeOption = jest.fn().mockReturnValue(ExecutionResult.TXSUCCEED);

            setPrice(marketPriceStore, '1658986065', '1', '1290');
            setPrice(marketPriceStore, '1658986070', '2', '1293');

            const firstFilter = await executor._getExecutableOptions();
            console.log("firstFilter : ", firstFilter);
            expect(spyExeuctionStoreAdd).toBeCalledTimes(5);
            expect(spyMarketStoreGetRangeByScore).toBeCalledTimes(1);
            expect(firstFilter.length).toBe(1);
            expect(firstFilter[0].barrierPrice).toBe('1250');

            const execution1 = await executor._executeOptions(firstFilter);
            expect(spyExeuctionStoreRemove).toBeCalledTimes(1);
            expect(execution1.length).toBe(1);
            const remainedOptions1 = await executionStore.values("OPTION");
            expect(remainedOptions1.length).toBe(3);

            await setPrice(marketPriceStore, getSecondOptions().kiOptions[0].blockTimeStamp, '3', '1351');
            await setPrice(marketPriceStore, '1658999000', '4', '1330');

            const secondFilter = await executor._getExecutableOptions();
            expect(spyExeuctionStoreAdd).toBeCalledTimes(12); 
            expect(spyMarketStoreGetRangeByScore).toBeCalledTimes(2); 
            expect(secondFilter.length).toBe(4);
            expect(secondFilter[0].barrierPrice).toBe('1300');
            const execution2 = await executor._executeOptions(secondFilter);
            expect(spyExeuctionStoreRemove).toBeCalledTimes(5);
            expect(execution2.length).toBe(4);
            const remainedOptions2 = await executionStore.values("OPTION");

            expect(remainedOptions2.length).toBe(2);
        })
    })
})


async function setPrice(store, timestamp, id, price){
    console.log("store.store: ", store.store)
    await store.store.zadd(["MARKET", timestamp, `${id}-${price}`], function(err, result){
        return result;
    })
}

function getFirstOptions() {         
        const options = {
            kiOptions: [
            {
                "barrierPrice": "1250",
                "isUp": true,
                "tokenAddress": "0x9fbf8fe7c534345cc6857045635e847a9cd9033a",
                "creator": "0xa1c344b64e1ac75a51d3a9f18b4ef8a7d01ec2fd",
                "underlying": "0xaff1af4c4809e5eef86637c1e2656853e6fc7e51",
                "collateral": "0xaff1af4c4809e5eef86637c1e2656853e6fc7e51",
                "expiry": "1831786045",
                "isPlus": true,
                "blockTimeStamp": "1658986060",
              },
              {
                "tokenAddress": "0x8aa01900f003b9eb44255b6a996ca750b893dec3",
                "creator": "0xa1c344b64e1ac75a51d3a9f18b4ef8a7d01ec2fd",
                "underlying": "0xaff1af4c4809e5eef86637c1e2656853e6fc7e51",
                "collateral": "0xaff1af4c4809e5eef86637c1e2656853e6fc7e51",
                "barrierPrice": "1300",
                "expiry": "1918186316",
                "isUp": true,
                "isPlus": true,
                "blockTimeStamp": "1658986326"
              },
              {
                "tokenAddress": "0xbf2ac5a5182b2717c050a0993c72e866c8710291",
                "creator": "0xa1c344b64e1ac75a51d3a9f18b4ef8a7d01ec2fd",
                "underlying": "0xaff1af4c4809e5eef86637c1e2656853e6fc7e51",
                "collateral": "0xaff1af4c4809e5eef86637c1e2656853e6fc7e51",
                "barrierPrice": "1350",
                "expiry": "1918186336",
                "isUp": true,
                "isPlus": true,
                "blockTimeStamp": "1658986346"
              },
              {
                "tokenAddress": "0x80525c5933b078aba8af34bee765f476c0013132",
                "creator": "0xa1c344b64e1ac75a51d3a9f18b4ef8a7d01ec2fd",
                "underlying": "0xaff1af4c4809e5eef86637c1e2656853e6fc7e51",
                "collateral": "0xaff1af4c4809e5eef86637c1e2656853e6fc7e51",
                "barrierPrice": "1400",
                "expiry": "1918188752",
                "isUp": true,
                "isPlus": true,
                "blockTimeStamp": "1658988767"
              }
            ]
        }
        return options
}

function getSecondOptions () {
    const options = {
        kiOptions : [
        {
            "barrierPrice": "1325",
            "isUp": true,
            "tokenAddress": "0x9fbf8fe7c534345cc6857045635e847a9cd9033a",
            "creator": "0xa1c344b64e1ac75a51d3a9f18b4ef8a7d01ec2fd",
            "underlying": "0xaff1af4c4809e5eef86637c1e2656853e6fc7e51",
            "collateral": "0xaff1af4c4809e5eef86637c1e2656853e6fc7e51",
            "expiry": "1931786045",
            "isPlus": true,
            "blockTimeStamp": "1658989000",
          },
          {
            "tokenAddress": "0x8aa01900f003b9eb44255b6a996ca750b893dec3",
            "creator": "0xa1c344b64e1ac75a51d3a9f18b4ef8a7d01ec2fd",
            "underlying": "0xaff1af4c4809e5eef86637c1e2656853e6fc7e51",
            "collateral": "0xaff1af4c4809e5eef86637c1e2656853e6fc7e51",
            "barrierPrice": "1310",
            "expiry": "1958186316",
            "isUp": true,
            "isPlus": true,
            "blockTimeStamp": "1658999000"
          },
          {
            "tokenAddress": "0xbf2ac5a5182b2717c050a0993c72e866c8710291",
            "creator": "0xa1c344b64e1ac75a51d3a9f18b4ef8a7d01ec2fd",
            "underlying": "0xaff1af4c4809e5eef86637c1e2656853e6fc7e51",
            "collateral": "0xaff1af4c4809e5eef86637c1e2656853e6fc7e51",
            "barrierPrice": "1390",
            "expiry": "1958186336",
            "isUp": true,
            "isPlus": true,
            "blockTimeStamp": "1658999900"
          },
        ]
    }   
    return options
}