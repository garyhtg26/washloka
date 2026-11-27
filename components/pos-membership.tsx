"use client";

import { UserRoundPlus, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import type { BranchId } from "@/lib/branches";
import { normalizePhone } from "@/lib/pricing";
import { money } from "@/lib/types";
import { useAuth } from "./auth-provider";
import "./pos-membership.css";

type Member = {
  name: string;
  reference: string;
  active: boolean;
  balance: number;
  discountEligible: boolean;
};

type Membership = { accountExists: boolean; member: Member | null };

function membershipResponse(data: unknown): Membership {
  const response = data as Partial<Membership> | null;
  const member = response?.member;
  if (typeof response?.accountExists !== "boolean" || (member !== null && (
    typeof member?.name !== "string" || typeof member.reference !== "string" || typeof member.active !== "boolean" ||
    !Number.isSafeInteger(member.balance) || member.balance < 0 || typeof member.discountEligible !== "boolean"
  ))) throw Error("Data membership belum bisa dimuat. Coba lagi.");
  return { accountExists: response.accountExists, member };
}

export function usePosMembership(branch: BranchId, phone: string, enabled = true) {
  const { request } = useAuth();
  const normalized = normalizePhone(phone);
  const validPhone = /^\+628\d{7,12}$/.test(normalized);
  const endpoint = `/api/pos/membership?branch=${encodeURIComponent(branch)}`;
  const key = enabled && validPhone ? `${branch}:${normalized}` : "";
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    attempt: number;
    data?: Membership;
    error?: string;
  }>();
  const [activationPending, setActivationPending] = useState(false);
  const current = result?.key === key && result.attempt === attempt ? result : undefined;

  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    const url = `${endpoint}&phone=${encodeURIComponent(normalized)}`;
    const timer = setTimeout(() => {
      void request(url, { cache: "no-store", signal: controller.signal })
        .then(async (response) => {
          const data = await response.json().catch(() => null);
          if (!response.ok) throw Error(data?.error || "Membership belum bisa dicek.");
          const checked = membershipResponse(data);
          if (!controller.signal.aborted) setResult({ key, attempt, data: checked });
        })
        .catch((error: unknown) => {
          if (!controller.signal.aborted)
            setResult({ key, attempt, error: error instanceof Error ? error.message : "Membership belum bisa dicek." });
        });
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key, attempt, normalized, request, endpoint]);

  async function activate(name: string, password?: string) {
    if (!key || activationPending) return;
    setActivationPending(true);
    try {
      const response = await request(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone: normalized, ...(password ? { password } : {}) }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw Error(data?.error || "Membership belum bisa diaktifkan.");
      setResult({ key, attempt, data: membershipResponse(data) });
    } finally {
      setActivationPending(false);
    }
  }

  return {
    key,
    data: current?.data,
    error: current?.error,
    loading: !!key && !current,
    activationPending,
    activate,
    refresh: () => setAttempt((value) => value + 1),
  };
}

export function PosMembershipDetails({ lookup, name, disabled = false }: {
  lookup: ReturnType<typeof usePosMembership>;
  name: string;
  disabled?: boolean;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const data = lookup.data;
  const member = data?.member;
  const needsPassword = data?.accountExists === false;

  async function activateMembership() {
    setError("");
    if (name.trim().length < 2) {
      setError("Isi nama pelanggan terlebih dahulu.");
      return;
    }
    if (needsPassword && !showPassword) {
      setShowPassword(true);
      return;
    }
    if (needsPassword && password.length < 8) {
      setError("Kata sandi minimal 8 karakter.");
      return;
    }
    try {
      await lookup.activate(name, needsPassword ? password : undefined);
      setPassword("");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Membership belum bisa diaktifkan.");
    }
  }

  if (!lookup.key) return null;
  return (
    <section className="pos-member-panel" aria-label="Membership Washloka">
      <div className="pos-member-header" aria-live="polite">
        <span className="pos-member-icon"><Wallet size={19} aria-hidden="true" /></span>
        <div>
          <h3>{member?.active ? "Membership aktif" : "Membership Washloka"}</h3>
          <p>
            {lookup.loading ? "Mengecek nomor WhatsApp…" : lookup.error || (
              member?.active ? <>{member.name && `${member.name} · `}<b>Saldo {money(member.balance)}</b></> :
                data?.accountExists ? "Akun ditemukan. Membership bisa diaktifkan di sini." : "Pelanggan belum punya akun Washloka."
            )}
          </p>
        </div>
      </div>
      {lookup.error && <button className="text-button" type="button" disabled={disabled} onClick={lookup.refresh}>Coba cek lagi</button>}
      {data && !member?.active && (
        <>
          {needsPassword && showPassword && (
            <label>
              Kata sandi akun Washloka
              <input type="password" autoComplete="new-password" maxLength={128}
                value={password} disabled={lookup.activationPending || disabled} onChange={(event) => setPassword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  if (!lookup.activationPending && !disabled) void activateMembership();
                }}
              />
              <small>Minta pelanggan memilih kata sandi sendiri, minimal 8 karakter. Nomor WhatsApp ini dipakai untuk masuk.</small>
            </label>
          )}
          <button className="secondary" type="button" disabled={lookup.activationPending || disabled} onClick={() => void activateMembership()}>
            <UserRoundPlus size={17} aria-hidden="true" />
            {lookup.activationPending ? "Mengaktifkan…" : needsPassword && !showPassword ? "Buka akun member" : "Aktifkan membership"}
          </button>
        </>
      )}
      {member?.active && !member.discountEligible && (
        <p>{member.balance ? "Saldo belum bisa digunakan saat ini." : "Isi saldo agar diskon layanan dan pemakaian saldo tersedia."}</p>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
    </section>
  );
}

export default function PosMembershipForm({ branch }: { branch: BranchId }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const lookup = usePosMembership(branch, phone);
  return (
    <form onSubmit={(event) => event.preventDefault()}>
      <h2>Membership Washloka</h2>
      <p>Masukkan nomor WhatsApp pelanggan untuk mengecek akun atau membuka membership.</p>
      <div className="form-two">
        <label>
          Nama pelanggan
          <input value={name} maxLength={80} autoComplete="off" disabled={lookup.activationPending}
            onChange={(event) => setName(event.target.value)} placeholder="Nama lengkap" />
        </label>
        <label>
          Nomor WhatsApp
          <input type="tel" value={phone} maxLength={22} autoComplete="off" disabled={lookup.activationPending}
            onChange={(event) => setPhone(event.target.value)} placeholder="08xxxxxxxxxx" />
        </label>
      </div>
      <PosMembershipDetails key={lookup.key} lookup={lookup} name={name} />
    </form>
  );
}
