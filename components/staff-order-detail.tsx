"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  ExternalLink,
  Info,
  MapPin,
  MessageCircle,
  Printer,
  ReceiptText,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { branchLabel } from "@/lib/branches";
import { canSelectOrderStatus } from "@/lib/order-fulfillment";
import { speedLabel, unitLabel } from "@/lib/catalog";
import { money, statuses, type Order, type Service } from "@/lib/types";
import { calculateOrderPrice } from "@/lib/pricing";
import PaymentPanel from "./payment-panel";
import PaymentStatus from "./payment-status";
import { useAuth } from "./auth-provider";
import AuthorizedPhoto from "./authorized-photo";
import "./staff-order-detail.css";
import { dfableTrackingPath } from "@/lib/dfable-path";
import { orderWhatsAppDraft } from "@/lib/whatsapp-order";

const formatDate = (date: string) => {
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime())
    ? date
    : new Intl.DateTimeFormat("id-ID", {
        timeZone: "Asia/Jakarta",
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(parsed);
};
export default function StaffOrderDetail({
  order: o,
  services,
  busy,
  save,
  paymentEnabled,
  onPaymentChanged,
}: {
  order: Order;
  services: Service[];
  busy: boolean;
  save: (data: unknown) => Promise<void>;
  paymentEnabled?: boolean;
  onPaymentChanged: () => void;
}) {
  const auth = useAuth();
  const [cashConfirm, setCashConfirm] = useState(false);
  const [cashBusy, setCashBusy] = useState(false);
  const [cashError, setCashError] = useState("");
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const [status, setStatus] = useState(o.status);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  useEffect(() => {
    setStatus(o.status);
    setErr("");
    setNotice("");
  }, [o.id]);
  // Another staff member may update the order while this detail is open.
  useEffect(() => setStatus(o.status), [o.status]);
  const service = services.find((item) => item.id === o.service);
  const unit = unitLabel(o.unit ?? service?.unit);
  const locked = Boolean(
    o.paid ||
    o.paymentReconciliationRequired ||
    (o.payment && ["creating", "pending", "paid"].includes(o.payment.status)) ||
    (o.manualPayment &&
      ["awaiting_review", "paid"].includes(o.manualPayment.status)),
  );
  const branch = branchLabel(o.branchId);
  const dropoff = o.fulfillment === "dropoff";
  const deferredWebOrder = o.source === "web" && !!o.fulfillment;
  const awaitingFinalBill = deferredWebOrder && !o.paid && (
    o.status < (dropoff ? 3 : 1) ||
    o.quantityPending || o.actualKg === null || o.shippingFee === null || o.pricePending
  );
  const tracking =
    typeof window !== "undefined"
      ? `${window.location.origin}${dfableTrackingPath(o.token, o.branchId)}`
      : "";
  const waDraft = origin ? orderWhatsAppDraft(o, origin) : null;
  const statusNotSaved = status !== o.status;

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const nextStatus = Number(form.get("status"));
    const previousStatus = o.status;
    setErr("");
    setNotice("");
    try {
      await save({
        id: o.id,
        status: nextStatus,
        actualKg: form.get("weight") === "" ? null : Number(form.get("weight")),
        paid: o.paid,
        shippingFee:
          form.get("shipping") === "" ? null : Number(form.get("shipping")),
        ...(o.startingAt && o.pricePending && form.get("confirmedUnitPrice") !== ""
          ? { confirmedUnitPrice: Number(form.get("confirmedUnitPrice")) }
          : {}),
      });
      setNotice(
        nextStatus !== previousStatus
          ? "Status tersimpan. Kirim kabar ke pelanggan melalui WhatsApp."
          : "Perubahan tersimpan.",
      );
    } catch (error) {
      setErr(
        error instanceof Error
          ? error.message
          : "Perubahan belum bisa disimpan.",
      );
    }
  }

  return (
    <div className="staff-detail">
      <div className="staff-detail-title">
        <div>
          <p className="staff-detail-kicker">
            PESANAN {o.source === "pos" ? "DATANG LANGSUNG" : "ONLINE"}
          </p>
          <h2>{o.id}</h2>
          <p className="staff-detail-meta">
            {branch} · {formatDate(o.createdAt)}
          </p>
        </div>
        <span className="staff-detail-status">{statuses[o.status]}</span>
      </div>
      <div className="staff-detail-grid">
        <div className="staff-detail-main">
          <section className="staff-detail-card">
            <div className="staff-detail-card-heading">
              <UserRound size={19} />
              <h3>Pelanggan & cucian</h3>
            </div>
            <div className="staff-detail-customer">
              <div>
                <b>{o.name}</b>
                <span>{o.phone}</span>
              </div>
              <div>
                <b>{service?.name || o.service}</b>
                <span>
                  {o.quantityPending && o.actualKg === null ? "Menunggu ditimbang/dihitung" : <>{o.actualKg ?? o.kg} {unit}{o.actualKg === null ? " · perkiraan" : ""}</>} ·{" "}
                  {speedLabel(o.speed, o.express)}
                </span>
              </div>
            </div>
            {o.source === "web" && !dropoff && (
              <div className="staff-detail-address">
                <MapPin size={17} />
                <div>
                  {o.fulfillment === "delivery" && <b>Antar-jemput<br /></b>}
                  {o.address}
                  {(o.date || o.slot) && <small>{[o.date, o.slot].filter(Boolean).join(" · ")}</small>}
                  <a
                    href={`https://www.google.com/maps?q=${o.lat},${o.lng}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Buka titik jemput <ExternalLink size={13} />
                  </a>
                </div>
              </div>
            )}
            {o.source === "web" && dropoff && (
              <p className="staff-detail-note">Pelanggan antar dan ambil sendiri di toko.</p>
            )}
            {o.source === "pos" && (
              <p className="staff-detail-note">
                Pelanggan datang langsung ke toko.
              </p>
            )}
            {o.insurance && (
              <p className="staff-detail-note">
                <Info size={16} /> Perlindungan cucian aktif · Rp1.000
              </p>
            )}
            {o.notes && (
              <p className="staff-detail-note">
                <Info size={16} /> {o.notes}
              </p>
            )}
            {o.photo && (
              <details className="staff-detail-photo">
                <summary>Lihat foto cucian</summary>
                <AuthorizedPhoto src={o.photo} />
              </details>
            )}
          </section>
          <form className="staff-detail-card staff-update" onSubmit={onSave}>
            <div className="staff-detail-card-heading">
              <ReceiptText size={19} />
              <h3>Perbarui pesanan</h3>
            </div>
            {awaitingFinalBill && (
              <p className="staff-detail-note" role="status">
                <Info size={16} />
                {dropoff
                  ? "Setelah cucian diterima, pilih status Ditimbang, isi jumlah aktual dan ongkir, lalu simpan. Pelanggan baru dapat membayar setelah tagihan siap."
                  : "Konfirmasi penjemputan, lalu isi jumlah aktual setelah cucian ditimbang dan tentukan ongkir. Simpan perubahan agar pelanggan dapat membayar."}
              </p>
            )}
            <label>
              Status cucian
              <select
                name="status"
                value={status}
                onChange={(event) => setStatus(Number(event.target.value))}
              >
                {statuses.map((label, i) => (
                  <option disabled={!canSelectOrderStatus(o, i)} value={i} key={label}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-two">
              <label>
                {unit === "kg"
                  ? "Berat aktual (kg)"
                  : `Jumlah aktual (${unit})`}
                <input
                  required={!o.quantityPending || status >= 3}
                  name="weight"
                  type="number"
                  step={unit === "kg" ? "0.1" : "1"}
                  min={unit === "kg" ? "0.1" : "1"}
                  max="100"
                  defaultValue={o.actualKg ?? (o.quantityPending ? "" : o.kg)}
                  placeholder={o.quantityPending ? "Belum ditimbang" : undefined}
                  readOnly={locked}
                  aria-readonly={locked}
                />
                {o.actualKg === null && (
                  <small>Isi setelah cucian diterima; diperlukan mulai tahap ditimbang.</small>
                )}
              </label>
              <label>
                Ongkir (Rp)
                <input
                  name="shipping"
                  type="number"
                  min="0"
                  max="10000000"
                  step="1000"
                  placeholder="Belum dikonfirmasi"
                  defaultValue={o.shippingFee ?? ""}
                  readOnly={locked}
                  aria-readonly={locked}
                />
                <small>{o.fulfillment === "delivery" ? "Gratis hingga 5 km; toko mengonfirmasi ongkir." : "Isi 0 jika gratis atau ambil di toko."}</small>
              </label>
            </div>
            {o.startingAt && o.pricePending && (
              <label>
                Harga akhir per {unit} (Rp)
                <input
                  name="confirmedUnitPrice"
                  type="number"
                  min={o.unitPrice}
                  max="10000000"
                  step="1000"
                  placeholder={`Mulai ${money(o.unitPrice)}`}
                  readOnly={locked}
                  aria-readonly={locked}
                />
                <small>Isi setelah harga disepakati. Pembayaran tersedia setelah harga dikonfirmasi.</small>
              </label>
            )}
            {locked && (
              <p className="staff-detail-lock">
                <ShieldCheck size={16} /> Tagihan terkunci karena pembayaran
                sedang diperiksa atau sudah lunas.
              </p>
            )}
            {err && (
              <p className="form-error" role="alert">
                {err}
              </p>
            )}
            {notice && (
              <p className="staff-detail-notice" role="status">
                {notice}
              </p>
            )}
            <button type="submit" disabled={busy} className="primary">
              {busy ? "Menyimpan…" : "Simpan perubahan"}
            </button>
          </form>
          <StaffWhatsAppAction status={o.status} statusNotSaved={statusNotSaved} draft={waDraft} originReady={!!origin} />
        </div>
        <aside className="staff-detail-side">
          <section className="staff-detail-card">
            <div className="staff-detail-card-heading">
              <ReceiptText size={19} />
              <h3>Tagihan</h3>
            </div>
            <PaymentStatus
              paid={o.paid}
              manualPayment={o.manualPayment}
              payment={o.payment}
              reviewRequired={o.paymentReconciliationRequired}
              compact={false}
            />
            {(!!o.membershipUsed || !!o.pointsUsed) && (
              <div className="staff-detail-rewards" aria-label="Potongan pelanggan">
                {!!o.membershipUsed && <div><span>Saldo membership</span><strong>−{money(o.membershipUsed)}</strong></div>}
                {!!o.pointsUsed && <div><span>Poin loyalty</span><strong>−{money(o.pointsUsed)}</strong></div>}
              </div>
            )}
            <div className="staff-detail-total">
              <span>{awaitingFinalBill || o.quantityPending ? "Tagihan" : o.pricePending || o.actualKg === null || o.shippingFee === null ? "Estimasi tersisa" : "Total saat ini"}</span>
              <strong>{awaitingFinalBill || o.quantityPending ? "Menunggu konfirmasi" : money(o.total)}</strong>
            </div>
            <p className="staff-detail-hint">
              {awaitingFinalBill
                ? "Tagihan tersedia setelah konfirmasi toko, jumlah aktual, dan ongkir disimpan."
                : o.pricePending
                ? "Harga akhir perlu dikonfirmasi toko sebelum pembayaran."
                : "Jumlah akhir dihitung setelah berat dan ongkir disimpan."}
            </p>
          </section>
          <PaymentPanel
            orderId={o.id}
            quantityPending={o.quantityPending}
            deferUntilReady={deferredWebOrder}
            trackingToken={o.token}
            enabled={paymentEnabled}
            initialPaid={o.paid}
            initialPayment={o.payment}
            initialReviewRequired={o.paymentReconciliationRequired}
            initialManualPayment={o.manualPayment}
            hideQrByDefault
            hideProofByDefault
            onChanged={onPaymentChanged}
          />
          {o.source === "pos" && !o.paid && !locked && !o.pricePending && (
            <div className="staff-detail-card">
              {!cashConfirm ? (
                <button
                  type="button"
                  className="secondary full"
                  onClick={() => setCashConfirm(true)}
                >
                  Terima pembayaran tunai
                </button>
              ) : (
                <>
                  <p className="staff-detail-hint">
                    Pastikan uang tunai {money(o.total)} sudah diterima.
                  </p>
                  {cashError && (
                    <p className="form-error" role="alert">
                      {cashError}
                    </p>
                  )}
                  <div className="staff-detail-actions">
                    <button
                      type="button"
                      className="primary"
                      disabled={cashBusy}
                      onClick={async () => {
                        setCashBusy(true);
                        setCashError("");
                        try {
                          const result = await auth.request("/api/pos/cash", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              orderId: o.id,
                              expectedTotal: o.total,
                            }),
                          });
                          const data = await result.json();
                          if (!result.ok) throw Error(data.error);
                          setCashConfirm(false);
                          setNotice("Pembayaran tunai dicatat lunas.");
                          onPaymentChanged();
                        } catch (error) {
                          setCashError(
                            error instanceof Error
                              ? error.message
                              : "Pembayaran belum disimpan.",
                          );
                        } finally {
                          setCashBusy(false);
                        }
                      }}
                    >
                      Ya, tunai sudah diterima
                    </button>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => setCashConfirm(false)}
                    >
                      Batal
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
          <div className="staff-detail-actions">
            <button
              type="button"
              className="secondary"
              onClick={() => window.print()}
            >
              <Printer size={18} /> Cetak struk / PDF
            </button>
            {tracking && (
              <a
                className="text-button"
                href={tracking}
                target="_blank"
                rel="noreferrer"
              >
                Buka tracking pelanggan <ExternalLink size={14} />
              </a>
            )}
          </div>
        </aside>
      </div>
      <StaffReceipt order={o} services={services} />
    </div>
  );
}

export function StaffWhatsAppAction({ status, statusNotSaved, draft, originReady }: {
  status: number;
  statusNotSaved: boolean;
  draft: ReturnType<typeof orderWhatsAppDraft>;
  originReady: boolean;
}) {
  return <section className="staff-detail-card staff-whatsapp" aria-labelledby="staff-whatsapp-heading">
    <div className="staff-detail-card-heading">
      <MessageCircle size={19} />
      <h3 id="staff-whatsapp-heading">Kabar untuk pelanggan</h3>
    </div>
    <p className="staff-whatsapp-description">
      Pesan mengikuti status tersimpan: <strong>{statuses[status] || "Belum diketahui"}</strong>.
      WhatsApp akan terbuka dengan pesan siap diperiksa dan dikirim.
    </p>
    {statusNotSaved && <p className="staff-whatsapp-warning" role="status">Simpan perubahan status terlebih dahulu agar pesan sesuai.</p>}
    {!statusNotSaved && !draft && originReady && <p className="staff-whatsapp-warning" role="status">Nomor WhatsApp atau tautan pelacakan belum tersedia. Periksa data pelanggan terlebih dahulu.</p>}
    {draft && !statusNotSaved ? <>
      <a className="staff-wa-button" href={draft.url} target="_blank" rel="noreferrer">
        <MessageCircle size={18} /> Buka WhatsApp
      </a>
      <details className="staff-whatsapp-preview">
        <summary>Lihat isi pesan</summary>
        <p>{draft.message}</p>
      </details>
    </> : <button type="button" className="staff-wa-button" disabled><MessageCircle size={18} /> Buka WhatsApp</button>}
  </section>;
}

export function StaffReceipt({
  order: o,
  services,
}: {
  order: Order;
  services: Service[];
}) {
  const service = services.find((item) => item.id === o.service);
  const unit = unitLabel(o.unit ?? service?.unit);
  const branch = branchLabel(o.branchId);
  const tracking =
    typeof window !== "undefined"
      ? `${window.location.origin}${dfableTrackingPath(o.token, o.branchId)}`
      : "";
  const payment = o.paymentReconciliationRequired
    ? "Perlu pemeriksaan"
    : o.paid
      ? o.paymentMethod === "cash"
        ? "Lunas · Tunai"
        : o.paymentMethod === "points"
          ? "Lunas · Poin"
          : o.paymentMethod === "membership"
            ? "Lunas · Saldo membership"
            : "Lunas"
      : o.manualPayment?.status === "awaiting_review"
        ? "Perlu konfirmasi"
        : "Belum lunas";
  return (
    <div className="staff-receipt" aria-hidden="true">
      <h1>{branch}</h1>
      <h2>STRUK PESANAN</h2>
      <div className="staff-receipt-row">
        <span>No. pesanan</span>
        <b>{o.id}</b>
      </div>
      <div className="staff-receipt-row">
        <span>Tanggal</span>
        <span>{formatDate(o.createdAt)}</span>
      </div>
      <div className="staff-receipt-row">
        <span>Pelanggan</span>
        <span>{o.name}</span>
      </div>
      <div className="staff-receipt-row">
        <span>WhatsApp</span>
        <span>{o.phone}</span>
      </div>
      <hr />
      <div className="staff-receipt-row">
        <span>Layanan</span>
        <b>{service?.name || o.service}</b>
      </div>
      <div className="staff-receipt-row">
        <span>Jumlah</span>
        <span>
          {o.quantityPending && o.actualKg === null ? "Menunggu konfirmasi toko" : <>{o.actualKg ?? o.kg} {unit}{o.actualKg === null ? " (perkiraan)" : ""}</>}
        </span>
      </div>
      <div className="staff-receipt-row">
        <span>Pengerjaan</span>
        <span>{speedLabel(o.speed, o.express)}</span>
      </div>
      <div className="staff-receipt-row">
        <span>{o.pricePending ? "Biaya layanan mulai" : "Biaya layanan"}</span>
        <span>{o.quantityPending ? "Menunggu konfirmasi toko" : money(calculateOrderPrice(o, o.actualKg ?? o.kg))}</span>
      </div>
      {o.membershipDiscount && (
        <div className="staff-receipt-row">
          <span>Diskon membership</span>
          <span>20% sudah termasuk</span>
        </div>
      )}
      <div className="staff-receipt-row">
        <span>Ongkir</span>
        <span>
          {o.shippingFee === null ? "Belum dikonfirmasi" : money(o.shippingFee)}
        </span>
      </div>
      {o.insurance && (
        <div className="staff-receipt-row">
          <span>Perlindungan cucian</span>
          <span>{money(1000)}</span>
        </div>
      )}
      {!!o.membershipUsed && (
        <div className="staff-receipt-row">
          <span>Saldo membership</span>
          <span>−{money(o.membershipUsed)}</span>
        </div>
      )}
      {!!o.pointsUsed && (
        <div className="staff-receipt-row">
          <span>Potongan poin</span>
          <span>−{money(o.pointsUsed)}</span>
        </div>
      )}
      <hr />
      <div className="staff-receipt-row staff-receipt-total">
        <span>
          {o.pricePending || o.actualKg === null || o.shippingFee === null ? "Estimasi" : "Total"}
        </span>
        <b>{o.quantityPending ? "Menunggu konfirmasi toko" : money(o.total)}</b>
      </div>
      <div className="staff-receipt-row">
        <span>Pembayaran</span>
        <b>{payment}</b>
      </div>
      <p>Lacak pesanan: {tracking}</p>
      <p>Terima kasih telah memilih {branch}.</p>
    </div>
  );
}
