"use client";

import { useState } from "react";
import { Eye, EyeOff, QrCode } from "lucide-react";
import { STATIC_QRIS_URL } from "@/lib/payments/manual-policy";

/** This is a static QRIS. The customer enters the amount and the store verifies it. */
export default function ManualQris({ id, initiallyHidden = true }: { id: string; initiallyHidden?: boolean }) {
  const [visible, setVisible] = useState(!initiallyHidden);
  return <div className="payment-order-qr rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-center">
    <div className="flex items-center justify-center gap-2 text-sm font-semibold text-slate-800"><QrCode size={17} /> QRIS manual</div>
    <p className="!mb-3 !mt-1 text-xs leading-relaxed text-slate-600">Penerima: <strong>BUZZWASH CIBUBUR</strong></p>
    <button type="button" aria-expanded={visible} aria-controls={id} onClick={() => setVisible((current) => !current)} className="secondary !mx-auto !flex !items-center !justify-center !gap-2 !rounded-xl !px-5 !py-3 !text-sm">
      {visible ? <EyeOff size={17} /> : <Eye size={17} />}{visible ? "Sembunyikan QRIS" : "Tampilkan QRIS"}
    </button>
    {visible && <div id={id} className="mt-4">
      <a href={STATIC_QRIS_URL} target="_blank" rel="noreferrer" aria-label="Buka QRIS BuzzWash Cibubur ukuran penuh">
        <img src={STATIC_QRIS_URL} width={1135} height={1600} alt="QRIS statis penerima BuzzWash Cibubur" className="mx-auto h-auto w-full max-w-[300px] rounded-lg bg-white" />
      </a>
      <p className="!mb-0 !mt-3 text-xs leading-relaxed text-slate-600">Masukkan nominal sesuai tagihan, lalu unggah bukti. Toko akan memeriksa pembayaranmu.</p>
      <a href={STATIC_QRIS_URL} download="QRIS-BuzzWash-Cibubur.png" className="mt-2 inline-block text-xs font-semibold text-[#7a0e2f]">Simpan QRIS</a>
    </div>}
  </div>;
}
