import test from "node:test";
import assert from "node:assert/strict";
import type { Firestore, Transaction } from "firebase-admin/firestore";
import { readStore } from "../../lib/store";
import { readBranchSettings } from "../../lib/branch-settings";
import { bankQrPath, readBankDetails } from "../../lib/payments/bank-service";
import { signalPaymentChange } from "../../lib/payments/signals";
import type { Identity } from "../../lib/firebase/access";
import { DEFAULT_BRANCH, persistedBranchIds } from "../../lib/branches";
import { defaultStore } from "../../lib/defaults";

class ReadDatabase {
  values = new Map<string, Record<string, unknown>>();
  filters: { field: string; operator: string; value: unknown }[] = [];
  writes: string[] = [];
  doc(path: string) {
    return { path, get: async () => this.snapshot(path) };
  }
  snapshot(path: string) {
    const value = this.values.get(path);
    return {
      id: path.split("/").at(-1),
      exists: !!value,
      data: () => value && structuredClone(value),
      get: (key: string) => value?.[key],
    };
  }
  collection(name: string) {
    const query = (filters: typeof this.filters = [], max = Infinity) => ({
      where: (field: string, operator: string, value: unknown) => {
        this.filters.push({ field, operator, value });
        return query([...filters, { field, operator, value }], max);
      },
      orderBy: (_field: string, _direction: string) => query(filters, max),
      limit: (limit: number) => query(filters, limit),
      get: async () => {
        const docs = [...this.values.keys()]
          .filter(
            (path) =>
              path.startsWith(`${name}/`) && path.split("/").length === 2,
          )
          .map((path) => this.snapshot(path))
          .filter((snapshot) =>
            filters.every(({ field, operator, value }) =>
              operator === "in"
                ? (value as unknown[]).includes(snapshot.get(field))
                : snapshot.get(field) === value,
            ),
          )
          .slice(0, max);
        return { docs, size: docs.length };
      },
    });
    return query();
  }
  firestore() {
    return this as unknown as Firestore;
  }
}

const admin: Identity = {
  uid: "owner",
  email: "owner@example.test",
  name: "Owner",
  admin: true,
  manageUsers: true,
  role: "owner",
};
const customer: Identity = {
  ...admin,
  uid: "customer",
  admin: false,
  manageUsers: false,
  role: "customer",
};
const account = {
  bankName: "BCA",
  accountNumber: "1234567890",
  accountHolder: "D’Fable",
};

function settingsDatabase() {
  const database = new ReadDatabase();
  database.values.set("settings/bogor", {
    manualPayment: account,
    content: {
      images: { wash: "/api/media/banners/wash?v=abcd&branch=bogor" },
    },
  });
  database.values.set("settings/dfablelaundry", {
    promo: { title: "Canonical fallback" },
  });
  database.values.set("settings/cinere", {
    content: {
      people: { title: "Primary content" },
      images: { promo: "/api/media/banners/promo?v=abcd&branch=cinere" },
    },
  });
  return database;
}

test("D’Fable settings preserve the primary configuration and fill missing data without writes", async () => {
  const database = settingsDatabase();
  const settings = await readBranchSettings(
    database.firestore(),
    DEFAULT_BRANCH,
  );
  assert.equal(settings.ref.path, "settings/cinere");
  assert.equal(settings.get("promo.title"), "Canonical fallback");
  assert.equal(settings.get("content.people.title"), "Primary content");
  assert.equal(
    settings.get("content.images.wash"),
    "/api/media/banners/wash?v=abcd&branch=bogor",
  );
  assert.equal(
    settings.get("content.images.promo"),
    "/api/media/banners/promo?v=abcd&branch=cinere",
  );
  assert.equal(
    (await readBankDetails(DEFAULT_BRANCH, database.firestore())).accountNumber,
    account.accountNumber,
  );
  database.values.set("settings/cinere", {
    manualPayment: { ...account, accountNumber: "9999999999" },
  });
  assert.equal(
    (await readBankDetails("bogor", database.firestore())).accountNumber,
    "9999999999",
  );
  assert.equal(database.writes.length, 0);
  await assert.rejects(readBranchSettings(database.firestore(), "buzzwash"));
});

test("one dashboard includes both legacy order sets and canonical orders, excluding other stores", async () => {
  const database = settingsDatabase();
  for (const [index, branchId] of [
    ...persistedBranchIds,
    "buzzwash",
  ].entries()) {
    const id = `DF-00000000000${index}`;
    database.values.set(`orders/${id}`, {
      id,
      branchId,
      uid: "customer",
      createdAt: `2026-11-0${index + 1}T00:00:00Z`,
      photoPath: "",
    });
  }
  const other = {
    id: "DF-000000000005",
    branchId: "cinere",
    uid: "other",
    createdAt: "2026-11-05T00:00:00Z",
    photoPath: "",
  };
  database.values.set(`orders/${other.id}`, other);
  const dashboard = await readStore(admin, "bogor", database.firestore());
  assert.equal(dashboard.branchId, DEFAULT_BRANCH);
  assert.equal(dashboard.promo.title, "Canonical fallback");
  assert.equal(dashboard.promo.description, defaultStore.promo.description);
  assert.equal(dashboard.orders.length, 4);
  assert.equal(
    dashboard.orders.some((order) => order.branchId === "buzzwash"),
    false,
  );
  assert.deepEqual(
    database.filters.find(({ field }) => field === "branchId")?.value,
    [...persistedBranchIds],
  );
  const profile = await readStore(
    customer,
    DEFAULT_BRANCH,
    database.firestore(),
  );
  assert.equal(profile.orders.length, 3);
  assert.equal(
    profile.orders.every((order) => order.uid === customer.uid),
    true,
  );
  assert.equal(
    profile.orders.some((order) => order.branchId === "buzzwash"),
    false,
  );
  assert.equal(database.writes.length, 0);
});

test("existing QR versions resolve to their original files through canonical and legacy links", async () => {
  const database = new ReadDatabase();
  const version = "73476a0d-2bdf-44ae-b4d8-f12af667cc2d";
  database.values.set(`bankQrVersions/bogor-${version}`, {
    branchId: "bogor",
    qrVersion: version,
  });
  assert.equal(
    await bankQrPath(DEFAULT_BRANCH, version, database.firestore()),
    `payments/bank-qr/bogor/${version}.jpg`,
  );
  assert.equal(
    await bankQrPath("cinere", version, database.firestore()),
    `payments/bank-qr/bogor/${version}.jpg`,
  );
  await assert.rejects(bankQrPath("buzzwash", version, database.firestore()));
  database.values.clear();
  database.values.set(`bankQrVersions/buzzwash-${version}`, {
    branchId: "buzzwash",
    qrVersion: version,
  });
  await assert.rejects(
    bankQrPath(DEFAULT_BRANCH, version, database.firestore()),
    /tidak ditemukan/,
  );
});

test("payment refreshes for every D’Fable alias target one signal and ignore unsupported stores", () => {
  const database = new ReadDatabase();
  const tx = {
    set: (ref: { path: string }) => database.writes.push(ref.path),
  } as unknown as Transaction;
  for (const branch of persistedBranchIds)
    signalPaymentChange(tx, database.firestore(), branch);
  signalPaymentChange(tx, database.firestore(), "buzzwash");
  assert.deepEqual(
    database.writes,
    persistedBranchIds.map(() => "paymentSignals/dfablelaundry"),
  );
});
