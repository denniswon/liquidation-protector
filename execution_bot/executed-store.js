const { Store } = require("./base-store");

class ExecutedStore extends Store {
  constructor() {
    super();
  }

  set = (executed) => {
    if (!executed) {
      throw new Error("Must specify option");
    }

    const field = this._getField(executed);
    return this.store.HSET("Executed", field, JSON.stringify(executed));
  };

  get = (executed) => {
    const field = this._getField(executed);
    return this.store.HGET("Executed", field);
  };

  remove = (executed) => {
    const field = this._getField(executed);
    return this.store.HDEL("Executed", field);
  };

  values = () => {
    return this.store.HVALS("Executed");
  };

  _getField(executed) {
    return executed.optionAddress;
  }
}

module.exports = { ExecutedStore };
