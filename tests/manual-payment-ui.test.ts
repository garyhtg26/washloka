import test from "node:test";
import assert from "node:assert/strict";
import { canUploadManualProof, manualPaymentMode } from "../lib/payments/manual-ui";
import { STATIC_QRIS_ID } from "../lib/payments/manual-policy";

test("customers can upload a draft receipt before actual weight and shipping are final", () => {
  assert.equal(
    canUploadManualProof({
      viewLoaded: true,
      bankConfigured: true,
      busy: false,
      paid: false,
      pendingReview: false,
      reviewRequired: false,
      gatewayActive: false,
    }),
    true,
  );
});

test("after refresh or receipt upload, the stored QRIS choice wins over stale local state", () => {
  const manual = {
    method: "bank_transfer" as const,
    status: "unpaid" as const,
    amount: null,
    hasProof: true,
    bank: { bankName: "BCA", accountNumber: "6560655132", accountHolder: "NOVEL RUSPANDI", staticQrId: STATIC_QRIS_ID },
  };
  assert.equal(manualPaymentMode("", manual), "manual-qris");
  assert.equal(manualPaymentMode("bank", manual), "manual-qris");
  assert.equal(manualPaymentMode("manual-qris", { ...manual, bank: { bankName: "BCA", accountNumber: "6560655132", accountHolder: "NOVEL RUSPANDI" } }), "bank");
});
