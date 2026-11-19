"use client";

import { ArrowRight, Clock3, PackageCheck, Store, Truck } from "lucide-react";
import type { Order, Service } from "@/lib/types";
import "./incoming-orders.css";

function orderTime(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Waktu tidak tersedia";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

/** Orders awaiting the first action, oldest first so nothing gets overlooked. */
export default function IncomingOrders({ orders, services, hasMore, onOpen, onViewAll }: {
  orders: Order[];
  services: Service[];
  hasMore?: boolean;
  onOpen: (order: Order) => void;
  onViewAll: () => void;
}) {
  const incoming = orders.filter((order) => order.status === 0)
    .sort((a, b) => (Date.parse(a.createdAt) || 0) - (Date.parse(b.createdAt) || 0));
  const serviceNames = new Map(services.map((service) => [service.id, service.name]));

  return <section className="incoming-orders" aria-labelledby="incoming-orders-heading">
    <div className="incoming-orders-heading">
      <div>
        <div className="incoming-orders-title">
          <h2 id="incoming-orders-heading">Pesanan masuk</h2>
          <span className="incoming-orders-count" aria-label={`${incoming.length} pesanan menunggu`}>{incoming.length}</span>
        </div>
        <p>Pesanan yang menunggu konfirmasi toko.</p>
      </div>
      {incoming.length > 0 && <button type="button" className="incoming-orders-view-all" onClick={onViewAll}>Lihat semua <ArrowRight size={16} /></button>}
    </div>
    {incoming.length ? <div className="incoming-orders-grid">
      {incoming.slice(0, 6).map((order) => {
        const dropoff = order.fulfillment === "dropoff";
        const MethodIcon = dropoff ? Store : Truck;
        return <button type="button" className="incoming-order-card" key={order.id} onClick={() => onOpen(order)} aria-label={`Buka pesanan ${order.id} dari ${order.name}`}>
          <span className="incoming-order-top"><span className="incoming-order-status"><span /> Menunggu konfirmasi</span><ArrowRight className="incoming-order-arrow" size={18} /></span>
          <span className="incoming-order-customer">{order.name}</span>
          <span className="incoming-order-service">{serviceNames.get(order.service) || "Layanan laundry"}</span>
          <span className="incoming-order-meta"><span><MethodIcon size={15} /> {dropoff ? "Antar sendiri" : order.fulfillment === "delivery" ? "Antar jemput" : order.source === "pos" ? "Di toko" : "Pesanan online"}</span><span><Clock3 size={15} /> {orderTime(order.createdAt)}</span></span>
          <span className="incoming-order-id">{order.id}</span>
        </button>;
      })}
    </div> : <div className="incoming-orders-empty"><span><PackageCheck size={21} /></span><div><strong>Tidak ada pesanan menunggu</strong><p>Pesanan baru akan muncul di sini.</p></div></div>}
    {hasMore && <p className="incoming-orders-note">Menampilkan pesanan dari 500 pesanan terbaru.</p>}
  </section>;
}
