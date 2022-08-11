import { VaultUpdated } from '../generated/Vault/DaiVault'
import { Vault } from '../generated/schema'

export function handleVaultUpdated(event: VaultUpdated): void {
  let id = event.params.account.toHex();
  let vault = Vault.load(id);
  if (vault == null){
    vault = new Vault(event.params.account.toHex());
  }
  vault.debt = event.params.debt;
  vault.collateral = event.params.collateral;
  vault.liquidationPrice = event.params.liquidationPrice;
  vault.blockTimeStamp = event.block.timestamp;
  vault.save();
}