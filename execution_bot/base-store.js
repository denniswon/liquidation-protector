const redis = require("redis");
require("dotenv").config();

class Store {
    store;
    constructor(){
        this.store = redis.createClient(6379, `${process.env.REDIS_ENDPOINT}`);
        //console.log("this.store : ", this.store);
    }

    start = async () => {
        await this.store.connect();
    }
    connectionTest = async () => {
        await this.store.HSET("fruit", "field", "thisisValue");
        this.store.on("error", (err) => {
            console.error(err);
          });
          
          this.store.on("ready", () => {
            console.log("Redis is ready");
          });
        const value = await this.store.HGET("fruit", "field"); 
        console.log("start complete : ", value)
        console.log("HVALUES: ", await this.store.HVALS("fruit"));
    }
    
}

module.exports = { Store }