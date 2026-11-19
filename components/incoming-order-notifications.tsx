"use client";

import { useEffect, useRef, useState } from "react";
import { BellRing, X } from "lucide-react";
import type { Order } from "@/lib/types";
import { findNewIncomingOrders } from "@/lib/incoming-order-notifications";
import "./incoming-order-notifications.css";

/** An in-app alert works while staff are on any dashboard page, including POS. */
export default function IncomingOrderNotifications({
  orders,
  session,
  onOpen,
}: {
  orders: Order[];
  session: string;
  onOpen: (order: Order) => void;
}) {
  const baseline = useRef<{ session: string; seen: Set<string> } | null>(null);
  const [notices, setNotices] = useState<Order[]>([]);

  useEffect(() => {
    if (!baseline.current || baseline.current.session !== session) {
      baseline.current = { session, seen: new Set(orders.map((order) => order.id)) };
      setNotices([]);
      return;
    }
    const incoming = findNewIncomingOrders(orders, baseline.current.seen);
    const pending = new Set(orders.filter((order) => order.source === "web" && order.status === 0).map((order) => order.id));
    setNotices((previous) => {
      const remaining = previous.filter((order) => pending.has(order.id));
      if (!incoming.length && remaining.length === previous.length) return previous;
      return [...incoming, ...remaining].slice(0, 5);
    });
  }, [orders, session]);

  if (!notices.length) return null;
  return (
    <div className="incoming-notices" aria-live="polite" aria-relevant="additions">
      {notices.map((order) => (
        <section key={order.id} className="incoming-notice" aria-label="Pesanan baru">
          <span className="incoming-notice-icon"><BellRing size={20} /></span>
          <div className="incoming-notice-copy">
            <strong>Pesanan baru masuk</strong>
            <span>{order.name} · {order.id}</span>
            <button type="button" onClick={() => { setNotices((current) => current.filter((notice) => notice.id !== order.id)); onOpen(order); }}>Lihat pesanan <span aria-hidden="true">→</span></button>
          </div>
          <button type="button" className="incoming-notice-dismiss" aria-label={`Tutup notifikasi pesanan ${order.id}`} onClick={() => setNotices((current) => current.filter((notice) => notice.id !== order.id))}><X size={17} /></button>
        </section>
      ))}
    </div>
  );
}
