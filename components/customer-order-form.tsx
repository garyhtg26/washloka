"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Check, MapPin, Store, Truck, Wallet } from "lucide-react";
import { useAuth } from "./auth-provider";
import { defaultSpeed, serviceAvailableSpeeds, serviceRate, serviceSpeeds, serviceUnitRate, unitLabel } from "@/lib/catalog";
import { money, type Service, type ServiceSpeed } from "@/lib/types";
import type { BranchId } from "@/lib/branches";
import "./customer-order-form.css";

const MapPicker = dynamic(() => import("./map-picker"), {
  ssr: false,
  loading: () => <div className="map-loading">Memuat peta…</div>,
});

export default function CustomerOrderForm({ branchId, branchName, initialLocation, services, initialService, profile, busy, submit }: {
  branchId: BranchId;
  branchName: string;
  initialLocation: { latitude: number; longitude: number };
  services: Service[];
  initialService: string;
  profile: { name: string; phone: string };
  busy: boolean;
  submit: (data: unknown) => Promise<void>;
}) {
  const auth = useAuth();
  const [requestId] = useState(() => crypto.randomUUID());
  const [step, setStep] = useState(1);
  const formRef = useRef<HTMLFormElement>(null);
  const [service, setService] = useState(() => services.some((item) => item.id === initialService) ? initialService : services[0].id);
  const selected = services.find((item) => item.id === service) || services[0];
  const [speed, setSpeed] = useState<ServiceSpeed>(() => defaultSpeed(selected));
  const [name, setName] = useState(profile.name || "");
  const [phone, setPhone] = useState(profile.phone || "");
  const [notes, setNotes] = useState("");
  const [fulfillment, setFulfillment] = useState<"delivery" | "dropoff">("delivery");
  const [address, setAddress] = useState("");
  const [location, setLocation] = useState(initialLocation);
  const [locationChosen, setLocationChosen] = useState(false);
  const [error, setError] = useState("");
  const [rewards, setRewards] = useState<{ membership: number; points: number; memberActive: boolean; pointsBlocked: boolean } | null>(null);
  const [rewardsError, setRewardsError] = useState(false);
  const [rewardsAttempt, setRewardsAttempt] = useState(0);
  const [useMembershipBalance, setUseMembershipBalance] = useState(false);
  // Some services publish a price for a minimum block of kilograms, while
  // others are fixed-price packages. Present the same unit as the price list.
  const rate = selected.packageSize ? serviceRate(selected, speed) : serviceUnitRate(selected, speed);
  const estimateRate = rewards?.memberActive ? Math.round(rate * 0.8) : rate;
  const estimateUnit = selected.pricingModel === "flat-package" ? "paket" : selected.packageSize ? `${selected.packageSize} ${unitLabel(selected.unit)}` : unitLabel(selected.unit);
  const estimatedPoints = Math.floor(estimateRate / 10);

  useEffect(() => {
    // The dialog itself scrolls, so the next step should begin at its heading.
    formRef.current?.closest("dialog")?.scrollTo({ top: 0, behavior: "auto" });
  }, [step]);

  useEffect(() => {
    if (!auth.user || !auth.verified) return;
    let active = true;
    setRewards(null);
    setRewardsError(false);
    void Promise.all([
      auth.request(`/api/membership?branch=${encodeURIComponent(branchId)}`),
      auth.request("/api/loyalty"),
    ]).then(async ([member, loyalty]) => {
      if (!member.ok || !loyalty.ok) throw Error();
      const [m, p] = await Promise.all([member.json(), loyalty.json()]);
      if (!Number.isSafeInteger(m.balance) || m.balance < 0 || !Number.isSafeInteger(p.balance) || p.balance < 0) throw Error();
      if (!active) return;
      const memberActive = m.discountEligible === true;
      setRewards({ membership: m.balance, points: p.balance, memberActive, pointsBlocked: p.reconciliationRequired === true });
      setUseMembershipBalance(memberActive);
    }).catch(() => { if (active) setRewardsError(true); });
    return () => { active = false; };
  }, [auth.user?.uid, auth.verified, auth.request, branchId, rewardsAttempt]);

  function selectService(id: string) {
    const next = services.find((item) => item.id === id);
    if (!next) return;
    setService(id);
    setSpeed(defaultSpeed(next));
  }

  return (
    <form ref={formRef} className="customer-order" onSubmit={async (event) => {
      event.preventDefault();
      setError("");
      if (step === 1) { setStep(2); return; }
      if (fulfillment === "delivery" && !locationChosen) {
        setError("Pilih titik penjemputan di peta terlebih dahulu.");
        return;
      }
      try {
        await submit({ source: "web", requestId, service, speed, name: name.trim(), phone: phone.trim(), notes: notes.trim(), fulfillment,
          ...(fulfillment === "delivery" ? { address: address.trim(), lat: location.latitude, lng: location.longitude } : {}),
          ...(auth.user && auth.verified && rewards ? { useMembershipBalance, usePoints: false, membershipLimit: rewards.membership, pointsLimit: rewards.points } : {}),
        });
      } catch (err) { setError(err instanceof Error ? err.message : "Pesanan belum bisa dibuat. Coba lagi."); }
    }}>
      <header className="customer-order-header">
        <p className="customer-order-eyebrow">PESAN LAUNDRY <span>·</span> {branchName.toUpperCase()}</p>
        <h2>{step === 1 ? "Mulai pesanan" : "Cara antar cucian"}</h2>
        <p>{step === 1 ? "Pilih layanan dan isi kontakmu." : "Pilih cara yang paling nyaman untukmu."}</p>
      </header>
      <div className="customer-order-steps" aria-label={`Langkah ${step} dari 2`}>
        <span className={step === 1 ? "active" : "done"}><b>{step === 2 ? <Check size={14} /> : "1"}</b> Layanan & kontak</span>
        <span className={step === 2 ? "active" : ""}><b>2</b> Antar cucian</span>
      </div>
      {step === 1 ? <>
        <div className="customer-order-section-heading"><h3>Pilih layanan</h3><p>Harga akhir dihitung setelah cucian ditimbang.</p></div>
        <div className="choice-services" role="group" aria-label="Pilih layanan">
          {services.filter((item) => item.category === "daily").map((item) => <button type="button" key={item.id} className={service === item.id ? "selected" : ""} aria-pressed={service === item.id} onClick={() => selectService(item.id)}>
            <span><b>{item.name}</b><small>{money(serviceRate(item))} / {item.packageSize ? `${item.packageSize} kg` : item.unit}</small></span><span className="radio-dot">{service === item.id && <Check size={12} />}</span>
          </button>)}
          <label className="customer-order-other">Layanan satuan & lainnya
            <select value={selected.category === "daily" ? "" : selected.id} onChange={(event) => selectService(event.target.value)}>
              <option value="">Pilih layanan lainnya</option>
              {services.filter((item) => item.category !== "daily" && item.category !== "member").map((item) => <option key={item.id} value={item.id}>{item.name} · {money(item.price)} / {item.unit}</option>)}
            </select>
          </label>
        </div>
        {selected.rates && <fieldset className="customer-order-speeds"><legend>Waktu penyelesaian</legend><div>
          {serviceSpeeds.filter((item) => serviceAvailableSpeeds(selected).includes(item.id)).map((item) => <label key={item.id} className={speed === item.id ? "selected" : ""}>
            <input type="radio" name="customerSpeed" checked={speed === item.id} onChange={() => setSpeed(item.id)} />
            <span><b>{branchId === "buzzwash" && item.id === "quick" ? "Kilat" : item.label}</b><small>{item.days}</small></span>
          </label>)}
        </div></fieldset>}
        <section className="customer-order-estimate" aria-label="Perkiraan harga layanan">
          <div className="customer-order-estimate-heading"><span>Perkiraan harga layanan</span><strong>{selected.startingAt ? "Mulai " : ""}{money(estimateRate)} <small>/ {estimateUnit}</small></strong></div>
          {selected.pricingModel === "flat-package" && selected.maximumQuantity ? <p>Maksimal {selected.maximumQuantity} {unitLabel(selected.unit)} per paket.</p> : selected.minimumQuantity && selected.minimumQuantity > 1 ? <p>Minimum {selected.minimumQuantity} {unitLabel(selected.unit)} per pesanan.</p> : null}
          {rewards?.memberActive && <p>Sudah termasuk diskon member 20% dari {money(rate)} / {estimateUnit}.</p>}
          {auth.user && auth.verified ? <p>Perkiraan hingga {estimatedPoints.toLocaleString("id-ID")} poin / {estimateUnit} setelah pembayaran. Poin akhir mengikuti jumlah cucian dan poin yang digunakan.</p> : <p>Member yang masuk bisa mendapat perkiraan hingga {estimatedPoints.toLocaleString("id-ID")} poin / {estimateUnit} setelah pembayaran.</p>}
          <p>Total dan ongkir ditentukan toko setelah cucian diterima dan ditimbang.</p>
        </section>
        <div className="customer-order-section-heading customer-order-contact-heading"><h3>Kontak pemesan</h3><p>Nomor WhatsApp akan digunakan untuk menghubungimu.</p></div>
        <div className="form-two customer-order-contact">
          <label>Nama<input autoComplete="name" required minLength={2} maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="Nama lengkap" /></label>
          <label>Nomor WhatsApp<input autoComplete="tel" type="tel" required pattern="(\+62|62|0)8[0-9]{7,12}" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="08xxxxxxxxxx" /></label>
        </div>
        <label className="customer-order-notes">Catatan <span>(opsional)</span><textarea maxLength={1000} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Misalnya, pisahkan pakaian putih" /></label>
        {auth.user && auth.verified && !rewards && <p className="customer-order-notice" role={rewardsError ? "alert" : "status"}>{rewardsError ? <>Saldo belum bisa dimuat. <button type="button" className="text-button" onClick={() => setRewardsAttempt((value) => value + 1)}>Coba lagi</button></> : "Memuat saldo membership dan poin…"}</p>}
        {rewards && (rewards.membership > 0 || rewards.points > 0) && <section className="customer-order-rewards" aria-label="Poin dan saldo membership">
          <div><Wallet size={18} /><b>Poin & saldo Washloka</b></div>
          {rewards.membership > 0 && <label><input type="checkbox" checked={useMembershipBalance} disabled={!rewards.memberActive} onChange={(event) => setUseMembershipBalance(event.target.checked)} /> Gunakan saldo membership · {money(rewards.membership)}</label>}
          {rewards.points > 0 && <p>Saldo poin: <b>{rewards.points.toLocaleString("id-ID")} poin</b></p>}
          <small>Saldo membership digunakan setelah toko memastikan jumlah dan harga layanan. Kamu bisa memilih penggunaan poin di halaman lacak pesanan setelah harga dikonfirmasi.</small>
        </section>}
      </> : <>
        <fieldset className="customer-fulfillment"><legend>Pilih cara antar cucian</legend>
          <label className={fulfillment === "delivery" ? "selected" : ""}><input type="radio" name="fulfillment" checked={fulfillment === "delivery"} onChange={() => setFulfillment("delivery")} /><Truck size={21} /><span><b>Antar jemput</b><small>Gratis hingga 5 km · ongkir dikonfirmasi toko</small></span></label>
          <label className={fulfillment === "dropoff" ? "selected" : ""}><input type="radio" name="fulfillment" checked={fulfillment === "dropoff"} onChange={() => setFulfillment("dropoff")} /><Store size={21} /><span><b>Antar & ambil sendiri</b><small>Datang langsung ke toko</small></span></label>
        </fieldset>
        {fulfillment === "delivery" && <section className="customer-pickup"><h3><MapPin size={18} /> Titik penjemputan</h3>
          <MapPicker lat={location.latitude} lng={location.longitude} onAddress={setAddress} onChange={(lat, lng) => { setLocation({ latitude: lat, longitude: lng }); setLocationChosen(true); }} />
          <p>{locationChosen ? "Titik jemput sudah dipilih. Pastikan alamatnya sesuai." : "Ketuk peta atau pilih lokasi kamu untuk menentukan titik jemput."}</p>
          <label>Alamat lengkap & patokan<textarea required minLength={8} maxLength={500} autoComplete="street-address" value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Nama jalan, nomor rumah, dan patokan" /></label>
        </section>}
        <div className="customer-order-notice">{fulfillment === "delivery" ? "Toko akan menghubungi kamu lewat WhatsApp untuk mengonfirmasi penjemputan dan ongkir. Pembayaran tersedia setelah penjemputan dikonfirmasi dan cucian ditimbang." : "Antarkan cucian ke toko. Pembayaran tersedia setelah cucian diterima, ditimbang, dan harganya dikonfirmasi."}</div>
      </>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="customer-order-actions">
        {step === 2 && <button type="button" className="secondary" onClick={() => { setError(""); setStep(1); }}>Kembali</button>}
        <button type="submit" className="primary" disabled={busy || (!!auth.user && auth.verified && !rewards)}>{busy ? "Menyimpan…" : step === 1 ? "Lanjutkan" : "Buat pesanan"}</button>
      </div>
    </form>
  );
}
