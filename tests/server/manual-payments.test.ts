import test from "node:test";
import assert from "node:assert/strict";
import type { DocumentReference, Firestore } from "firebase-admin/firestore";
import type { Order } from "../../lib/types";
import type { Identity } from "../../lib/firebase/access";
import {
  bankDetails,
  bankSettingsSchema,
  isStaticQrisAccount,
  manualLocked,
  safeManualSummary,
  STATIC_QRIS_ID,
  STATIC_QRIS_URL,
} from "../../lib/payments/manual-policy";
import { saveBankDetails, setBankQr } from "../../lib/payments/bank-service";
import {
  selectManualPayment,
  storeManualProof,
  submitManualPayment,
  reviewManualPayment,
  confirmManualPayment,
} from "../../lib/payments/manual-service";
import { createPayment, paymentView, type Gateway } from "../../lib/payments/service";
import { publicTracking } from "../../lib/tracking-data";
import { prepareEarn, redeemPoints } from "../../lib/loyalty";
import { redeemMembership, reviewDeposit } from "../../lib/membership";
import {
  membershipProofPath,
  storeMembershipProof,
  submitMembershipDeposit,
} from "../../lib/membership-proof";
import { confirmPosCash } from "../../lib/payments/pos-cash";
import { finalAmount } from "../../lib/payments/policy";
import { isRewardsStore } from "../../lib/rewards-store";
import { prepareRewardIntent, commitRewardIntent } from "../../lib/reward-intent";
import type { Transaction } from "firebase-admin/firestore";

process.env.MIDTRANS_SERVER_KEY = "SB-Mid-server-unit-test-not-a-real-key";
process.env.MIDTRANS_IS_PRODUCTION = "false";
process.env.MIDTRANS_QRIS_ENABLED = "true";
delete process.env.MIDTRANS_MERCHANT_ID;

const account = {
  bankName: "BCA",
  accountNumber: "6560655132",
  accountHolder: "NOVEL RUSPANDI",
};
const owner: Identity = {
  uid: "owner",
  email: "owner@example.test",
  name: "Owner",
  admin: true,
  manageUsers: true,
  role: "owner",
};
const staff: Identity = {
  ...owner,
  uid: "staff",
  manageUsers: false,
  role: "staff",
};
const customer: Identity = {
  ...owner,
  uid: "customer",
  admin: false,
  manageUsers: false,
  role: "customer",
};
const order = (): Order => ({
  id: "DF-ABCDEF123456",
  token: "c7ab13d3-610d-4af1-9d05-79a4c0ef6b18",
  uid: "customer",
  branchId: "cinere",
  name: "Test",
  phone: "+6281200000000",
  service: "wash",
  kg: 10,
  actualKg: 10,
  express: false,
  address: "Private test address",
  lat: -6,
  lng: 106,
  date: "2026-10-30",
  slot: "09.00–12.00",
  notes: "Private",
  photo: "",
  status: 3,
  paid: false,
  shippingFee: 0,
  total: 20000,
  unitPrice: 2000,
  washPrice: 2000,
  source: "web",
  createdAt: new Date().toISOString(),
  history: [],
});

test("BuzzWash starting prices cannot be paid before store confirmation", () => {
  const pending = { ...order(), branchId: "buzzwash", service: "karpet-kecil", unit: "pcs", kg: 1, actualKg: 1, pricingVersion: 2 as const, unitPrice: 35000, total: 35000, startingAt: true, pricePending: true };
  assert.equal(finalAmount(pending), null);
  assert.equal(finalAmount({ ...pending, pricePending: false }), 35000);
});

test("BuzzWash fixed package remains a fixed charge after weighing", () => {
  const value = { ...order(), branchId: "buzzwash", service: "wash", kg: 4, actualKg: 8, pricingVersion: 2 as const, pricingModel: "flat-package" as const, unitPrice: 35000, total: 35000 };
  assert.equal(finalAmount(value), 35000);
});

class MemoryDatabase {
  values = new Map<string, Record<string, unknown>>();
  private queue = Promise.resolve();
  constructor(value = order()) {
    this.values.set(`orders/${value.id}`, structuredClone(value));
    this.values.set("settings/cinere", {
      manualPayment: account,
      promo: { active: true },
    });
  }
  doc(path: string) {
    return { path, get: async () => this.snapshot(path) };
  }
  snapshot(path: string) {
    const value = this.values.get(path);
    return {
      exists: value !== undefined,
      ref: this.doc(path),
      data: () => (value ? structuredClone(value) : undefined),
      get: (key: string) => value?.[key],
    };
  }
  async runTransaction<T>(callback: (tx: unknown) => Promise<T>) {
    const prior = this.queue;
    let release!: () => void;
    this.queue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await prior;
    let writing = false;
    const writes: (() => void)[] = [];
    const tx = {
      get: async (ref: { path: string }) => {
        assert.equal(writing, false, "Firestore reads must precede writes");
        return this.snapshot(ref.path);
      },
      set: (
        ref: { path: string },
        value: Record<string, unknown>,
        options?: { merge?: boolean },
      ) => {
        writing = true;
        writes.push(() =>
          this.values.set(
            ref.path,
            options?.merge
              ? { ...this.values.get(ref.path), ...structuredClone(value) }
              : structuredClone(value),
          ),
        );
      },
      update: (ref: { path: string }, value: Record<string, unknown>) => {
        writing = true;
        writes.push(() => {
          assert.equal(this.values.has(ref.path), true);
          this.values.set(ref.path, {
            ...this.values.get(ref.path),
            ...structuredClone(value),
          });
        });
      },
      create: (ref: { path: string }, value: Record<string, unknown>) => {
        writing = true;
        writes.push(() => {
          assert.equal(this.values.has(ref.path), false);
          this.values.set(ref.path, structuredClone(value));
        });
      },
      delete: (ref: { path: string }) => {
        writing = true;
        writes.push(() => this.values.delete(ref.path));
      },
    };
    try {
      const result = await callback(tx);
      writes.forEach((write) => write());
      return result;
    } finally {
      release();
    }
  }
  firestore() {
    return this as unknown as Firestore;
  }
  current() {
    return this.values.get(`orders/${order().id}`) as unknown as Order;
  }
}
const upload = async () => {};

// Exercise the final-price transaction, including Firestore's read-before-write
// constraint and a retry after the order has already been finalized.
async function applyRewardIntent(database: MemoryDatabase, id: string, service: number, shipping: number) {
  return database.runTransaction(async (raw) => {
    const tx = raw as Transaction;
    const ref = database.doc(`orders/${id}`) as unknown as DocumentReference;
    const snapshot = await tx.get(ref);
    const value = snapshot.data() as Order;
    const plan = await prepareRewardIntent(tx, database.firestore(), value, service, shipping);
    if (!plan) return null;
    const fields = commitRewardIntent(tx, database.firestore(), value, plan, "2026-11-13T00:00:00.000Z");
    tx.update(ref, fields);
    return fields;
  });
}

