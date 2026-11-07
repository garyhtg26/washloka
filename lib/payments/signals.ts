import "server-only";
import { randomUUID } from "node:crypto";
import type { Firestore, Transaction } from "firebase-admin/firestore";
import { normalizeBranchId } from "../branches";

export function signalPaymentChange(
  tx: Transaction,
  database: Firestore,
  branchId: string,
) {
  const branch = normalizeBranchId(branchId);
  if (!branch) return;
  tx.set(database.doc(`paymentSignals/${branch}`), {
    version: randomUUID(),
    updatedAt: new Date().toISOString(),
  });
}
