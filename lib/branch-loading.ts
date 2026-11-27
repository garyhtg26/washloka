import type { BranchId } from "./branches";
import { acceptOrderSnapshot } from "./tracking-freshness";
import type { Store } from "./types";

type Requester = (url: string, init?: RequestInit) => Promise<Response>;

const DEFAULT_TIMEOUT_MS = 12_000;

export function acceptStoreSnapshot(previous: Store | null, incoming: Store): Store {
  if (!previous || previous.branchId !== incoming.branchId || previous.isAdmin !== incoming.isAdmin)
    return incoming;

  const previousOrders = new Map(previous.orders.map((order) => [order.id, order]));
  return {
    ...incoming,
    orders: incoming.orders.map((order) => acceptOrderSnapshot(previousOrders.get(order.id) ?? null, order)),
  };
}

export async function requestBranchStore(
  request: Requester,
  branch: BranchId,
  signal?: AbortSignal,
  timeoutMs = DEFAULT_TIMEOUT_MS,
) {
  const controller = new AbortController();
  let timedOut = false;
  const abortFromParent = () => controller.abort(signal?.reason);
  if (signal?.aborted) abortFromParent();
  else signal?.addEventListener("abort", abortFromParent, { once: true });

  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timedOutRequest = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
      reject(
        new Error(
          "Koneksi belum merespons. Periksa internet lalu coba lagi.",
        ),
      );
    }, timeoutMs);
  });

  try {
    const loading = async () => {
      const response = await request(`/api/store?branch=${branch}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok)
        throw new Error("Data toko belum bisa dimuat. Coba lagi.");
      return response.json();
    };
    return await Promise.race([loading(), timedOutRequest]);
  } catch (error) {
    if (timedOut) {
      throw new Error(
        "Koneksi belum merespons. Periksa internet lalu coba lagi.",
      );
    }
    throw error;
  } finally {
    if (timeout) clearTimeout(timeout);
    signal?.removeEventListener("abort", abortFromParent);
  }
}
