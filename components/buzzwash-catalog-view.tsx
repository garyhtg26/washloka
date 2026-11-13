import { serviceAllowsSpeed, serviceRate, serviceSpeeds } from "@/lib/catalog";
import { money, type Service } from "@/lib/types";
import { Layers, Plus } from "lucide-react";
import ServiceStoreHeading from "./service-store-heading";
import "./buzzwash-catalog-view.css";

/** The supplied BuzzWash menu has different service times from D’Fable. */
export default function BuzzWashCatalogView({ services, orderingEnabled, onOrder, onMember }: {
  services: Service[];
  orderingEnabled: boolean;
  onOrder: (id: string) => void;
  onMember: () => void;
}) {
  const kiloan = services.filter((service) => service.category === "daily");
  const satuan = services.filter(
    (service) => service.category !== "daily" && Boolean(service.rates),
  );
  const premium = services.filter(
    (service) => service.category !== "daily" && !service.rates && service.category !== "member",
  );

  return (
    <section className="services-section buzz-menu">
      <ServiceStoreHeading branch="buzzwash" />
      {!orderingEnabled && <p className="buzz-menu-notice" role="status">
        Pemesanan BuzzWash sedang disiapkan. Daftar harga sudah bisa dilihat di sini.
      </p>}
      <section className="daily-rate-section buzz-menu-group">
        <div className="service-catalog-heading"><div>
          <h3>Paket Bahagia & kiloan</h3>
          <p>Cuci kering lipat maksimal 10 kg per paket. Layanan kiloan minimal 3 kg.</p>
        </div></div>
        <div className="daily-rate-scroll">
          <table className="daily-rate-table">
            <thead><tr><th>Layanan</th>{serviceSpeeds.map((speed) => <th key={speed.id}>{speed.id === "quick" ? "Kilat" : speed.label}<small>{speed.days}</small></th>)}</tr></thead>
            <tbody>{kiloan.map((service) => <tr key={service.id}>
              <th scope="row"><span>{service.name}</span><small>{service.pricingModel === "flat-package" ? "Maks. 10 kg / paket" : `Min. ${service.minimumQuantity} kg`}</small>{orderingEnabled && <button type="button" className="buzz-menu-add" aria-label={`Pesan ${service.name}`} onClick={() => onOrder(service.id)}><Plus size={18} aria-hidden="true" /></button>}</th>
              {serviceSpeeds.map((speed) => <td key={speed.id} data-label={`${speed.id === "quick" ? "Kilat" : speed.label} · ${speed.days}`}>{serviceAllowsSpeed(service, speed.id) ? <>{money(serviceRate(service, speed.id))}<small>{service.pricingModel === "flat-package" ? "/ paket" : "/ kg"}</small></> : "—"}</td>)}
            </tr>)}</tbody>
          </table>
        </div>
      </section>
      <section className="daily-rate-section buzz-menu-group">
        <div className="service-catalog-heading"><div><h3>Layanan satuan</h3><p>One Day: 1 hari · Express: 6–8 jam</p></div></div>
        <div className="daily-rate-scroll">
          <table className="daily-rate-table buzz-menu-piece"><thead><tr><th>Layanan</th><th>One Day<small>1 hari</small></th><th>Express<small>6–8 jam</small></th></tr></thead>
            <tbody>{satuan.map((service) => <tr key={service.id}><th scope="row"><span>{service.name}</span>{orderingEnabled && <button type="button" className="buzz-menu-add" aria-label={`Pesan ${service.name}`} onClick={() => onOrder(service.id)}><Plus size={18} aria-hidden="true" /></button>}</th><td data-label="One Day · 1 hari">{money(serviceRate(service, "oneDay"))}</td><td data-label="Express · 6–8 jam">{money(serviceRate(service, "express"))}</td></tr>)}</tbody>
          </table>
        </div>
      </section>
      <section className="daily-rate-section buzz-menu-group">
        <div className="service-catalog-heading"><div><h3>Layanan premium</h3><p>Waktu pengerjaan dikonfirmasi oleh toko.</p></div></div>
        <div className="daily-rate-scroll">
          <table className="daily-rate-table buzz-menu-premium"><thead><tr><th>Layanan</th><th>Harga</th></tr></thead>
            <tbody>{premium.map((service) => <tr key={service.id}><th scope="row"><span>{service.name}</span>{orderingEnabled && <button type="button" className="buzz-menu-add" aria-label={`Pesan ${service.name}`} onClick={() => onOrder(service.id)}><Plus size={18} aria-hidden="true" /></button>}</th><td data-label="Harga">{service.startingAt ? "Mulai " : ""}{money(service.price)}</td></tr>)}</tbody>
          </table>
        </div>
      </section>
      <section className="service-catalog-group buzz-menu-group">
        <div className="service-catalog-heading">
          <div><h3>Membership Washloka</h3><p>Saldo dan poin berlaku di D’Fable dan BuzzWash.</p></div>
        </div>
        <div className="service-item-grid">
          <button type="button" className="service-item-card" onClick={onMember}>
            <span className="service-icon"><Layers size={21} aria-hidden="true" /></span>
            <span className="service-item-copy"><b>Membership Washloka</b><small>Diskon layanan 20% saat saldo tersedia</small></span>
            <strong>{money(100000)}<small> / deposit minimum</small></strong>
            <Plus size={17} aria-hidden="true" />
          </button>
        </div>
      </section>
    </section>
  );
}
