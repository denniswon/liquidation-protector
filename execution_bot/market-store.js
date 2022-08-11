const {Store} = require('./base-store');

class MarketStore extends Store{
    constructor(){
        super();
    }

    add = (data) => {
        if (!data){
            throw new Error('Must specify option');
        }   
        const key = this._getKey(data);
        const result = this.store.ZADD("MARKET", {score : data.timestamp, value: `${key}`});
        return result;
    }

    _getKey(data){
        return `${data.id}-${data.price}`;
    }

    async remove(data){
        const key = this._getKey(data);
        return await this.store.ZREM("MARKET", key);
    }

    getAll = () => {

        return this.store.ZRANGE("MARKET", 0, -1);
    }

    getRangeByScore = (min, max) => {
        return this.store.ZRANGEBYSCORE_WITHSCORES("MARKET", min, max,)
    }

}

module.exports = { MarketStore }
