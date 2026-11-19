import { STATIC_QRIS_ID } from "./manual-policy";
import type { ManualPaymentSummary } from "./manual-types";

export function manualPaymentMode(selection: "bank" | "manual-qris" | "", manual?: ManualPaymentSummary) {
  if (manual?.bank) return manual.bank.staticQrId === STATIC_QRIS_ID ? "manual-qris" : "bank";
  return selection || (manual ? "bank" : "");
}

export function canUploadManualProof(input: {
  viewLoaded: boolean;
  bankConfigured: boolean;
  busy: boolean;
  paid: boolean;
  pendingReview: boolean;
  reviewRequired: boolean;
  gatewayActive: boolean;
}) {
  return (
    input.viewLoaded &&
    input.bankConfigured &&
    !input.busy &&
    !input.paid &&
    !input.pendingReview &&
    !input.reviewRequired &&
    !input.gatewayActive
  );
}
