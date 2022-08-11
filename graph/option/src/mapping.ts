import { BigInt } from "@graphprotocol/graph-ts";
import {
  KiOption,
  OptionTokenBalance,
  OptionExecuted,
} from "../generated/schema";
import { OptionCreated } from "../generated/KiOption/KIOptionFactory";
import {
  ERC20,
  Redeem,
  Transfer as ERC20Transfer,
} from "../generated/templates/ERC20Template/ERC20";
import { Executed } from "../generated/KIOptionController/KIOptionController";
import { ERC20Template } from "../../option/generated/templates";

export function handleOptionCreated(event: OptionCreated): void {
  const id = `0x${event.params.tokenAddress}${event.params.creator}${event.params.underlying}${event.params.collateral}${event.params.barrierPrice}${event.params.expiry}${event.params.isUp}${event.params.isPlus}`;
  let entity = KiOption.load(id);
  if (!entity) {
    entity = new KiOption(id);
  }
  entity.tokenAddress = event.params.tokenAddress;
  entity.creator = event.params.creator;
  entity.underlying = event.params.underlying;
  entity.collateral = event.params.collateral;
  entity.barrierPrice = event.params.barrierPrice;
  entity.expiry = event.params.expiry;
  entity.isUp = event.params.isUp;
  entity.isPlus = event.params.isPlus;
  entity.blockTimeStamp = event.block.timestamp;
  entity.save();
  ERC20Template.create(event.params.tokenAddress);
}

export function handlerOptionTokenTransfer(event: ERC20Transfer): void {
  let fromId = `${event.address.toHex()}-${event.params.from.toHex()}`;
  let toId = `${event.address.toHex()}-${event.params.to.toHex()}`;
  const fromAddr = event.params.from.toHex();

  // from balance update
  if (fromAddr !== "0x0000000000000000000000000000000000000000") {
    let tokenBalanceFrom = OptionTokenBalance.load(fromId);
    if (tokenBalanceFrom == null) {
      tokenBalanceFrom = new OptionTokenBalance(fromId);
      tokenBalanceFrom.tokenAddress = event.address;
      tokenBalanceFrom.owner = event.params.from;
      tokenBalanceFrom.balance = BigInt.fromI32(0);
      tokenBalanceFrom.redeemed = false;
    }
    tokenBalanceFrom.balance = tokenBalanceFrom.balance.minus(
      event.params.value
    );
    tokenBalanceFrom.lastBlock = event.block.number;
    tokenBalanceFrom.save();
  }

  // to balance update
  let tokenBalanceTo = OptionTokenBalance.load(toId);
  if (tokenBalanceTo == null) {
    tokenBalanceTo = new OptionTokenBalance(toId);
    tokenBalanceTo.tokenAddress = event.address;
    tokenBalanceTo.owner = event.params.to;
    tokenBalanceTo.balance = BigInt.fromI32(0);
    tokenBalanceTo.redeemed = false;
  }
  tokenBalanceTo.balance = tokenBalanceTo.balance.plus(event.params.value);
  tokenBalanceTo.lastBlock = event.block.number;
  tokenBalanceTo.save();
}

export function handlerRedeem(event: Redeem): void {
  let redeemerId = `${event.address.toHex()}-${event.params.redeemer.toHex()}`;
  let tokenBalanceRedeemer = OptionTokenBalance.load(redeemerId);

  if (tokenBalanceRedeemer == null) return;

  tokenBalanceRedeemer.redeemed = true;
  tokenBalanceRedeemer.save();
}

export function handlerExecuted(event: Executed): void {

  const id = `${event.params.optionAddress}`;

  let entity = new OptionExecuted(id);
  entity.optionId = event.params.optionId;
  entity.optionName = event.params.optionName;
  entity.optionAddress = event.params.optionAddress;
  entity.roundId = event.params.roundID;
  entity.blockTimestamp = event.block.timestamp;

  entity.save();
}
