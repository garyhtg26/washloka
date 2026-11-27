"use client";
import { useEffect, useId, useState } from "react";
import { CreditCard } from "lucide-react";
import { money, type TrackingOrder } from "@/lib/types";
import { isOrderReadyForBilling } from "@/lib/order-billing";
import { useAuth } from "./auth-provider";

type Wallet = { balance: number; active: boolean; canSpend: boolean; depositPending: boolean };

export default function MembershipRedemption({
  order,
  onChanged,
}: {
  order: TrackingOrder;
  onChanged?: () => void;
}) {
  const auth = useAuth();
  const amountId = useId();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [amount, setAmount] = useState(String(order.membershipUsed || ""));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!auth.user?.uid || !auth.verified) return;
    let request: AbortController | undefined;
    function refresh() {
      request?.abort();
      const controller = new AbortController();
      request = controller;
      setLoadError(false);
      void auth
        .request(`/api/membership?branch=${encodeURIComponent(order.branchId)}`, {
          cache: "no-store",
          signal: controller.signal,
        })
        .then(async (response) => {
          if (!response.ok) throw Error();
          const data = await response.json();
          if (!Number.isSafeInteger(data.balance) || data.balance < 0) throw Error();
          if (controller.signal.aborted) return;
          setWallet({
            balance: data.balance,
            active: data.active === true,
            canSpend: data.discountEligible === true,
            depositPending: !!data.pending,
          });
        })
        .catch(() => {
          if (!controller.signal.aborted) setLoadError(true);
        });
    }
    refresh();
    window.addEventListener("focus", refresh);
    return () => {
      request?.abort();
      window.removeEventListener("focus", refresh);
    };
  }, [
    auth.request,
    auth.user?.uid,
    auth.verified,
    order.membershipUsed,
    order.branchId,
    order.id,
    retry,
  ]);
  useEffect(
    () => setAmount(String(order.membershipUsed || "")),
    [order.membershipUsed, order.id],
  );
  const used = order.membershipUsed || 0;
  if (!order.membershipDiscount && !used && !wallet?.active && !wallet?.depositPending && !loadError)
    return null;

  const locked =
    order.paid ||
    !!order.paymentReconciliationRequired ||
    ["creating", "pending", "paid"].includes(order.payment?.status || "") ||
    ["awaiting_review", "paid"].includes(order.manualPayment?.status || "");
  const ready = isOrderReadyForBilling(order);
  const available = wallet?.canSpend && !loadError ? wallet.balance : 0;
  const max =
    !wallet || !ready
      ? 0
      : Math.max(
          0,
          Math.min(
            available + used,
            order.total -
              (order.shippingFee || 0) -
              (order.insurance ? 1000 : 0) +
              used,
          ),
        );
  async function apply(value: number) {
    setBusy(true);
    setMessage("");
    try {
      const response = await auth.request("/api/membership/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id, amount: value }),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || "Saldo belum bisa digunakan. Coba lagi.");
      setWallet((previous) => previous && { ...previous, balance: data.balance });
      setAmount(String(data.amount || ""));
      setMessage(value ? "Saldo membership mengurangi tagihanmu." : "Saldo dikembalikan.");
      setRetry((attempt) => attempt + 1);
      onChanged?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Saldo belum bisa digunakan. Coba lagi.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mb-4 rounded-2xl border border-[#ead8de] bg-[#f9f1f4] p-4 text-sm">
      <div className="flex items-center gap-2">
        <CreditCard size={19} />
        <b>Saldo membership</b>
      </div>
      <p className="!mb-0 !mt-2">
        {wallet ? `Tersedia ${money(wallet.balance)}` : loadError ? "Saldo belum bisa dimuat." : "Memuat saldo…"}
        {used ? ` · digunakan ${money(used)}` : ""}
      </p>
      {order.membershipDiscount && <p className="!mb-0 !mt-2 text-xs">Harga layanan sudah termasuk diskon member 20%.</p>}
      {(wallet?.depositPending || loadError) && !order.paid && (
        <div className="!mt-2 flex flex-wrap items-center gap-x-2 text-xs">
          {wallet?.depositPending && <span>Deposit menunggu konfirmasi toko.</span>}
          <button type="button" className="text-button" disabled={busy} onClick={() => setRetry((attempt) => attempt + 1)}>
            Cek ulang saldo
          </button>
        </div>
      )}
      {wallet?.active && !wallet.canSpend && wallet.balance > 0 && !order.paid && (
        <p className="!mb-0 !mt-2 text-xs">Saldo sedang diperiksa. Hubungi toko untuk bantuan.</p>
      )}
      {locked && !order.paid && (
        <p className="!mb-0 !mt-2 text-xs">Pembayaran sedang diproses. Saldo tidak dapat diubah saat ini.</p>
      )}
      {ready && !locked && available > 0 && max === 0 && (
        <p className="!mb-0 !mt-2 text-xs">Saldo berlaku untuk biaya layanan. Selesaikan sisa ongkir atau perlindungan di bagian pembayaran.</p>
      )}
      {!ready && !order.paid && (
        <p className="!mb-0 !mt-2 text-xs">
          {used > 0
            ? "Saldo sudah digunakan berdasarkan perkiraan. Tagihan disesuaikan setelah toko mengonfirmasi jumlah dan ongkir."
            : "Saldo dapat diubah setelah toko mengonfirmasi jumlah dan ongkir."}
        </p>
      )}
      {!ready && !locked && used > 0 && order.rewardsReservedAt && (
        <button
          type="button"
          className="text-button mt-3"
          disabled={busy}
          onClick={() => void apply(0)}
        >
          Batalkan penggunaan saldo
        </button>
      )}
      {ready && !locked && (max > 0 || used > 0) && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {max > used && (
            <button
              type="button"
              className="primary"
              disabled={busy}
              onClick={() => void apply(max)}
            >
              Pakai {money(max)}
            </button>
          )}
          <label className="sr-only" htmlFor={amountId}>
            Jumlah saldo yang digunakan
          </label>
          <input
            id={amountId}
            className="!w-36"
            type="number"
            inputMode="numeric"
            min="0"
            max={max}
            placeholder="Nominal saldo"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <button
            type="button"
            className="secondary"
            disabled={
              busy ||
              amount === "" ||
              !Number.isSafeInteger(Number(amount)) ||
              Number(amount) < 0 ||
              Number(amount) === used ||
              Number(amount) > max
            }
            onClick={() => void apply(Number(amount))}
          >
            Gunakan nominal
          </button>
          {used > 0 && (
            <button
              type="button"
              className="text-button"
              disabled={busy}
              onClick={() => void apply(0)}
            >
              Batalkan
            </button>
          )}
        </div>
      )}
      {message && (
        <p role="status" className="!mb-0 !mt-2">
          {message}
        </p>
      )}
    </section>
  );
}