test("scheduled rewards spend membership first and do not cover shipping or insurance", async () => {
  const value = { ...order(), membershipDiscount: true, usePoints: true, useMembershipBalance: true, insurance: true };
  const database = new MemoryDatabase(value);
  database.values.set("loyalty/customer", { balance: 5000 });
  database.values.set("memberships/customer", { active: true, balance: 20000 });
  const result = await applyRewardIntent(database, value.id, 16000, 1000);
  assert.equal(result?.pointsUsed, 0);
  assert.equal(result?.membershipUsed, 16000);
  assert.equal(result?.total, 2000);
  assert.equal(result?.paid, false);
  assert.equal(database.values.get("loyalty/customer")?.balance, 5000);
  assert.equal(database.values.get("memberships/customer")?.balance, 4000);
});

test("new customer orders apply membership exactly once after status and weight arrive in either order", async () => {
  for (const fulfillment of ["delivery", "dropoff"] as const) {
    for (const weightFirst of [true, false]) {
      const value: Order = { ...order(), fulfillment, status: 0, actualKg: null,
        quantityPending: true, membershipDiscount: true, useMembershipBalance: true };
      const database = new MemoryDatabase(value);
      database.values.set("memberships/customer", { active: true, balance: 16000 });
      database.values.set("loyalty/customer", { balance: 0 });
      const path = `orders/${value.id}`;
      const readyStatus = fulfillment === "delivery" ? 1 : 3;
      const intermediate = weightFirst
        ? { ...value, actualKg: 10, quantityPending: false }
        : { ...value, status: readyStatus };
      database.values.set(path, intermediate);
      assert.equal(await applyRewardIntent(database, value.id, 16000, 0), null);
      assert.equal(database.values.get("memberships/customer")?.balance, 16000);
      database.values.set(path, { ...intermediate, status: readyStatus, actualKg: 10, quantityPending: false });
      const result = await applyRewardIntent(database, value.id, 16000, 0);
      assert.equal(result?.membershipUsed, 16000);
      assert.equal(result?.paid, true);
      assert.equal(database.values.get("memberships/customer")?.balance, 0);
      assert.equal(database.values.get("loyalty/customer")?.balance, 1600);
      assert.equal(await applyRewardIntent(database, value.id, 16000, 0), null);
      assert.equal(database.values.get("loyalty/customer")?.balance, 1600);
    }
  }
});

test("manual payment and points stay unavailable until the new customer order is confirmed", async () => {
  const value: Order = { ...order(), fulfillment: "delivery", status: 0 };
  const database = new MemoryDatabase(value);
  database.values.set("loyalty/customer", { balance: 5000 });
  await assert.rejects(() => selectManualPayment(value.id, database.firestore()));
  await assert.rejects(() => redeemPoints(database.firestore(), "customer", value.id, 1000));
  // Even an existing draft bank selection cannot bypass the upload/submission gate.
  database.values.set(`orders/${value.id}`, { ...value, manualPayment: {
    method: "bank_transfer", status: "unpaid", amount: null, hasProof: false, bank: account,
  } });
  await assert.rejects(() => storeManualProof(value.id, new Uint8Array([1]), database.firestore(), upload));
  await assert.rejects(() => submitManualPayment(value.id, "proof-version", database.firestore()));
  database.values.set(`orders/${value.id}`, { ...value, status: 1 });
  await redeemPoints(database.firestore(), "customer", value.id, 1000);
  assert.equal(database.current().pointsUsed, 1000);
});

test("scheduled rewards use available balances when funds changed since ordering", async () => {
  const value = { ...order(), membershipDiscount: true, usePoints: true, useMembershipBalance: true };
  const database = new MemoryDatabase(value);
  database.values.set("loyalty/customer", { balance: 2000 });
  database.values.set("memberships/customer", { active: true, balance: 3000 });
  const result = await applyRewardIntent(database, value.id, 16000, 0);
  assert.equal(result?.pointsUsed, 2000);
  assert.equal(result?.membershipUsed, 3000);
  assert.equal(result?.total, 11000);
  assert.equal(result?.paid, false);
});

test("deferred rewards never exceed the balances shown at checkout", async () => {
  const value = { ...order(), membershipDiscount: true, usePoints: true,
    useMembershipBalance: true, membershipLimit: 3000, pointsLimit: 2000 };
  const database = new MemoryDatabase(value);
  database.values.set("loyalty/customer", { balance: 9000 });
  database.values.set("memberships/customer", { active: true, balance: 15000 });
  const result = await applyRewardIntent(database, value.id, 16000, 0);
  assert.equal(result?.membershipUsed, 3000);
  assert.equal(result?.pointsUsed, 2000);
  assert.equal(result?.total, 11000);
});

test("full settlement awards loyalty once, including on a repeated finalization", async () => {
  const value = { ...order(), membershipDiscount: true, usePoints: true, useMembershipBalance: true };
  const database = new MemoryDatabase(value);
  database.values.set("loyalty/customer", { balance: 2000 });
  database.values.set("memberships/customer", { active: true, balance: 14000 });
  const result = await applyRewardIntent(database, value.id, 16000, 0);
  assert.equal(result?.paid, true);
  assert.equal(result?.total, 0);
  assert.equal(result?.pointsEarned, 1400);
  assert.equal(database.values.get("loyalty/customer")?.balance, 1400);
  assert.equal(database.values.get("memberships/customer")?.balance, 0);
  assert.equal(await applyRewardIntent(database, value.id, 16000, 0), null);
  assert.equal(database.values.get("loyalty/customer")?.balance, 1400);
  assert.equal(database.values.get("memberships/customer")?.balance, 0);
});

test("concurrent scheduled rewards cannot spend one member balance twice", async () => {
  const first = { ...order(), membershipDiscount: true, useMembershipBalance: true };
  const second = { ...first, id: "DF-SECOND12345" };
  const database = new MemoryDatabase(first);
  database.values.set(`orders/${second.id}`, structuredClone(second));
  database.values.set("memberships/customer", { active: true, balance: 10000 });
  const [a, b] = await Promise.all([
    applyRewardIntent(database, first.id, 10000, 1000),
    applyRewardIntent(database, second.id, 10000, 1000),
  ]);
  assert.equal((a?.membershipUsed || 0) + (b?.membershipUsed || 0), 10000);
  assert.equal(database.values.get("memberships/customer")?.balance, 0);
});

test("scheduled rewards do not spend wallets requiring reconciliation", async () => {
  const value = { ...order(), membershipDiscount: true, usePoints: true, useMembershipBalance: true };
  const database = new MemoryDatabase(value);
  database.values.set("loyalty/customer", { balance: 5000, reconciliationRequired: true });
  database.values.set("memberships/customer", { active: true, balance: 5000, reconciliationRequired: true });
  const result = await applyRewardIntent(database, value.id, 16000, 0);
  assert.equal(result?.pointsUsed, 0);
  assert.equal(result?.membershipUsed, 0);
  assert.equal(result?.total, 16000);
  const other = { ...value, id: "DF-OTHER12345", branchId: "buzzwash" };
  database.values.set(`orders/${other.id}`, other);
  const otherResult = await applyRewardIntent(database, other.id, 16000, 0);
  assert.equal(otherResult?.pointsUsed, 0);
  assert.equal(otherResult?.membershipUsed, 0);
  assert.equal(database.values.get("loyalty/customer")?.balance, 5000);
  assert.equal(database.values.get("memberships/customer")?.balance, 5000);
});
test("shared rewards support both stores and D’Fable historical aliases", () => {
  assert.equal(isRewardsStore("dfablelaundry"), true);
  assert.equal(isRewardsStore("cinere"), true);
  assert.equal(isRewardsStore("bogor"), true);
  assert.equal(isRewardsStore("buzzwash"), true);
  assert.equal(isRewardsStore("unknown"), false);
});

