const { loadWallet } = require('../execution_bot/wallet');
const {ExecutionResult: ResultType} = require('../execution_bot/enum');
const { ethers } = require("ethers");
const ControllerAbi = require("../artifacts/contracts/MakerDaoController.sol/MakerDaoController.json");
const VaultAbi = require("../artifacts/contracts/MakerDaoVault.sol/MakerDaoVault.json");

const makerDAOControllerAbi = ControllerAbi.abi;
const makerVaultABI = VaultAbi.abi;
const makerDAOControllerAddress = '0xA12428268E99FE07aEbC488626E8DD56f2ba65eD';
const makerDaoVaultAddress = '0xb2C951244AfFAe2D8602E7Cc8cf73d5485355705';

async function liquidateVault(vault) {
    const wallet = loadWallet();
    const makerDaoController = new ethers.Contract(makerDAOControllerAddress, makerDAOControllerAbi, wallet.signer);
    const makerDaoVault = new ethers.Contract(makerDaoVaultAddress,makerVaultABI, wallet.signer);
    try{
        console.log("In liquidate vault - vault.id :", vault.id);
        console.log("----vault roundId : ", vault.liquidation_hit_round_Id);
        const alreadyLiquidate = await makerDaoVault.isLiquidated(vault.id);
        if (!alreadyLiquidate){
            const tx = await makerDaoController.settle(vault.id, vault.liquidation_hit_round_Id, {  maxFeePerGas: 40000000000, maxPriorityFeePerGas:40000000000 });
            console.log("execute tx : ", tx.hash);
            const receipt = await tx.wait();
            console.log("receipt : ", receipt.status);
            const Liquidated = await makerDaoVault.isLiquidated(vault.id);
            if (receipt.status && Liquidated){
                return ResultType.TXSUCCEED;
            }
            return ResultType.TXFAILED;
        }
        return ResultType.TXUNREACHED;
    }catch(e){
        console.log("Liquidation tx failed :", e.message);
        return ResultType.TXFAILED;
    }
}

module.exports = { liquidateVault }