const {Store} = require('./base-store');
const {gql, request, GraphQLClient } = require("graphql-request");
const { ethers } = require("ethers");

class ExecutionStore extends Store{
    constructor(){
        super();
    }

    add = (option) => {
        if (!option){
            throw new Error('Must specify option');
        }   
        const key = this._getKey(option); 
        return this.store.HSET("OPTION",key, JSON.stringify(option));
    }

    addFailed = (option) => {
        if (!option){
            throw new Error('Must specify option');
        }   
        const key = this._getKey(option); 
        return this.store.HSET("FAILED",key, JSON.stringify(option));
    }

    contains(type, option){
        const key = this._getKey(option);
        return this.store.HGET(type,key);
    }

    _getKey(option){
        return option.id;
    }

    remove(type, vault){
        const key = this._getKey(vault);
        return this.store.HDEL(type, key);
    }

    values(key){
        return this.store.HVALS(key);
    }
}

module.exports = { ExecutionStore }
