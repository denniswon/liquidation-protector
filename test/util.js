const BigNumber = require("bignumber.js")
BigNumber.config({
  EXPONENTIAL_AT: 1000,
  DECIMAL_PLACES: 80,
})

const parseHexString = (hex) => {
  if (hex && hex._hex) {
    return new BigNumber(hex._hex).toString()
  }
  return new BigNumber(hex).toString()
}

const MAX_UINT = "115792089237316195423570985008687907853269984665640564039457584007913129639935"

module.exports = {
  parseHexString,
  MAX_UINT,
}
