import test from "node:test";
import assert from "node:assert/strict";
import type { Firestore, Transaction } from "firebase-admin/firestore";
import { findPosMember, posMembershipPayment, posMemberView } from "../../lib/pos-membership";

const phone = "+6281200001234";
type Fields = Record<string, unknown>;

function memberDatabase(fields: Record<string, Fields> = {}) {
  const reads: string[] = [];
  const transactionReads: string[] = [];
  const snapshot = (path: string, data = fields[path]) => ({
    id: path.split("/").at(-1),
    get: (field: string) => data?.[field],
    data: () => data,
  });
  const database = {
    collection: (path: string) => ({
      where: (key: string, operation: string, values: string[]) => ({
        limit: (count: number) => {
          assert.equal(operation, "in");
          function read() {
            const docs = Object.entries(fields)
              .filter(([entry, fields]) => entry.startsWith(`${path}/`) && values.includes(String(fields[key])))
              .slice(0, count)
              .map(([entry, data]) => snapshot(entry, data));
            return { docs, size: docs.length };
          }
          return {
            path,
            read,
            get: async () => { reads.push(path); return read(); },
          };
        },
      }),
    }),
    doc: (path: string) => ({
      path,
      read: () => snapshot(path),
      get: async () => { reads.push(path); return snapshot(path); },
    }),
  } as unknown as Firestore;
  const tx = {
    get: async (ref: { path: string; read: () => unknown }) => {
      transactionReads.push(ref.path);
      return ref.read();
    },
  } as unknown as Transaction;
  return { database, reads, tx, transactionReads };
}

test("POS discovers an existing wallet from canonical and legacy phone formats", async () => {
  const references = new Set<string>();
  for (const storedPhone of [phone, "6281200001234", "081200001234"]) {
    const data = memberDatabase({
      "users/customer": { phone: storedPhone, name: "Pelanggan Contoh" },
      "memberships/customer": { active: true, balance: 50000 },
    });
    const member = await findPosMember(data.database, phone, data.tx);
    assert.equal(member?.uid, "customer");
    assert.match(member.reference, /^[a-f0-9]{64}$/);
    references.add(member.reference);
    assert.deepEqual(posMemberView(member), {
      accountExists: true,
      member: { active: true, reference: member.reference, name: "Pelanggan Contoh", balance: 50000, discountEligible: true },
    });
    assert.deepEqual(data.reads, []);
    assert.deepEqual(data.transactionReads, ["users", "memberships/customer", "access/customer"]);
  }
  assert.equal(references.size, 1);
});

test("POS distinguishes absent, inactive and active zero-balance memberships", async () => {
  const data = memberDatabase({
    "users/customer": { phone, name: "Pelanggan Contoh" },
    "users/depleted": { phone: "+6281211111111", name: "Member Contoh" },
    "memberships/depleted": { active: true, balance: 0 },
  });
  assert.deepEqual(posMemberView(await findPosMember(data.database, "+6282222222222")), {
    accountExists: false,
    member: null,
  });
  assert.deepEqual(posMemberView(await findPosMember(data.database, phone)), {
    accountExists: true,
    member: null,
  });
  const depleted = await findPosMember(data.database, "+6281211111111");
  assert.ok(depleted);
  assert.deepEqual(posMemberView(depleted), {
    accountExists: true,
    member: { active: true, reference: depleted.reference, name: "Member Contoh", balance: 0, discountEligible: false },
  });
});

test("POS refuses ambiguous phone matches and disabled accounts", async () => {
  const duplicate = memberDatabase({
    "users/first": { phone },
    "users/second": { phone: "081200001234" },
  });
  await assert.rejects(findPosMember(duplicate.database, phone), { status: 409, message: /lebih dari satu akun/ });
  assert.deepEqual(duplicate.reads, ["users"]);

  const disabled = memberDatabase({
    "users/customer": { phone },
    "access/customer": { disabled: true },
    "memberships/customer": { active: true, balance: 50000 },
  });
  await assert.rejects(findPosMember(disabled.database, phone), { status: 409, message: /nonaktif/ });
});

test("balance under review is visible at POS but cannot earn a discount or fund checkout", async () => {
  const data = memberDatabase({
    "users/customer": { phone },
    "memberships/customer": { active: true, balance: 50000, reconciliationRequired: true },
  });
  const view = posMemberView(await findPosMember(data.database, phone));
  assert.equal(view.member?.balance, 50000);
  assert.equal(view.member?.discountEligible, false);
});

test("POS saldo can cover all or part of the service after approval and leaves insurance payable", () => {
  assert.deepEqual(posMembershipPayment(25000, false, 100000, true), { membershipUsed: 25000, total: 0 });
  assert.deepEqual(posMembershipPayment(25000, false, 10000, true), { membershipUsed: 10000, total: 15000 });
  assert.deepEqual(posMembershipPayment(25000, true, 100000, true), { membershipUsed: 25000, total: 1000 });
  assert.deepEqual(posMembershipPayment(25000, true, 100000, false), { membershipUsed: 0, total: 26000 });
});
