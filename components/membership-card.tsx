"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Check,
  ChevronRight,
  Clock3,
  Copy,
  CreditCard,
  Gift,
  ImagePlus,
  QrCode,
  ShieldCheck,
  X,
} from "lucide-react";
import { money } from "@/lib/types";
import { prepareImage } from "@/lib/image-upload";
import { DEFAULT_BRANCH, activeBranchIds, branches, resolveCustomerBranch, type BranchId } from "@/lib/branches";
import { useAuth } from "./auth-provider";
import "./membership-card.css";

type Deposit = {
  amount: number;
  branchId: string;
  senderName: string;
  hasProof?: boolean;
  paymentMethod?: "bank_transfer" | "qris_static";
  qris?: { id: string; recipient: string };
  bank: { bankName: string; accountNumber: string; accountHolder: string };
};
type Membership = {
  active: boolean;
  discountEligible: boolean;
  balance: number;
  staticQrisAvailable: boolean;
  pending: Deposit | null;
  bank: {
    bankName: string;
    accountNumber: string;
    accountHolder: string;
    configured: boolean;
  };
  history: { id: string; type: string; amount: number; createdAt: string }[];
};
type DialogView = "deposit" | "code";

export default function MembershipCard() {
  const auth = useAuth();
  const [data, setData] = useState<Membership | null>(null);
  const [loadedBranch, setLoadedBranch] = useState("");
  const [amount, setAmount] = useState("100000");
  const [branch, setBranch] = useState<BranchId>(DEFAULT_BRANCH);
  const [senderName, setSenderName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"bank_transfer" | "qris_static">("bank_transfer");
  const [showQr, setShowQr] = useState(false);
  const [proof, setProof] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [view, setView] = useState<DialogView | null>(null);
  const [code, setCode] = useState<{ code: string; expiresAt: number } | null>(
    null,
  );
  const [codeBusy, setCodeBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const loadRevision = useRef(0);
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("branch");
    let saved: string | null = null;
    try { saved = localStorage.getItem("eazywash-selected-store"); } catch {}
    setBranch(resolveCustomerBranch({ requested, saved }));
  }, []);
  const load = useCallback(async () => {
    const revision = ++loadRevision.current;
    const response = await auth.request(`/api/membership?branch=${branch}`);
    const result = await response.json();
    if (!response.ok)
      throw Error(result.error || "Membership belum bisa dimuat.");
    if (revision === loadRevision.current) {
      setData(result);
      setLoadedBranch(branch);
    }
  }, [auth.request, branch]);
  useEffect(() => {
    void load().catch((error) => setMessage(error.message));
    return () => {
      loadRevision.current += 1;
    };
  }, [load]);
  useEffect(() => {
    if (!data?.pending) return;
    const refresh = () => {
      if (document.visibilityState === "visible") void load().catch(() => {});
    };
    const interval = window.setInterval(refresh, 15000);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, [data?.pending, load]);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (view && !element.open) element.showModal();
    if (!view && element.open) element.close();
  }, [view]);

  function open(nextView: DialogView) {
    setMessage("");
    setCopied(false);
    setCode(null);
    try {
      setBranch(resolveCustomerBranch({ saved: localStorage.getItem("eazywash-selected-store") }));
    } catch {}
    setView(nextView);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loadedBranch !== branch || !data?.bank.configured) {
      setMessage("Tunggu informasi rekening toko selesai dimuat.");
      return;
    }
    if (paymentMethod === "qris_static" && !data.staticQrisAvailable) {
      setMessage("QRIS belum tersedia untuk rekening ini. Pilih transfer bank.");
      return;
    }
    if (!proof) {
      setMessage("Pilih bukti pembayaran terlebih dahulu.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const image = await prepareImage(proof);
      const upload = await auth.request(
        `/api/membership/proof?branch=${encodeURIComponent(branch)}`,
        {
          method: "POST",
          headers: { "Content-Type": "image/jpeg" },
          body: image,
        },
      );
      const uploaded = await upload.json();
      if (!upload.ok || typeof uploaded.proofVersion !== "string")
        throw Error(
          uploaded.error || "Bukti pembayaran belum berhasil diunggah.",
        );
      const response = await auth.request("/api/membership", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(amount),
          branch,
          senderName,
          paymentMethod,
          proofVersion: uploaded.proofVersion,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw Error(result.error || "Deposit belum berhasil diajukan.");
      setProof(null);
      await load();
      setMessage("Bukti terkirim. Toko akan memeriksa pembayaranmu.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Deposit belum berhasil diajukan.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function createCode() {
    setCodeBusy(true);
    setMessage("");
    setCode(null);
    try {
      const response = await auth.request("/api/membership/code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branch }),
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || "Kode belum bisa dibuat.");
      setCode(result);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Kode belum bisa dibuat.",
      );
    } finally {
      setCodeBusy(false);
    }
  }
  async function copyAccount(account: string) {
    try {
      await navigator.clipboard.writeText(account);
      setCopied(true);
    } catch {
      setMessage(
        "Nomor rekening belum bisa disalin. Silakan salin secara manual.",
      );
    }
  }
  const isPending = !!data?.pending;
  const bank = data?.pending?.bank || data?.bank;
  const status = data?.active
    ? "Terverifikasi"
    : isPending
      ? "Menunggu verifikasi"
      : "Belum aktif";
  const title =
    view === "code"
      ? "Kode member"
      : isPending
        ? "Status deposit"
        : data?.active
          ? "Isi saldo membership"
          : "Aktifkan membership";

  return (
    <>
      <section className="member-summary" aria-label="Membership laundry">
        <div className="member-summary-head">
          <span className="member-summary-icon">
            <CreditCard size={20} aria-hidden="true" />
          </span>
          <div className="member-summary-title">
            <h2>Membership</h2>
            <p>Berlaku di D’Fable dan BuzzWash</p>
          </div>
          {data && (
            <span
              className={`member-badge ${data.active ? "is-verified" : isPending ? "is-pending" : "is-inactive"}`}
            >
              {data.active ? (
                <BadgeCheck size={13} />
              ) : isPending ? (
                <Clock3 size={13} />
              ) : null}
              {status}
            </span>
          )}
        </div>
        <div className="member-summary-balance">
          <span>Saldo membership</span>
          <strong>{data ? money(data.balance) : "-"}</strong>
        </div>
        {isPending && (
          <p className="member-summary-pending">
            <Clock3 size={14} /> Deposit {money(data!.pending!.amount)} menunggu
            konfirmasi
          </p>
        )}
        {data?.active && data.balance === 0 && (
          <p className="member-summary-note">
            Isi saldo untuk mendapatkan diskon layanan 20%.
          </p>
        )}
        {data?.active && data.balance > 0 && !data.discountEligible && (
          <p className="member-summary-note">Saldo sedang diperiksa toko.</p>
        )}
        <div className="member-summary-actions">
          <button
            type="button"
            className="member-primary"
            disabled={!data}
            onClick={() => open("deposit")}
          >
            {isPending
              ? "Lihat status"
              : data?.active
                ? "Isi saldo"
                : "Aktifkan membership"}
            <ArrowRight size={16} />
          </button>
          {data?.discountEligible && (
            <button
              type="button"
              className="member-code-link"
              onClick={() => open("code")}
            >
              Kode member <ChevronRight size={16} />
            </button>
          )}
        </div>
        {!data && message && (
          <p className="member-summary-error" role="alert">
            {message}{" "}
            <button
              type="button"
              onClick={() =>
                void load().catch((error) => setMessage(error.message))
              }
            >
              Coba lagi
            </button>
          </p>
        )}
      </section>
      <dialog
        ref={dialog}
        className="member-dialog"
        aria-labelledby="member-dialog-title"
        onClose={() => setView(null)}
        onCancel={(event) => {
          if (busy) event.preventDefault();
        }}
      >
        <div className="member-dialog-head">
          <div>
            <span className="member-kicker">MEMBERSHIP LAUNDRY</span>
            <h2 id="member-dialog-title">{title}</h2>
          </div>
          <button
            type="button"
            className="member-close"
            aria-label="Tutup"
            disabled={busy}
            onClick={() => setView(null)}
          >
            <X size={20} />
          </button>
        </div>
        <div className="member-dialog-content">
          {(view === "code" || !isPending) && (
            <label className="member-field">
              Toko {view === "code" ? "untuk kode member" : "penerima deposit"}
              <select
                value={branch}
                disabled={busy || codeBusy}
                onChange={(event) => {
                  setCode(null);
                  setCopied(false);
                  setMessage("");
                  setPaymentMethod("bank_transfer");
                  setShowQr(false);
                  setBranch(event.target.value as BranchId);
                }}
              >
                {activeBranchIds.map((id) => <option key={id} value={id}>{branches[id]}</option>)}
              </select>
            </label>
          )}
          {view === "code" ? (
            <div className="member-code-panel">
              <div className="member-benefit">
                <span>
                  <ShieldCheck size={20} />
                </span>
                <div>
                  <b>Untuk pesanan di {branches[branch]}</b>
                  <p>
                    Tunjukkan kode sekali pakai kepada staf saat mencatat
                    pesanan.
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="member-primary member-wide"
                disabled={codeBusy}
                onClick={() => void createCode()}
              >
                {codeBusy ? "Menyiapkan…" : "Buat kode member"}
                <ArrowRight size={16} />
              </button>
              {code && (
                <div className="member-code-value">
                  <span>KODE SEKALI PAKAI</span>
                  <strong>{code.code}</strong>
                  <small>
                    Berlaku sampai{" "}
                    {new Date(code.expiresAt).toLocaleTimeString("id-ID", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    . Kode baru membatalkan kode sebelumnya.
                  </small>
                </div>
              )}
            </div>
          ) : isPending ? (
            <div className="member-pending-panel">
              <span className="member-pending-icon">
                <Clock3 size={25} />
              </span>
              <h3>Deposit sedang diperiksa</h3>
              <p>
                Tim toko akan mencocokkan pembayaran sebelum saldo ditambahkan.
              </p>
              <div className="member-pending-details">
                <div>
                  <span>Nominal deposit</span>
                  <b>{money(data!.pending!.amount)}</b>
                </div>
                <div>
                  <span>Toko</span>
                  <b>{branches[resolveCustomerBranch({ requested: data!.pending!.branchId })]}</b>
                </div>
                <div>
                  <span>Metode pembayaran</span>
                  <b>{data!.pending!.paymentMethod === "qris_static" ? "QRIS manual" : "Transfer bank"}</b>
                </div>
                <div>
                  <span>Bukti pembayaran</span>
                  <b>
                    {data!.pending!.hasProof
                      ? "Sudah diunggah"
                      : "Belum diunggah"}
                  </b>
                </div>
              </div>
              {!data!.pending!.hasProof && (
                <p className="member-legacy-note">
                  Pengajuan ini dibuat sebelum unggah bukti tersedia. Hubungi
                  toko untuk pemeriksaan transfer.
                </p>
              )}
            </div>
          ) : (
            <form onSubmit={(event) => void submit(event)}>
              <div className="member-benefit">
                <span>
                  <Gift size={20} />
                </span>
                <div>
                  <b>Diskon layanan 20% di kedua toko</b>
                  <p>
                    Deposit menjadi saldo Washloka yang dapat digunakan di D’Fable dan BuzzWash. Diskon berlaku saat saldo tersedia.
                  </p>
                </div>
              </div>
              <label className="member-field">
                Nominal deposit
                <input
                  type="number"
                  min="100000"
                  max="10000000"
                  step="1000"
                  required
                  disabled={busy}
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
                <small>Minimal Rp100.000</small>
              </label>
              <label className="member-field">
                  Nama pengirim
                <input
                  value={senderName}
                  onChange={(event) => setSenderName(event.target.value)}
                  placeholder={paymentMethod === "qris_static" ? "Nama sesuai akun pembayaran" : "Nama sesuai rekening"}
                  minLength={2}
                  maxLength={100}
                  required
                  disabled={busy}
                />
              </label>
              <fieldset className="member-methods">
                <legend>Metode pembayaran</legend>
                <div>
                  <label className={paymentMethod === "bank_transfer" ? "selected" : ""}>
                    <input type="radio" name="member-payment" value="bank_transfer" checked={paymentMethod === "bank_transfer"} disabled={busy} onChange={() => { setPaymentMethod("bank_transfer"); setShowQr(false); }} />
                    <Building2 size={18} /> Transfer bank
                  </label>
                  {loadedBranch === branch && data?.staticQrisAvailable && <label className={paymentMethod === "qris_static" ? "selected" : ""}>
                    <input type="radio" name="member-payment" value="qris_static" checked={paymentMethod === "qris_static"} disabled={busy} onChange={() => setPaymentMethod("qris_static")} />
                    <QrCode size={18} /> QRIS manual
                  </label>}
                </div>
              </fieldset>
              {loadedBranch !== branch ? (
                <p className="member-form-message" role="status">
                  Memuat rekening toko…
                </p>
              ) : paymentMethod === "qris_static" && data?.staticQrisAvailable ? (
                <div className="member-qris">
                  <strong>QRIS BUZZWASH CIBUBUR</strong>
                  <p>Masukkan nominal deposit saat membayar, lalu unggah bukti pembayaran.</p>
                  <button type="button" onClick={() => setShowQr((value) => !value)} aria-expanded={showQr} aria-controls="member-qris-image">
                    {showQr ? "Sembunyikan QRIS" : "Tampilkan QRIS"}
                  </button>
                  {showQr && <>
                    <img id="member-qris-image" src="/buzzwash-qris-static.png" alt="QRIS manual BUZZWASH CIBUBUR" />
                    <a href="/buzzwash-qris-static.png" download="QRIS-BuzzWash.png">Simpan gambar QRIS</a>
                    <p>Simpan gambar untuk membayar dari aplikasi di HP yang sama.</p>
                  </>}
                </div>
              ) : data?.bank.configured ? (
                <div className="member-bank">
                  <div>
                    <span>TRANSFER KE {bank?.bankName?.toUpperCase()}</span>
                    <strong>{bank?.accountNumber}</strong>
                    <small>a.n. {bank?.accountHolder}</small>
                  </div>
                  <button
                    type="button"
                    onClick={() => void copyAccount(bank!.accountNumber)}
                    aria-label="Salin nomor rekening"
                  >
                    {copied ? <Check size={17} /> : <Copy size={17} />}
                    {copied ? "Tersalin" : "Salin"}
                  </button>
                </div>
              ) : (
                <p className="member-form-message">
                  Rekening toko belum tersedia. Hubungi toko untuk bantuan.
                </p>
              )}
              <label className="member-upload">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={busy}
                  onChange={(event) => {
                    setProof(event.target.files?.[0] || null);
                    setMessage("");
                  }}
                />
                <span>
                  <ImagePlus size={21} />
                </span>
                <div>
                  <b>{proof ? proof.name : "Unggah bukti pembayaran"}</b>
                  <small>
                    {proof
                      ? "Ketuk untuk mengganti foto"
                      : "JPG, PNG, atau WebP · maks. 8 MB"}
                  </small>
                </div>
                <ChevronRight size={18} />
              </label>
              <button
                type="submit"
                className="member-primary member-wide"
                disabled={
                  busy ||
                  loadedBranch !== branch ||
                  !data?.bank.configured ||
                  (paymentMethod === "qris_static" && !data?.staticQrisAvailable) ||
                  !proof
                }
              >
                {busy ? (
                  "Mengirim bukti…"
                ) : (
                  <>
                    Kirim untuk diperiksa <ArrowRight size={16} />
                  </>
                )}
              </button>
              <p className="member-form-foot">
                Saldo ditambahkan setelah pembayaran dikonfirmasi toko.
              </p>
            </form>
          )}
          {message && (
            <p className="member-form-message" role="status">
              {message}
            </p>
          )}
          {view === "deposit" && !!data?.history.length && (
            <details className="member-history">
              <summary>Riwayat saldo</summary>
              <ul>
                {data.history.map((event) => (
                  <li key={event.id}>
                    <span>
                      {event.type === "deposit"
                        ? "Deposit dikonfirmasi"
                        : event.type === "returned"
                          ? "Saldo dikembalikan"
                          : "Digunakan untuk cuci"}
                      <small>
                        {new Date(event.createdAt).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </small>
                    </span>
                    <b>
                      {event.type === "redeemed" ? "−" : "+"}
                      {money(event.amount)}
                    </b>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </dialog>
    </>
  );
}
