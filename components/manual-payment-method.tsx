import { STATIC_QRIS_ID } from "@/lib/payments/manual-policy";
import type { ManualPaymentSummary } from "@/lib/payments/manual-types";

/** Keeps the receiving account visible to staff after the proof is submitted. */
export default function ManualPaymentMethod({ manual }: { manual: ManualPaymentSummary }) {
  if (!manual.bank) return null;
  return <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-600">
    {manual.bank.staticQrId === STATIC_QRIS_ID
      ? <><strong className="text-slate-900">QRIS manual</strong> · Penerima: BUZZWASH CIBUBUR</>
      : <><strong className="text-slate-900">Transfer bank</strong> · {manual.bank.bankName} a.n. {manual.bank.accountHolder}</>}
  </div>;
}
