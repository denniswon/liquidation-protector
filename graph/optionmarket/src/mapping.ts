import { OrderCreated, OrderStatusChanged } from '../generated/OptionMarket/OptionMarket'
import { Order, MarketInfo } from '../generated/schema'
import {BigInt} from "@graphprotocol/graph-ts";

export function handleOrderCreated(event: OrderCreated): void {
  let order = new Order(event.params.orderId.toString());
  order.creator = event.params.creator;
  order.underlying = event.params.underlyingAsset;
  order.collateral = event.params.collateralAsset;
  order.multiplier = event.params.quantity;
  order.barrierPrice = event.params.barrierPrice;
  order.expiry = event.params.expiry;
  order.isUp = event.params.isUp;
  order.premium = event.params.premium;
  order.orderNonce = event.params.orderNonce;
  order.orderStatus = new BigInt(1);
  order.save()

  let marketTotalInfo = MarketInfo.load('info');
  if (marketTotalInfo == null) {
    marketTotalInfo = new MarketInfo('info');
    marketTotalInfo.totalOpenOrderCount = 0
  }
  marketTotalInfo.totalOpenOrderCount =  marketTotalInfo.totalOpenOrderCount + 1;
  marketTotalInfo.save();
}

export function handleOrderStatusChanged(event: OrderStatusChanged): void {
  let id = event.params.orderId.toString();
  let order = Order.load(id);
  if (order == null) {
    order = new Order(id);
    order.orderStatus = event.params.orderStatus;
    order.save();
    return;
  }
  order.orderStatus = event.params.orderStatus;
  order.save();

  if (order.orderStatus.toU64() === 2 || order.orderStatus.toU64() === 3){
     let marketTotalInfo = MarketInfo.load('info');
    if (marketTotalInfo == null) {
      marketTotalInfo = new MarketInfo('info');
      marketTotalInfo.totalOpenOrderCount = 0
    }
    marketTotalInfo.totalOpenOrderCount = marketTotalInfo.totalOpenOrderCount - 1;
    marketTotalInfo.save();
  }
}