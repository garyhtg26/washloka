import type { TrackingOrder } from "./types";

function revision(order: TrackingOrder): number {
  return Number.isSafeInteger(order.paymentRevision) && (order.paymentRevision ?? -1) >= 0
    ? order.paymentRevision!
    : 0;
}

/** Never replace an already received tracking snapshot with an older one. */
export function acceptTrackingSnapshot(previous: TrackingOrder | null, incoming: TrackingOrder): TrackingOrder {
  return previous && previous.id === incoming.id && revision(previous) > revision(incoming)
    ? previous
    : incoming;
}

/** Compare only snapshots of the same order; ties keep the public tracking view. */
export function preferOwnerTracking(publicOrder: TrackingOrder | null, ownerOrder: TrackingOrder | undefined): TrackingOrder | undefined {
  if (!publicOrder) return ownerOrder;
  return ownerOrder && ownerOrder.id === publicOrder.id && revision(ownerOrder) > revision(publicOrder)
    ? ownerOrder
    : publicOrder;
}
