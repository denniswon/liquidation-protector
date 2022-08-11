const {Store} = require('../execution_bot/base-store');
const {STORETYPE} = require("./enum");
class LiquidationStore extends Store {
    constructor(){
        super();
    }
    add = (type, vault) => {
        if (!vault){
            throw new Error('Must specify vault');
        }
        const key = this._getKey(vault);
        console.log("store add key : ", key);
        return this.store.HSET(type ,key, JSON.stringify(vault));
    }

    _getKey(vault){
        return vault.id;
    }

    remove(type, vault){
        const key = this._getKey(vault);
        console.log("store remove key : ", key);
        return this.store.HDEL(type, key);
    }

    contains(type, vault){
        const key = this._getKey(vault);
        return this.store.HGET(type,key);
    }

    values(key){
        return this.store.HVALS(key);
    }

}
module.exports = { LiquidationStore }