test("BuzzWash orders can redeem and earn shared points and membership", async () => {
  const value = { ...order(), branchId: "buzzwash", membershipDiscount: true, total: 16000 };
  const database = new MemoryDatabase(value);
  database.values.set("loyalty/customer", { balance: 5000 });
  database.values.set("memberships/customer", {
    active: true,
    balance: 100000,
  });
  await redeemPoints(database.firestore(), "customer", value.id, 1000);
  await redeemMembership(database.firestore(), "customer", value.id, 1000);
  const earned = await database.runTransaction(async (tx) =>
    prepareEarn(tx as Transaction, database.firestore(), database.current()));
  assert.ok(earned && earned.points > 0);
  assert.equal(database.values.get("loyalty/customer")?.balance, 4000);
  assert.equal(database.values.get("memberships/customer")?.balance, 99000);
  assert.equal(database.current().paid, false);
});

test("only an authorized BuzzWash manager can confirm its deposit into the shared wallet", async () => {
  const database = new MemoryDatabase();
  const requestId = "73476a0d-2bdf-44ae-b4d8-f12af667cc2d";
  database.values.set("membershipDeposits/customer", {
    uid: "customer",
    requestId,
    amount: 100000,
    branchId: "buzzwash",
    status: "pending",
  });
  await assert.rejects(
    reviewDeposit(
      database.firestore(),
      { ...owner, role: "admin", allowedBranches: ["dfablelaundry"] },
      "customer",
      requestId,
      "confirm",
    ),
    /Akses khusus/,
  );
  assert.equal(database.values.has("memberships/customer"), false);
  await reviewDeposit(database.firestore(), { ...owner, role: "admin", allowedBranches: ["buzzwash"] }, "customer", requestId, "confirm");
  assert.equal(database.values.get("memberships/customer")?.balance, 100000);
  assert.equal(database.values.get("membershipDeposits/customer")?.status, "confirmed");
});

test("cash confirmation is restricted to staff for unpaid POS orders and is idempotent", async () => {
  const database = new MemoryDatabase({ ...order(), source: "pos", uid: null });
  await assert.rejects(
    confirmPosCash(order().id, customer, database.firestore()),
    /admin/,
  );
  await assert.rejects(
    confirmPosCash(order().id, staff, database.firestore(), 19999),
    /Tagihan berubah/,
  );
  await confirmPosCash(order().id, staff, database.firestore());
  const first = database.current();
  assert.equal(first.paid, true);
  assert.equal(first.paymentMethod, "cash");
  assert.ok(first.paidAt);
  await confirmPosCash(order().id, staff, database.firestore());
  assert.equal(database.current().paymentRevision, first.paymentRevision);
  const web = new MemoryDatabase();
  await assert.rejects(
    confirmPosCash(order().id, staff, web.firestore()),
    /kasir/,
  );
  const pending = new MemoryDatabase({
    ...order(),
    source: "pos",
    uid: null,
    manualPayment: {
      method: "bank_transfer",
      status: "awaiting_review",
      amount: 20000,
      hasProof: true,
    },
  });
  await assert.rejects(
    confirmPosCash(order().id, staff, pending.firestore()),
    /diperiksa/,
  );
});
test("linked POS members alone can redeem their points and balance and earn once on cash settlement", async () => {
  const database = new MemoryDatabase({
    ...order(),
    source: "pos",
    membershipDiscount: true,
    total: 16000,
  });
  database.values.set("loyalty/customer", { balance: 5000 });
  database.values.set("memberships/customer", {
    active: true,
    balance: 100000,
  });
  await assert.rejects(
    redeemPoints(database.firestore(), "other", order().id, 1000),
    /pesanan sendiri/,
  );
  await assert.rejects(
    redeemMembership(database.firestore(), "other", order().id, 2000),
    /pesanan sendiri/,
  );
  await redeemPoints(database.firestore(), "customer", order().id, 1000);
  await redeemMembership(database.firestore(), "customer", order().id, 2000);
  assert.equal(database.current().total, 13000);
  await confirmPosCash(order().id, staff, database.firestore(), 13000);
  await confirmPosCash(order().id, staff, database.firestore(), 13000);
  assert.equal(database.current().pointsEarned, 1500);
  assert.equal(database.values.get("loyalty/customer")?.balance, 5500);
  assert.equal(database.values.get("memberships/customer")?.balance, 98000);
});
async function proof(database: MemoryDatabase) {
  await selectManualPayment(order().id, database.firestore());
  const view = await storeManualProof(
    order().id,
    new Uint8Array([1]),
    database.firestore(),
    upload,
  );
  return view.manual!.proofVersion!;
}
function installLegacyPaymentSnapshot(database: MemoryDatabase) {
  const settings = database.values.get("settings/cinere")?.manualPayment as {
    version?: string;
    qrVersion: string;
  };
  assert.ok(settings.qrVersion);
  database.values.set(`orders/${order().id}`, {
    ...database.current(),
    manualPayment: {
      method: "bank_transfer",
      status: "unpaid",
      amount: null,
      hasProof: false,
      bank: { ...account, version: settings.version, qrVersion: settings.qrVersion },
    },
  });
}
async function submitted(database: MemoryDatabase) {
  const version = await proof(database);
  await submitManualPayment(order().id, version, database.firestore());
  return version;
}

test("default bank has no fabricated usable account and account input is validated", () => {
  assert.deepEqual(bankDetails(undefined, "cinere"), {
    bankName: "BCA",
    accountNumber: "",
    accountHolder: "",
    configured: false,
  });
  assert.equal(
    bankSettingsSchema.safeParse({ ...account, accountNumber: "abc" }).success,
    false,
  );
  assert.equal(
    bankSettingsSchema.safeParse({ ...account, qrUrl: "https://evil.test" })
      .success,
    false,
  );
});

