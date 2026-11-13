"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";
import "./delete-user-modal.css";

export default function DeleteUserModal({
  name,
  identifier,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  name: string;
  identifier: string;
  busy: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    cancelRef.current?.focus();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="delete-user-dialog"
      aria-labelledby="delete-user-title"
      aria-describedby="delete-user-description"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <div className="delete-user-dialog-content">
        <div className="delete-user-dialog-top">
          <span className="delete-user-dialog-icon" aria-hidden="true"><Trash2 size={22} /></span>
          <button type="button" className="delete-user-dialog-close" aria-label="Tutup" disabled={busy} onClick={onCancel}>
            <X size={19} />
          </button>
        </div>
        <h2 id="delete-user-title">Hapus akun ini?</h2>
        <p id="delete-user-description" className="delete-user-dialog-description">
          Akun akan dihapus secara permanen. Riwayat transaksi tetap tersimpan.
        </p>
        <div className="delete-user-dialog-person">
          {name && name !== identifier && <strong>{name}</strong>}
          <span>{identifier}</span>
        </div>
        <p className="delete-user-dialog-warning"><AlertTriangle size={16} aria-hidden="true" /> Tindakan ini tidak dapat dibatalkan.</p>
        {error && <p role="alert" className="delete-user-dialog-error">{error}</p>}
        <div className="delete-user-dialog-actions">
          <button ref={cancelRef} type="button" className="delete-user-dialog-cancel" disabled={busy} onClick={onCancel}>Batal</button>
          <button type="button" className="delete-user-dialog-confirm" disabled={busy} onClick={onConfirm}>
            {busy ? "Menghapus…" : "Ya, hapus akun"}
          </button>
        </div>
      </div>
    </dialog>
  );
}
