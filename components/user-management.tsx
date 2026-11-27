"use client";
import { useEffect, useState } from "react";
import { Plus, ShieldCheck, User, Trash2, Save, Wallet } from "lucide-react";
import { useAuth } from "./auth-provider";
import MembershipAdmin from "./membership-admin";
import DeleteUserModal from "./delete-user-modal";
import { branches as branchNames, type BranchId } from "@/lib/branches";
import { money } from "@/lib/types";
type Row = {
  uid: string;
  email: string;
  phone: string;
  createdAt: string;
  name: string;
  role: string;
  disabled: boolean;
  verified: boolean;
  self: boolean;
  providers: string[];
  phoneAccount?: boolean;
  branches: BranchId[];
  membership?: {
    registered: boolean;
    active: boolean;
    balance: number | null;
    reconciliationRequired: boolean;
  } | null;
};
export default function UserManagement({ branch, allowedBranches }: { branch: BranchId; allowedBranches: BranchId[] }) {
  const auth = useAuth();
  const [users, setUsers] = useState<Row[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState<Row | null>(null);
  const [canDeleteAccounts, setCanDeleteAccounts] = useState(false);
  async function load(next?: string) {
    setError("");
    try {
      const r = await auth.request(
        `/api/admin/users?branch=${encodeURIComponent(branch)}` +
          (next ? "&cursor=" + encodeURIComponent(next) : ""),
      );
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setUsers((prev) => (next ? [...prev, ...d.users] : d.users));
      setCursor(d.cursor);
      setCanDeleteAccounts(d.canDeleteAccounts === true);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    load();
  }, [branch]);
  async function mutate(data: unknown) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await auth.request(`/api/admin/users?branch=${encodeURIComponent(branch)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setNotice("Perubahan tersimpan.");
      setAdding(false);
      setPending(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="user-management">
      <MembershipAdmin key={branch} branch={branch} onBalanceChanged={canDeleteAccounts ? () => void load() : undefined} />
      <div className="users-toolbar">
        <div>
          <h2>Tim & pelanggan</h2>
          <p>Kelola akun pelanggan dan akses tim toko.</p>
        </div>
        <button className="primary" onClick={() => setAdding(!adding)}>
          <Plus size={17} /> Tambah pengguna
        </button>
      </div>
      <div className="role-guide">
        <span>
          <b>Pemilik / Admin</b> Pengguna, harga, promosi, dan operasional
        </span>
        <span>
          <b>Staf</b> Pesanan dan POS
        </span>
        <span>
          <b>Pelanggan</b> Pesanan pribadi
        </span>
      </div>
      {adding && (
        <form
          className="panel auth-form"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            mutate({
              action: "create",
              name: f.get("name"),
              email: f.get("email"),
              password: f.get("password"),
              role: f.get("role"),
              branches: f.getAll("branches"),
            });
          }}
        >
          <h3>Akun baru</h3>
          <div className="form-two">
            <label>
              Nama
              <input name="name" required maxLength={100} />
            </label>
            <label>
              Email
              <input name="email" type="email" required />
            </label>
          </div>
          <fieldset className="user-store-access user-store-access-create">
            <legend>Akses toko untuk staf atau admin</legend>
            <div className="user-store-access-options">
              {allowedBranches.map((id) => (
                <label key={id}>
                  <input type="checkbox" name="branches" value={id} defaultChecked={id === branch} />
                  <span>{branchNames[id]}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="form-two">
            <label>
              Password awal
              <input
                name="password"
                type="password"
                minLength={8}
                maxLength={128}
                required
                autoComplete="new-password"
                placeholder="Minimal 8 karakter"
              />
            </label>
            <label>
              Akses
              <select name="role" defaultValue="staff">
                <option value="customer">Pelanggan</option>
                <option value="staff">Staf</option>
                <option value="admin">Admin</option>
              </select>
            </label>
          </div>
          <p className="muted">
            Pengguna perlu memverifikasi email saat pertama kali masuk. Password
            tidak bisa dilihat lagi setelah disimpan.
          </p>
          <button disabled={busy} className="primary">
            Buat pengguna
          </button>
        </form>
      )}
      {error && !pending && (
        <p role="alert" className="auth-error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="auth-notice">
          {notice}
        </p>
      )}
      {pending && (
        <DeleteUserModal
          name={pending.name}
          identifier={pending.email || pending.phone || pending.name}
          busy={busy}
          error={error}
          onCancel={() => { setPending(null); setError(""); }}
          onConfirm={() => mutate({ action: "delete", uid: pending.uid })}
        />
      )}
      <label className="users-search">
        <span className="sr-only">Cari pengguna dari daftar yang dimuat</span>
        <input
          type="search"
          placeholder="Cari nama, email, atau WhatsApp"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <div className="users-list">
        {users
          .filter((u) =>
            `${u.name} ${u.email} ${u.phone || ""}`
              .toLowerCase()
              .includes(query.toLowerCase()),
          )
          .map((u) => (
            <UserRow
              key={u.uid}
              row={u}
              busy={busy}
              branch={branch}
              allowedBranches={allowedBranches}
              canDeleteAccounts={canDeleteAccounts}
              onSave={(role, disabled, branches) =>
                mutate({ action: "access", uid: u.uid, role, disabled, branches })
              }
              onDelete={() => { setError(""); setPending(u); }}
            />
          ))}
      </div>
      {!users.length && !error && <p className="muted">Memuat pengguna…</p>}
      {cursor && (
        <button
          className="secondary"
          disabled={busy}
          onClick={() => load(cursor)}
        >
          Lihat pengguna lainnya
        </button>
      )}
    </section>
  );
}
function UserRow({
  row,
  busy,
  branch,
  allowedBranches,
  canDeleteAccounts,
  onSave,
  onDelete,
}: {
  row: Row;
  busy: boolean;
  branch: BranchId;
  allowedBranches: BranchId[];
  canDeleteAccounts: boolean;
  onSave: (role: string, disabled: boolean, branches: BranchId[]) => void;
  onDelete: () => void;
}) {
  const [role, setRole] = useState(row.role);
  const [disabled, setDisabled] = useState(row.disabled);
  const [selectedBranches, setSelectedBranches] = useState<BranchId[]>(row.branches);
  const protectedUser = row.self || row.role === "owner";
  const membership = row.membership;
  const membershipLabel = !membership ? "Membership belum bisa dimuat"
    : membership.active ? "Member aktif"
      : membership.registered ? "Membership terdaftar" : "Belum menjadi member";
  useEffect(() => {
    setRole(row.role);
    setDisabled(row.disabled);
    setSelectedBranches(row.branches);
  }, [row]);
  return (
    <article className="user-row">
      <span className="user-row-icon">
        {row.role === "customer" ? (
          <User size={21} />
        ) : (
          <ShieldCheck size={21} />
        )}
      </span>
      <div className="user-row-info">
        <b>
          {row.name || "Tanpa nama"}
          {row.self ? " · kamu" : ""}
        </b>
        {row.email && <span>{row.email}</span>}
        <span>WhatsApp: {row.phone || "Belum diisi"}</span>
        {row.createdAt && !Number.isNaN(Date.parse(row.createdAt)) && (
          <small>
            Terdaftar {new Date(row.createdAt).toLocaleDateString("id-ID")}
          </small>
        )}
        <small>
          {row.phoneAccount
            ? "Nomor belum diverifikasi"
            : row.verified
              ? "Email terverifikasi"
              : "Email belum diverifikasi"}{" "}
          · {row.disabled ? "Nonaktif" : "Aktif"}
        </small>
        {membership !== undefined && (
          <div className="user-membership" data-active={membership?.active || undefined}>
            <Wallet size={14} aria-hidden="true" />
            <span>{membershipLabel}</span>
            {membership?.registered && (
              <strong>{membership.balance === null ? "Saldo belum tersedia" : money(membership.balance)}</strong>
            )}
            {membership?.reconciliationRequired && <small>Saldo sedang diperiksa</small>}
          </div>
        )}
      </div>
      <div className="user-row-controls">
        <div className="user-row-main-controls">
        <label className="user-role-select">
          <span className="sr-only">Peran {row.name || row.email || row.phone}</span>
          <select
            value={role}
            disabled={protectedUser || busy}
            onChange={(e) => setRole(e.target.value)}
          >
            {row.role === "owner" && <option value="owner">Pemilik</option>}
            <option value="customer">Pelanggan</option>
            <option value="staff" disabled={row.phoneAccount}>
              Staf
            </option>
            <option value="admin" disabled={row.phoneAccount}>
              Admin
            </option>
          </select>
        </label>
        <label className="user-disabled">
          <input
            type="checkbox"
            checked={disabled}
            disabled={protectedUser || busy || !canDeleteAccounts}
            onChange={(e) => setDisabled(e.target.checked)}
          />{" "}
          Nonaktif
        </label>
        <button
          type="button"
          className="user-control-button"
          title="Simpan akses"
          aria-label={`Simpan akses ${row.name || row.email || row.phone}`}
          disabled={
            protectedUser ||
            busy ||
            (role === row.role && disabled === row.disabled && selectedBranches.length === row.branches.length && selectedBranches.every((id) => row.branches.includes(id)))
          }
          onClick={() => onSave(role, disabled, role === "customer" ? [] : selectedBranches.length ? selectedBranches : [branch])}
        >
          <Save size={17} />
        </button>
        <button
          type="button"
          className="user-control-button danger-action"
          title="Hapus pengguna"
          aria-label={`Hapus ${row.name || row.email || row.phone}`}
          disabled={protectedUser || busy || !canDeleteAccounts}
          onClick={onDelete}
        >
          <Trash2 size={17} />
        </button>
        </div>
        {role !== "customer" && role !== "owner" && (
          <fieldset className="user-store-access">
            <legend>Akses toko</legend>
            <div className="user-store-access-options">
              {allowedBranches.map((id) => (
                <label key={id}>
                  <input type="checkbox" checked={selectedBranches.includes(id)} disabled={protectedUser || busy}
                    onChange={(event) => setSelectedBranches((current) => event.target.checked ? [...new Set([...current, id])] : current.filter((value) => value !== id))} />
                  <span>{branchNames[id]}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}
      </div>
    </article>
  );
}
