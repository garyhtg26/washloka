import "server-only";
import type { Firestore } from "firebase-admin/firestore";
import {
  branchAliases,
  branchSchema,
  activeBranchIds,
  DEFAULT_BRANCH,
  sameBranch,
} from "./branches";
import { readBranchSettings, readStoreBankSettings } from "./branch-settings";
import { db, firebaseReady } from "./firebase/admin";
import { siteContent } from "./site-content";
import { defaultStore } from "./defaults";
import { canManageStore, type Identity } from "./firebase/access";
import type { Order, Store } from "./types";
import { bankDetails, safeManualSummary } from "./payments/manual-policy";
import { catalogForBranch, normalizeServices } from "./catalog";
import { brandCopy } from "./brand-copy";
export async function readStore(
  user: Identity | null,
  requestedBranch: string = DEFAULT_BRANCH,
  connection?: Firestore,
): Promise<Store> {
  const branch = branchSchema.parse(requestedBranch);
  if (!connection && !firebaseReady())
    return {
      ...defaultStore,
      branchId: branch,
      services: catalogForBranch(branch),
      ...(branch === "buzzwash"
        ? {
            promo: {
              ...defaultStore.promo,
              title: "BuzzWash",
              description: "Layanan laundry BuzzWash",
              code: "",
            },
            content: siteContent(),
          }
        : {}),
      configured: false,
      isAdmin: false,
      allowedBranches: [],
      paymentEnabled: false,
      orderingEnabled: false,
    };
  const database = connection ?? db();
  const settings = await readBranchSettings(database, branch);
  const data: Partial<Store> = settings.exists
    ? settings.data()!
    : branch === "buzzwash"
      ? { services: catalogForBranch(branch) }
      : defaultStore;
  const defaultPromo =
    branch === "buzzwash"
      ? {
          ...defaultStore.promo,
          title: "BuzzWash",
          description: "Layanan laundry BuzzWash",
          code: "",
        }
      : defaultStore.promo;
  const promo = { ...defaultPromo, ...data.promo };
  let orders: Order[] = [];
  let hasMore = false;
  const isStoreAdmin = canManageStore(user, branch);
  const allowedBranches = activeBranchIds.filter((id) => canManageStore(user, id));
  let profile = { name: user?.name || "", phone: "", email: user?.email || "" };
  if (user) {
    const q = isStoreAdmin
      ? database
          .collection("orders")
          .where("branchId", "in", [...branchAliases(branch)])
      : database
          .collection("orders")
          .where("uid", "==", user.uid)
          .orderBy("createdAt", "desc");
    const [snap, p] = await Promise.all([
      isStoreAdmin ? q.get() : q.limit(501).get(),
      database.doc(`users/${user.uid}`).get(),
    ]);
    const storeOrders = snap.docs.filter((doc) =>
      sameBranch(doc.get("branchId"), branch),
    );
    hasMore = storeOrders.length > 500;
    orders = [...storeOrders]
      .sort((a, b) =>
        String(b.get("createdAt")).localeCompare(String(a.get("createdAt"))),
      )
      .slice(0, 500)
      .map((d) => {
        const o = d.data() as Order;
        const { photoPath, ...rest } = o;
        return {
          ...rest,
          ...(o.manualPayment
            ? { manualPayment: safeManualSummary(o.manualPayment) }
            : {}),
          photo: photoPath ? `/api/orders/${o.id}/photo` : "",
        };
      });
    if (p.exists)
      profile = {
        name: p.get("name") || profile.name,
        phone: p.get("phone") || "",
        email: profile.email,
      };
  }
  const bank = bankDetails(await readStoreBankSettings(database, branch), branch);
  return {
    branchId: branch,
    services: normalizeServices(data.services, branch),
    content: siteContent(data.content),
    promo: {
      ...promo,
      title:
        branch === "buzzwash"
          ? promo.title
          : brandCopy(promo.title, defaultStore.promo.title),
      description:
        branch === "buzzwash"
          ? promo.description
          : brandCopy(promo.description, defaultStore.promo.description),
      button:
        typeof promo.button === "string"
          ? branch === "buzzwash"
            ? promo.button
            : brandCopy(promo.button)
          : undefined,
    },
    orders,
    configured: true,
    isAdmin: isStoreAdmin,
    allowedBranches,
    canManageUsers: !!user?.manageUsers && isStoreAdmin,
    role: isStoreAdmin ? user?.role || "customer" : "customer",
    profile,
    hasMore,
    paymentEnabled: false,
    orderingEnabled: branch !== "buzzwash" || bank.configured,
    bank,
  };
}