test("only BuzzWash offers manual QRIS while both shops offer the approved bank transfer", async () => {
  const approved = { bankName: "BCA", accountNumber: "6560655132", accountHolder: "Novel Ruspandi" };
  assert.equal(isStaticQrisAccount(approved), true);
  for (const branch of ["dfablelaundry", "cinere", "bogor", "buzzwash"] as const) {
    const value = { ...order(), branchId: branch };
    const database = new MemoryDatabase(value);
    const settingsId = branch === "buzzwash" ? "buzzwash" : "cinere";
    database.values.set(`settings/${settingsId}`, { manualPayment: approved });
    const before = await paymentView(value, database.firestore());
    assert.equal(before.staticQrisAvailable, branch === "buzzwash");
    assert.equal(before.bank.qrUrl, undefined);
    const bank = await selectManualPayment(value.id, database.firestore(), "bank");
    assert.equal(bank.manual?.bank?.staticQrId, undefined);
    assert.equal(bank.bank.accountNumber, approved.accountNumber);
    if (branch !== "buzzwash") {
      await assert.rejects(selectManualPayment(value.id, database.firestore(), "manual-qris"), /hanya tersedia untuk BuzzWash/);
      assert.deepEqual(database.current().manualPayment, bank.manual);
      continue;
    }
    const selected = await selectManualPayment(value.id, database.firestore(), "manual-qris");
    assert.equal(selected.manual?.bank?.staticQrId, STATIC_QRIS_ID);
    assert.equal(selected.bank.qrUrl, STATIC_QRIS_URL);
    database.values.set(`settings/${settingsId}`, { manualPayment: account });
    const after = await paymentView(database.current(), database.firestore());
    assert.equal(after.bank.accountNumber, approved.accountNumber);
    assert.equal(after.bank.qrUrl, STATIC_QRIS_URL);
    await storeManualProof(value.id, new Uint8Array([1]), database.firestore(), upload);
    assert.equal(database.current().manualPayment?.bank?.staticQrId, STATIC_QRIS_ID);
    await assert.rejects(selectManualPayment(value.id, database.firestore(), "bank"), /setelah bukti diunggah/);
  }
});

test("D’Fable QRIS orders can still submit existing payments or switch to bank before uploading proof", async () => {
  const value: Order = { ...order(), manualPayment: {
    method: "bank_transfer", status: "unpaid", amount: null, hasProof: false,
    bank: { ...account, staticQrId: STATIC_QRIS_ID },
  } };
  const database = new MemoryDatabase(value);
  const view = await paymentView(value, database.firestore());
  assert.equal(view.staticQrisAvailable, false);
  assert.equal(view.bank.qrUrl, undefined);
  await assert.rejects(selectManualPayment(value.id, database.firestore(), "manual-qris"), /hanya tersedia untuk BuzzWash/);

  const draft = await storeManualProof(value.id, new Uint8Array([1]), database.firestore(), upload);
  const submitted = await submitManualPayment(value.id, draft.manual!.proofVersion!, database.firestore());
  assert.equal(submitted.manual?.status, "awaiting_review");
  assert.equal(submitted.manual?.bank?.staticQrId, STATIC_QRIS_ID);
  assert.equal(submitted.bank.qrUrl, undefined);

  const other = new MemoryDatabase(value);
  const switched = await selectManualPayment(value.id, other.firestore(), "bank");
  assert.equal(switched.manual?.bank?.staticQrId, undefined);
  assert.equal(switched.bank.accountNumber, account.accountNumber);
});

test("new selections never inherit a QR previously uploaded to store settings", async () => {
  for (const method of [undefined, "bank", "manual-qris"] as const) {
    const database = new MemoryDatabase({ ...order(), branchId: "buzzwash" });
    database.values.set("settings/buzzwash", { manualPayment: account });
    await setBankQr("buzzwash", new Uint8Array([1]), owner, database.firestore(), upload);
    const before = await paymentView(database.current(), database.firestore());
    assert.equal(before.bank.qrUrl, undefined);
    const selected = await selectManualPayment(order().id, database.firestore(), method);
    assert.equal(selected.manual?.bank?.qrVersion, undefined);
    assert.equal(selected.bank.qrUrl, method === "manual-qris" ? STATIC_QRIS_URL : undefined);
  }
});

test("static QRIS is unavailable for another account and existing QR snapshots remain unchanged", async () => {
  const buzzwashOrder = { ...order(), branchId: "buzzwash" };
  const database = new MemoryDatabase(buzzwashOrder);
  database.values.set("settings/buzzwash", { manualPayment: { ...account, accountNumber: "1234567890" } });
  const before = await paymentView(database.current(), database.firestore());
  assert.equal(before.staticQrisAvailable, false);
  assert.equal(before.bank.configured, false);
  assert.equal(before.bank.accountNumber, "");
  await assert.rejects(selectManualPayment(order().id, database.firestore(), "manual-qris"), /rekening perlu diperiksa/);
  await assert.rejects(selectManualPayment(order().id, database.firestore(), "bank"), /rekening perlu diperiksa/);
  await assert.rejects(selectManualPayment(order().id, database.firestore()), /rekening perlu diperiksa/);
  assert.equal(database.current().manualPayment, undefined);

  const oldVersion = "bca7889e-3955-4ba3-8d4b-21d14b2b5171";
  const approved = { bankName: "BCA", accountNumber: "6560655132", accountHolder: "NOVEL RUSPANDI" };
  const value = { ...buzzwashOrder, manualPayment: { method: "bank_transfer" as const, status: "unpaid" as const, amount: null, hasProof: false, bank: { ...approved, qrVersion: oldVersion } } };
  const oldDatabase = new MemoryDatabase(value);
  oldDatabase.values.set("settings/buzzwash", { manualPayment: approved });
  const oldView = await selectManualPayment(value.id, oldDatabase.firestore());
  assert.equal(oldView.manual?.bank?.staticQrId, undefined);
  assert.match(oldView.bank.qrUrl!, new RegExp(oldVersion));
  assert.equal(oldView.staticQrisAvailable, true);
  const switchedQr = await selectManualPayment(value.id, oldDatabase.firestore(), "manual-qris");
  assert.equal(switchedQr.bank.qrUrl, STATIC_QRIS_URL);
  assert.equal(switchedQr.manual?.bank?.qrVersion, oldVersion);
  const switchedBack = await selectManualPayment(value.id, oldDatabase.firestore(), "bank");
  assert.match(switchedBack.bank.qrUrl!, new RegExp(oldVersion));
  assert.equal(switchedBack.manual?.bank?.staticQrId, undefined);

  const historicalBank = { ...approved, accountNumber: "1234567890", qrVersion: oldVersion };
  const historical = { ...buzzwashOrder, manualPayment: { method: "bank_transfer" as const, status: "unpaid" as const, amount: null, hasProof: true, bank: historicalBank } };
  const historicalDb = new MemoryDatabase(historical);
  const historicalView = await paymentView(historical, historicalDb.firestore());
  assert.equal(historicalView.bank.accountNumber, "1234567890");
  assert.match(historicalView.bank.qrUrl!, new RegExp(oldVersion));
  assert.equal(historicalView.staticQrisAvailable, false);
  await assert.rejects(selectManualPayment(historical.id, historicalDb.firestore(), "manual-qris"), /setelah bukti diunggah/);
});

