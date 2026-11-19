import type { Order } from "./types";

type IncomingOrder = Pick<Order, "id" | "source" | "status">;

/** Remember every observed ID, while announcing only newly arrived web orders. */
export function findNewIncomingOrders<T extends IncomingOrder>(orders: T[], seen: Set<string>): T[] {
  const incoming = orders.filter((order) =>
    !seen.has(order.id) && order.source === "web" && order.status === 0,
  );
  for (const order of orders) seen.add(order.id);
  return incoming;
}
