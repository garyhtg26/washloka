import { money } from "@/lib/types";

/** Only show a previous price when the order and payment totals agree. */
export default function PaymentAmount({ amount, orderTotal, pointsUsed = 0, membershipUsed = 0 }: {
  amount: number;
  orderTotal?: number;
  pointsUsed?: number;
  membershipUsed?: number;
}) {
  const values = [amount, orderTotal, pointsUsed, membershipUsed];
  const valid = values.every((value) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0);
  const discount = pointsUsed + membershipUsed;
  const original = amount + discount;
  const showOriginal = valid && orderTotal === amount && discount > 0 && Number.isSafeInteger(original);

  return <>
    {showOriginal && <s className="block text-xs text-slate-500"><span className="sr-only">Sebelum saldo dan poin: </span>{money(original)}</s>}
    <b className="text-lg font-semibold tracking-tight text-slate-900">{money(amount)}</b>
  </>;
}