test("a payment QR cannot be published before its bank account is complete", async () => {
  const database = new MemoryDatabase();
  database.values.set("settings/cinere", {
    manualPayment: {
      bankName: "BCA",
      accountNumber: "",
      accountHolder: "",
    },
  });
  let uploaded = false;
  await assert.rejects(
    setBankQr(
      "cinere",
      new Uint8Array([1]),
      owner,
      database.firestore(),
      async () => {
        uploaded = true;
      },
    ),
    /Simpan rekening yang lengkap/,
  );
  assert.equal(uploaded, false);
});

test("only owner/admin may edit bank and QR; legacy areas share the same store settings", async () => {
  const database = new MemoryDatabase();
  for (const user of [staff, customer, null]) {
    await assert.rejects(
      saveBankDetails("cinere", account, user, database.firestore()),
      /pemilik/,
    );
    await assert.rejects(
      setBankQr(
        "cinere",
        new Uint8Array([1]),
        user,
        database.firestore(),
        upload,
      ),
      /pemilik/,
    );
  }
  await saveBankDetails(
    "bogor",
    { ...account, accountNumber: "9876543210" },
    owner,
    database.firestore(),
  );
  assert.equal(
    (database.values.get("settings/cinere")?.manualPayment as typeof account)
      .accountNumber,
    "9876543210",
  );
  assert.equal(database.values.has("settings/bogor"), false);
  await saveBankDetails("cinere", account, owner, database.firestore());
  assert.deepEqual(database.values.get("settings/cinere")?.promo, {
    active: true,
  });
});

test("existing D’Fable snapshots retain archived QR references across later settings changes", async () => {
  const database = new MemoryDatabase();
  await setBankQr(
    "cinere",
    new Uint8Array([1]),
    owner,
    database.firestore(),
    upload,
  );
  installLegacyPaymentSnapshot(database);
  const selected = await selectManualPayment(order().id, database.firestore());
  await saveBankDetails(
    "cinere",
    { ...account, accountNumber: "9876543210" },
    owner,
    database.firestore(),
  );
  await setBankQr(
    "cinere",
    new Uint8Array([2]),
    owner,
    database.firestore(),
    upload,
  );
  const version = await proof(database);
  const view = await submitManualPayment(
    order().id,
    version,
    database.firestore(),
  );
  assert.equal(view.bank.accountNumber, selected.bank.accountNumber);
  assert.equal(view.bank.qrUrl, undefined);
  assert.ok(selected.manual?.bank?.qrVersion);
  assert.equal(view.manual?.bank?.qrVersion, selected.manual.bank.qrVersion);
  assert.equal(view.manual?.bank?.accountNumber, "6560655132");
  assert.equal(
    [...database.values.keys()].filter((key) =>
      key.startsWith("bankQrVersions/"),
    ).length,
    2,
  );
});

test("proof upload is a draft; explicit submission alone requests review and never marks paid", async () => {
  const database = new MemoryDatabase();
  const version = await proof(database);
  assert.equal(database.current().manualPayment?.status, "unpaid");
  assert.equal(database.current().paid, false);
  const revision = database.current().paymentRevision!;
  await submitManualPayment(order().id, version, database.firestore());
  await submitManualPayment(order().id, version, database.firestore());
  assert.equal(database.current().manualPayment?.status, "awaiting_review");
  assert.equal(manualLocked(database.current().manualPayment), true);
  assert.equal(database.current().paid, false);
  assert.equal(database.current().paymentRevision, revision + 1);
});

test("changing bank clears its current QR while existing payment snapshots retain the original", async () => {
  const database = new MemoryDatabase();
  await setBankQr(
    "cinere",
    new Uint8Array([1]),
    owner,
    database.firestore(),
    upload,
  );
  installLegacyPaymentSnapshot(database);
  const selected = await selectManualPayment(order().id, database.firestore());
  const updated = await saveBankDetails(
    "cinere",
    { ...account, accountNumber: "9876543210" },
    owner,
    database.firestore(),
  );
  assert.equal(updated.qrUrl, undefined);
  assert.equal(
    (
      database.values.get("settings/cinere")?.manualPayment as {
        qrVersion: string;
      }
    ).qrVersion,
    "",
  );
  assert.equal(selected.bank.qrUrl, undefined);
  assert.equal(database.current().manualPayment?.bank?.qrVersion, selected.manual?.bank?.qrVersion);
  assert.ok(selected.manual?.bank?.qrVersion);
});

test("stale account versions cannot upload QR and account changes during upload reject publication", async () => {
  const database = new MemoryDatabase();
  const initial = await saveBankDetails(
    "cinere",
    account,
    owner,
    database.firestore(),
  );
  let uploaded = 0;
  const storage = async () => {
    uploaded++;
  };
  await assert.rejects(
    setBankQr(
      "cinere",
      new Uint8Array([1]),
      owner,
      database.firestore(),
      storage,
      "stale",
    ),
    /Rekening telah berubah/,
  );
  assert.equal(uploaded, 0);
  const racingUpload = async () => {
    uploaded++;
    await saveBankDetails(
      "cinere",
      { ...account, accountNumber: "9876543210" },
      owner,
      database.firestore(),
    );
  };
  await assert.rejects(
    setBankQr(
      "cinere",
      new Uint8Array([1]),
      owner,
      database.firestore(),
      racingUpload,
      initial.version,
    ),
    /berubah saat QR/,
  );
  assert.equal(uploaded, 1);
  assert.equal(
    [...database.values.keys()].filter((key) =>
      key.startsWith("bankQrVersions/"),
    ).length,
    0,
  );
});

test("estimated orders may choose transfer but cannot submit before actual weight and shipping", async () => {
  const database = new MemoryDatabase({
    ...order(),
    actualKg: null,
    shippingFee: null,
  });
  const version = await proof(database);
  await assert.rejects(
    submitManualPayment(order().id, version, database.firestore()),
    /berat aktual/,
  );
  assert.equal(database.current().paid, false);
});

test("admin can confirm an observed bank transfer without a customer receipt", async () => {
  const database = new MemoryDatabase();
  await selectManualPayment(order().id, database.firestore());
  const view = await confirmManualPayment(
    order().id,
    staff,
    database.firestore(),
  );

  assert.equal(database.current().paid, true);
  assert.equal(database.current().manualPayment?.status, "paid");
  assert.equal(database.current().manualPayment?.hasProof, false);
  assert.equal(database.current().manualPayment?.amount, 20000);
  assert.equal(view.paid, true);
  const record = database.values.get(`manualPayments/${order().id}`)!;
  assert.equal(record.reviewedBy, staff.uid);
  assert.equal(record.proofPath, undefined);
});

test("review privileges, proof version, and exact submitted amount are enforced", async () => {
  const database = new MemoryDatabase();
  const version = await submitted(database);
  await assert.rejects(
    reviewManualPayment(
      order().id,
      version,
      "approve",
      "",
      customer,
      database.firestore(),
    ),
    /admin/,
  );
  await assert.rejects(
    reviewManualPayment(
      order().id,
      "stale",
      "approve",
      "",
      staff,
      database.firestore(),
    ),
    /berubah/,
  );
  database.values.set(`orders/${order().id}`, {
    ...database.current(),
    total: 1,
  });
  await assert.rejects(
    reviewManualPayment(
      order().id,
      version,
      "approve",
      "",
      staff,
      database.firestore(),
    ),
    /Tagihan berubah/,
  );
  assert.equal(database.current().paid, false);
});

