/** Existing numeric status IDs are preserved for compatibility with older orders. */
const courierOnlyStatuses = [1, 2, 6];

export function orderStatusSteps(order: { source?: "web" | "pos"; fulfillment?: "delivery" | "dropoff"; status: number }, count: number) {
  const start = order.source === "pos" ? 3 : 0;
  return Array.from({ length: count }, (_, index) => index).filter((index) =>
    index >= start && (order.fulfillment !== "dropoff" || !courierOnlyStatuses.includes(index) || index === order.status),
  );
}

export function canSelectOrderStatus(order: { fulfillment?: "delivery" | "dropoff"; status: number }, next: number) {
  return next >= order.status && (order.fulfillment !== "dropoff" || !courierOnlyStatuses.includes(next) || next === order.status);
}
