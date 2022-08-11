import { BigInt } from "@graphprotocol/graph-ts"
import { KiOracle } from "../generated/schema";
import {PriceUpdate} from "../generated/KiOracle/OracleMock";

export function handlePriceUpdate(event: PriceUpdate): void {
  let entity = KiOracle.load(event.params.roundId.toString());
  if (!entity){
    entity = new KiOracle(event.params.roundId.toString())
  }
  entity.timestamp = event.params.timestamp;
  entity.price = event.params.price
  entity.save();
}