test("approval is idempotent and a later rejection cannot undo settled manual payment", async () => {
  const database = new MemoryDatabase();
  const version = await submitted(database);
  await reviewManualPayment(
    order().id,
    version,
    "approve",
    "",
    staff,
    database.firestore(),
  );
  await reviewManualPayment(
    order().id,
    version,
    "approve",
    "",
    staff,
    database.firestore(),
  );
  await assert.rejects(
    reviewManualPayment(
      order().id,
      version,
      "reject",
      "wrong",
      owner,
      database.firestore(),
    ),
    /sudah diperiksa/,
  );
  assert.equal(database.current().paid, true);
  assert.equal(database.current().manualPayment?.status, "paid");
});

test("rejected proof requires a note and a genuinely new upload before resubmission", async () => {
  const database = new MemoryDatabase();
  const first = await submitted(database);
  await assert.rejects(
    reviewManualPayment(
      order().id,
      first,
      "reject",
      "",
      staff,
      database.firestore(),
    ),
    /alasan/,
  );
  await reviewManualPayment(
    order().id,
    first,
    "reject",
    "Bukti belum jelas",
    staff,
    database.firestore(),
  );
  await assert.rejects(
    submitManualPayment(order().id, first, database.firestore()),
    /sebelumnya ditolak/,
  );
  const second = (
    await storeManualProof(
      order().id,
      new Uint8Array([2]),
      database.firestore(),
      upload,
    )
  ).manual!.proofVersion!;
  assert.notEqual(second, first);
  assert.equal(database.current().manualPayment?.status, "unpaid");
  await submitManualPayment(order().id, second, database.firestore());
  await reviewManualPayment(
    order().id,
    second,
    "approve",
    "",
    staff,
    database.firestore(),
  );
  assert.equal(database.current().paid, true);
});

test("a stale uploaded receipt cannot be submitted after another tab uploads a new proof", async () => {
  const database = new MemoryDatabase();
  const first = await proof(database);
  const second = (
    await storeManualProof(
      order().id,
      new Uint8Array([2]),
      database.firestore(),
      upload,
    )
  ).manual!.proofVersion!;
  await assert.rejects(
    submitManualPayment(order().id, first, database.firestore()),
    /terbaru/,
  );
  await submitManualPayment(order().id, second, database.firestore());
});

test("upload quota is reserved before storage is called and review blocks proof replacement", async () => {
  const database = new MemoryDatabase();
  await selectManualPayment(order().id, database.firestore());
  let calls = 0;
  const storage = async () => {
    calls++;
  };
  database.values.set(`manualProofLimits/${order().id}`, {
    uploads: Array(12).fill(Date.now()),
  });
  await assert.rejects(
    storeManualProof(
      order().id,
      new Uint8Array([1]),
      database.firestore(),
      storage,
    ),
    /Terlalu banyak/,
  );
  assert.equal(calls, 0);
  database.values.delete(`manualProofLimits/${order().id}`);
  await submitted(database);
  await assert.rejects(
    storeManualProof(
      order().id,
      new Uint8Array([1]),
      database.firestore(),
      storage,
    ),
    /sedang diperiksa/,
  );
  assert.equal(calls, 0);
});

test("manual pending review blocks a second gateway charge and active gateway blocks transfer", async () => {
  const database = new MemoryDatabase();
  await submitted(database);
  const api: Gateway = {
    status: async () => null,
    create: async () => {
      throw Error("must not create");
    },
    expire: async () => {},
  };
  await assert.rejects(
    createPayment(order().id, database.firestore(), api),
    /diperiksa/,
  );
  const active = new MemoryDatabase({
    ...order(),
    payment: {
      provider: "midtrans",
      attemptId: "other",
      amount: 20000,
      status: "pending",
      environment: "sandbox",
      expiresAt: new Date().toISOString(),
    },
  });
  await assert.rejects(
    selectManualPayment(order().id, active.firestore()),
    /QRIS aktif/,
  );
});

test("safe order and tracking summaries never reveal receipt path or reviewer identity", async () => {
  const database = new MemoryDatabase();
  const version = await submitted(database);
  await reviewManualPayment(
    order().id,
    version,
    "approve",
    "",
    staff,
    database.firestore(),
  );
  const record = database.values.get(`manualPayments/${order().id}`)!;
  const summary = safeManualSummary(
    record as unknown as NonNullable<Order["manualPayment"]>,
  );
  assert.equal("proofPath" in summary, false);
  assert.equal("reviewedBy" in summary, false);
  const tracking = publicTracking({
    ...database.current(),
    manualPayment: record as unknown as NonNullable<Order["manualPayment"]>,
  });
  assert.equal("proofPath" in tracking.manualPayment!, false);
  assert.equal("reviewedBy" in tracking.manualPayment!, false);
});

test("redemption debits points atomically and manual settlement awards points once on the net service", async () => {
  const database = new MemoryDatabase();
  database.values.set("loyalty/customer", { balance: 5000 });
  const result = await redeemPoints(
    database.firestore(),
    "customer",
    order().id,
    5000,
  );
  assert.deepEqual(result, {
    balance: 0,
    pointsUsed: 5000,
    total: 15000,
    paid: false,
  });
  await Promise.all([
    confirmManualPayment(order().id, staff, database.firestore()),
    confirmManualPayment(order().id, staff, database.firestore()),
  ]);
  assert.equal(database.current().pointsEarned, 1500);
  assert.equal(database.values.get("loyalty/customer")?.balance, 1500);
  assert.equal(database.current().paid, true);
  await assert.rejects(
    redeemPoints(database.firestore(), "customer", order().id, 0),
    /sudah lunas/,
  );
});

test("points can be returned before payment and full points settle the order without earning on the discount", async () => {
  const database = new MemoryDatabase();
  database.values.set("loyalty/customer", { balance: 20000 });
  await redeemPoints(database.firestore(), "customer", order().id, 5000);
  const returned = await redeemPoints(
    database.firestore(),
    "customer",
    order().id,
    0,
  );
  assert.equal(returned.balance, 20000);
  const settled = await redeemPoints(
    database.firestore(),
    "customer",
    order().id,
    20000,
  );
  assert.equal(settled.total, 0);
  assert.equal(settled.balance, 0);
  assert.equal(settled.paid, true);
  assert.equal(database.current().pointsEarned, 0);
  assert.ok(database.current().paidAt);
  await assert.rejects(
    redeemPoints(database.firestore(), "other", order().id, 0),
    /pesanan sendiri/,
  );
});

test("concurrent redemptions cannot spend the same points twice", async () => {
  const database = new MemoryDatabase();
  database.values.set("loyalty/customer", { balance: 5000 });
  const secondOrder = { ...order(), id: "DF-ABCDEF123457" };
  database.values.set(`orders/${secondOrder.id}`, structuredClone(secondOrder));
  const outcomes = await Promise.allSettled([
    redeemPoints(database.firestore(), "customer", order().id, 5000),
    redeemPoints(database.firestore(), "customer", secondOrder.id, 5000),
  ]);
  assert.equal(
    outcomes.filter((outcome) => outcome.status === "fulfilled").length,
    1,
  );
  assert.equal(database.values.get("loyalty/customer")?.balance, 0);
});

