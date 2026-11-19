import type { Order } from "./types";

type BillingState = Pick<
  Order,
  "status" | "fulfillment" | "actualKg" | "shippingFee" | "quantityPending" | "pricePending"
> & { source?: Order["source"] };

/** Whether the store has supplied everything needed to make a customer bill final. */
export function isOrderReadyForBilling(order: BillingState): boolean {
  if (
    order.quantityPending ||
    order.pricePending ||
    order.actualKg === null ||
    !Number.isFinite(order.actualKg) ||
    order.actualKg <= 0 ||
    order.shippingFee === null ||
    !Number.isSafeInteger(order.shippingFee) ||
    order.shippingFee < 0
  ) return false;

  // The new flow uses fulfillment; old web orders and POS retain their old rules.
  if (order.source !== "pos" && order.fulfillment) {
    return order.status >= (order.fulfillment === "dropoff" ? 3 : 1);
  }
  return true;
}