test("a points wallet under financial review cannot be redeemed", async () => {
  const database = new MemoryDatabase();
  database.values.set("loyalty/customer", {
    balance: 5000,
    reconciliationRequired: true,
  });
  await assert.rejects(
    redeemPoints(database.firestore(), "customer", order().id, 5000),
    /sedang diperiksa/,
  );
  assert.equal(database.values.get("loyalty/customer")?.balance, 5000);
});

test("changing points invalidates an uploaded draft proof before it can be submitted", async () => {
  const database = new MemoryDatabase();
  database.values.set("loyalty/customer", { balance: 5000 });
  const oldVersion = await proof(database);
  await redeemPoints(database.firestore(), "customer", order().id, 5000);
  assert.equal(database.current().manualPayment?.hasProof, false);
  assert.equal(database.current().manualPayment?.proofVersion, undefined);
  await assert.rejects(
    submitManualPayment(order().id, oldVersion, database.firestore()),
    /unggah|bukti|berubah/i,
  );
});

test("membership proof is private to the account and consumed by exactly one pending deposit", async () => {
  const database = new MemoryDatabase();
  const paths: string[] = [];
  const uploaded = await storeMembershipProof(
    database.firestore(),
    "customer",
    new Uint8Array([1]),
    async (path) => {
      paths.push(path);
    },
  );
  assert.equal(
    paths[0],
    membershipProofPath("customer", uploaded.proofVersion),
  );
  assert.notEqual(
    paths[0],
    membershipProofPath("other", uploaded.proofVersion),
  );
  const input = {
    uid: "customer",
    requestId: "73476a0d-2bdf-44ae-b4d8-f12af667cc2d",
    proofVersion: uploaded.proofVersion,
    amount: 100000,
    branch: "cinere",
    name: "Pelanggan",
    senderName: "Pengirim",
    bank: account,
  };
  await assert.rejects(
    submitMembershipDeposit(database.firestore(), { ...input, uid: "other" }),
    /bukti/i,
  );
  const attempts = await Promise.allSettled([
    submitMembershipDeposit(database.firestore(), input),
    submitMembershipDeposit(database.firestore(), input),
  ]);
  assert.equal(
    attempts.filter((result) => result.status === "fulfilled").length,
    1,
  );
  assert.equal(
    database.values.get("membershipDeposits/customer")?.status,
    "pending",
  );
  assert.equal(
    database.values.get("membershipDeposits/customer")?.proofVersion,
    uploaded.proofVersion,
  );
  assert.equal(database.values.has("membershipProofs/customer"), false);
  await assert.rejects(
    storeMembershipProof(
      database.firestore(),
      "customer",
      new Uint8Array([1]),
      async () => {},
    ),
    /menunggu/i,
  );
});

test("membership transfer proof can only be submitted for its chosen store", async () => {
  const database = new MemoryDatabase();
  const uploaded = await storeMembershipProof(database.firestore(), "customer", new Uint8Array([1]), async () => {}, "buzzwash");
  const request = {
    uid: "customer", requestId: "73476a0d-2bdf-44ae-b4d8-f12af667cc2d",
    proofVersion: uploaded.proofVersion, amount: 100000,
    branch: "dfablelaundry", name: "Test", senderName: "Test", bank: account,
  };
  await assert.rejects(submitMembershipDeposit(database.firestore(), request), /toko lain/i);
  assert.equal(database.values.has("membershipDeposits/customer"), false);
  await submitMembershipDeposit(database.firestore(), { ...request, branch: "buzzwash" });
  assert.equal(database.values.get("membershipDeposits/customer")?.branchId, "buzzwash");
});

test("membership QRIS deposits retain the recipient and reject unapproved accounts", async () => {
  const database = new MemoryDatabase();
  const uploaded = await storeMembershipProof(database.firestore(), "customer", new Uint8Array([1]), async () => {}, "buzzwash");
  const request = {
    uid: "customer", requestId: "73476a0d-2bdf-44ae-b4d8-f12af667cc2d",
    proofVersion: uploaded.proofVersion, amount: 100000,
    branch: "buzzwash", name: "Test", senderName: "Test",
    paymentMethod: "qris_static" as const, bank: { ...account, accountNumber: "1234567890" },
  };
  await assert.rejects(submitMembershipDeposit(database.firestore(), request), /rekening/i);
  assert.equal(database.values.has("membershipProofs/customer"), true);
  await submitMembershipDeposit(database.firestore(), {
    ...request,
    bank: { bankName: "BCA", accountNumber: "6560655132", accountHolder: "NOVEL RUSPANDI" },
  });
  const saved = database.values.get("membershipDeposits/customer");
  assert.equal(saved?.paymentMethod, "qris_static");
  assert.deepEqual(saved?.qris, { id: "buzzwash-cibubur-v1", recipient: "BUZZWASH CIBUBUR" });
});

test("D’Fable membership deposits reject QRIS with the shared account and still accept bank transfers", async () => {
  const database = new MemoryDatabase();
  const uploaded = await storeMembershipProof(database.firestore(), "customer", new Uint8Array([1]), upload, "dfablelaundry");
  const request = {
    uid: "customer", requestId: "73476a0d-2bdf-44ae-b4d8-f12af667cc2d",
    proofVersion: uploaded.proofVersion, amount: 100000,
    branch: "dfablelaundry", name: "Test", senderName: "Test", bank: account,
  };
  await assert.rejects(submitMembershipDeposit(database.firestore(), { ...request, paymentMethod: "qris_static" }), /QRIS belum tersedia/);
  assert.equal(database.values.has("membershipDeposits/customer"), false);
  await submitMembershipDeposit(database.firestore(), { ...request, paymentMethod: "bank_transfer" });
  assert.equal(database.values.get("membershipDeposits/customer")?.paymentMethod, "bank_transfer");
});

test("pending estimates can release reserved rewards once without double refund", async () => {
  const value = { ...order(), actualKg: null, shippingFee: null, total: 9000,
    membershipDiscount: true, rewardsReservedAt: "2026-11-13T00:00:00Z",
    membershipUsed: 5000, pointsUsed: 2000, usePoints: true,
    useMembershipBalance: true, pointsLimit: 2000, membershipLimit: 5000 };
  const database = new MemoryDatabase(value);
  database.values.set("loyalty/customer", { balance: 3000 });
  database.values.set("memberships/customer", { active: true, balance: 1000 });
  const results = await Promise.allSettled([
    redeemMembership(database.firestore(), "customer", value.id, 0),
    redeemMembership(database.firestore(), "customer", value.id, 0),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(database.values.get("memberships/customer")?.balance, 6000);
  assert.equal(database.current().membershipUsed, 0);
  assert.equal(database.current().useMembershipBalance, false);
  assert.equal(database.current().total, 14000);
  await redeemPoints(database.firestore(), "customer", value.id, 0);
  assert.equal(database.values.get("loyalty/customer")?.balance, 5000);
  assert.equal(database.current().pointsUsed, 0);
  assert.equal(database.current().usePoints, false);
  assert.equal(database.current().total, 16000);
  assert.equal(database.current().paid, false);
});

test("pending reservations cannot be released for another customer or during payment review", async () => {
  const value = { ...order(), actualKg: null, shippingFee: null, total: 11000,
    membershipDiscount: true, rewardsReservedAt: "2026-11-13T00:00:00Z", membershipUsed: 5000 };
  const database = new MemoryDatabase(value);
  database.values.set("memberships/customer", { active: true, balance: 1000 });
  await assert.rejects(redeemMembership(database.firestore(), "other", value.id, 0), /sendiri/);
  database.values.set(`orders/${value.id}`, { ...value, paymentReconciliationRequired: true });
  await assert.rejects(redeemMembership(database.firestore(), "customer", value.id, 0), /diproses|lunas/);
  assert.equal(database.values.get("memberships/customer")?.balance, 1000);
});

test("membership deposit requires manager and repeated confirmations credit once", async () => {
  const database = new MemoryDatabase();
  const requestId = "73476a0d-2bdf-44ae-b4d8-f12af667cc2d";
  database.values.set("membershipDeposits/customer", {
    uid: "customer",
    requestId,
    amount: 100000,
    branchId: "cinere",
    status: "pending",
  });
  await assert.rejects(
    reviewDeposit(
      database.firestore(),
      staff,
      "customer",
      requestId,
      "confirm",
    ),
  );
  await Promise.all([
    reviewDeposit(
      database.firestore(),
      owner,
      "customer",
      requestId,
      "confirm",
    ),
    reviewDeposit(
      database.firestore(),
      owner,
      "customer",
      requestId,
      "confirm",
    ),
  ]);
  assert.equal(database.values.get("memberships/customer")?.balance, 100000);
  assert.equal(database.values.get("memberships/customer")?.active, true);
  assert.equal(
    database.values.get("membershipDeposits/customer")?.status,
    "confirmed",
  );
});

test("membership and points reduce discounted service but not insurance or shipping", async () => {
  const value = {
    ...order(),
    membershipDiscount: true,
    insurance: true,
    shippingFee: 2000,
    total: 19000,
  };
  const database = new MemoryDatabase(value);
  database.values.set("memberships/customer", {
    active: true,
    balance: 100000,
  });
  database.values.set("loyalty/customer", { balance: 5000 });
  const member = await redeemMembership(
    database.firestore(),
    "customer",
    value.id,
    10000,
  );
  assert.equal(member.total, 9000);
  const points = await redeemPoints(
    database.firestore(),
    "customer",
    value.id,
    5000,
  );
  assert.equal(points.total, 4000);
  assert.equal(database.values.get("memberships/customer")?.balance, 90000);
  await assert.rejects(
    redeemPoints(database.firestore(), "customer", value.id, 6001),
  );
});

test("a newly confirmed shared deposit can pay an already confirmed order at its quoted price", async () => {
  const requestId = "73476a0d-2bdf-44ae-b4d8-f12af667cc2d";
  for (const [orderBranch, depositBranch] of [
    ["cinere", "buzzwash"],
    ["buzzwash", "dfablelaundry"],
  ] as const) {
    const value: Order = {
      ...order(), branchId: orderBranch,
      ...(orderBranch === "buzzwash" ? {
        membershipDiscount: false,
        fulfillment: "dropoff",
        quantityPending: false,
      } : {}),
      total: 22000, shippingFee: 2000,
    };
    const database = new MemoryDatabase(value);
    database.values.set("membershipDeposits/customer", {
      uid: "customer", requestId, amount: 100000,
      branchId: depositBranch, status: "pending",
    });

    assert.equal(finalAmount(value), 22000);
    await assert.rejects(redeemMembership(database.firestore(), "customer", value.id, 20000), /deposit dikonfirmasi/i);
    await reviewDeposit(database.firestore(), owner, "customer", requestId, "confirm");

    const payment = await redeemMembership(database.firestore(), "customer", value.id, 20000);
    assert.deepEqual(payment, { balance: 80000, amount: 20000, total: 2000, paid: false });
    assert.equal(database.current().membershipDiscount, value.membershipDiscount);
    assert.equal(database.current().membershipUsed, 20000);
    assert.equal(finalAmount(database.current()), 2000);

    await redeemMembership(database.firestore(), "customer", value.id, 0);
    assert.equal(finalAmount(database.current()), 22000);
    assert.equal(database.values.get("memberships/customer")?.balance, 100000);
  }
});

test("membership full settlement credits loyalty only once", async () => {
  const value = { ...order(), membershipDiscount: true, total: 16000 };
  const database = new MemoryDatabase(value);
  database.values.set("memberships/customer", {
    active: true,
    balance: 100000,
  });
  const settled = await redeemMembership(
    database.firestore(),
    "customer",
    value.id,
    16000,
  );
  assert.equal(settled.paid, true);
  assert.equal(database.values.get("loyalty/customer")?.balance, 1600);
  await assert.rejects(
    redeemMembership(database.firestore(), "customer", value.id, 16000),
  );
  assert.equal(database.values.get("memberships/customer")?.balance, 84000);
});

test("membership balance cannot be spent twice concurrently or while under review", async () => {
  const first = { ...order(), membershipDiscount: true, total: 16000 };
  const second = { ...first, id: "DF-ABCDEF123457" };
  const database = new MemoryDatabase(first);
  database.values.set(`orders/${second.id}`, structuredClone(second));
  database.values.set("memberships/customer", { active: true, balance: 10000 });
  const result = await Promise.allSettled([
    redeemMembership(database.firestore(), "customer", first.id, 10000),
    redeemMembership(database.firestore(), "customer", second.id, 10000),
  ]);
  assert.equal(result.filter((x) => x.status === "fulfilled").length, 1);
  assert.equal(database.values.get("memberships/customer")?.balance, 0);
  const wallet = database.values.get("memberships/customer")!;
  wallet.balance = 5000;
  wallet.reconciliationRequired = true;
  await assert.rejects(
    redeemMembership(database.firestore(), "customer", second.id, 5000),
  );
});

test("existing discounted order can return reserved member balance even after wallet reaches zero", async () => {
  const value = { ...order(), membershipDiscount: true, total: 16000 };
  const database = new MemoryDatabase(value);
  database.values.set("memberships/customer", { active: true, balance: 10000 });
  await redeemMembership(database.firestore(), "customer", value.id, 10000);
  assert.equal(database.values.get("memberships/customer")?.balance, 0);
  assert.equal(database.current().total, 6000);
  await redeemMembership(database.firestore(), "customer", value.id, 0);
  assert.equal(database.values.get("memberships/customer")?.balance, 10000);
  assert.equal(database.current().total, 16000);
  assert.equal(database.current().membershipDiscount, true);
});
