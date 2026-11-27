"use client";

import { paidOrderSalesValue } from "@/lib/sales";
import { useState, useEffect, useRef, type FormEvent } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import CustomerHome from "./customer-home";
import CustomerNavigation from "./customer-navigation";
import WashlokaPortal from "./washloka-portal";
import TenantBrand from "./tenant-brand";
import "./tenant-brand.css";
import CustomerOrderForm from "./customer-order-form";
import LoadingProgress, { useLoadingProgress } from "./loading-progress";
import OverviewCharts from "./overview-charts";
import IncomingOrders from "./incoming-orders";
import IncomingOrderNotifications from "./incoming-order-notifications";
import StaffOrderDetail, { StaffReceipt } from "./staff-order-detail";
import CustomerAccount from "./customer-account";
import ShopSelector from "./shop-selector";
import ScrollReveal from "./scroll-reveal";
import { useAuth } from "./auth-provider";
import AccountPanel from "./account-panel";
import UserManagement from "./user-management";
import DashboardAccount from "./dashboard-account";
import "./dashboard-brand.css";
import "./customer-order-dialog.css";
import "./customer-brand.css";
import "./order-rewards.css";
import {
  branches,
  branchLocations,
  resolveCustomerBranch,
  trackingBranch,
  normalizeBranchId,
  type BranchId,
} from "@/lib/branches";
import ContentEditor from "./content-editor";
import BuzzWashCatalogView from "./buzzwash-catalog-view";
import ServiceStoreHeading from "./service-store-heading";
import Tracking, { previewTracking } from "./tracking";
import PaymentPanel from "./payment-panel";
import LoyaltyRedemption from "./loyalty-redemption";
import MembershipRedemption from "./membership-redemption";
import PosMembershipForm, { PosMembershipDetails, usePosMembership } from "./pos-membership";
import PaymentSettings from "./payment-settings";
import PaymentStatus from "./payment-status";
import {
  DFABLE_HOME,
  DFABLE_PROFILE,
  dfableTrackingPath,
  tenantStorePath,
} from "@/lib/dfable-path";
import { consumePaymentEvents } from "@/lib/payment-stream";
import { requestBranchStore } from "@/lib/branch-loading";
import { scrollMobileTrackingTop } from "@/lib/tracking-scroll";
import { acceptTrackingSnapshot, preferOwnerTracking } from "@/lib/tracking-freshness";
import { publicTracking as toPublicTracking } from "@/lib/tracking-data";
import type { TrackingOrder } from "@/lib/types";
import {
  serviceCategoryLabels,
  serviceCategoryOrder,
  defaultSpeed,
  serviceAvailableSpeeds,
  serviceRate,
  serviceSpeeds,
  serviceTotal,
  serviceUnitRate,
  speedLabel,
  unitLabel,
} from "@/lib/catalog";
import { normalizePhone } from "@/lib/pricing";
import {
  Shirt,
  WashingMachine,
  Wind,
  Package,
  MapPin,
  ChevronDown,
  Plus,
  Clock,
  Truck,
  Check,
  Search,
  X,
  Camera,
  Coins,
  CalendarDays,
  LayoutDashboard,
  ShoppingBag,
  Tags,
  Megaphone,
  LogOut,
  Menu,
  User,
  UserRoundPlus,
  ReceiptText,
  Wallet,
  CheckCircle2,
  Copy,
  Info,
  Minus,
  SlidersHorizontal,
  Headphones,
  Layers,
  ShieldCheck,
  Store as StoreIcon,
  Printer,
} from "lucide-react";
import {
  money,
  statuses,
  type Store,
  type Order,
  type Service,
  type ServiceCategory,
  type ServiceSpeed,
} from "@/lib/types";
const MapPicker = dynamic(() => import("./map-picker"), {
  ssr: false,
  loading: () => <div className="map-loading">Memuat peta…</div>,
});
const icons = {
  shirt: Shirt,
  wash: WashingMachine,
  iron: Wind,
  member: Layers,
  household: Package,
  premium: Shirt,
  additional: Wind,
};
const CUSTOMER_BRANCH_KEY = "eazywash-selected-store";
const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(
    new Date(),
  );
function estimate(
  services: Service[],
  id: string,
  quantity: number,
  speed: ServiceSpeed,
) {
  const service = services.find((value) => value.id === id);
  return service ? serviceTotal(service, quantity, speed) : 0;
}
function Brand({ inverse = false }: { inverse?: boolean }) {
  return (
    <a
      className={`brand eazy-customer-brand washloka-lockup${inverse ? "" : " washloka-lockup-light"}`}
      href={DFABLE_HOME}
      aria-label="Washloka beranda"
    >
      <img
        className="washloka-mark"
        src="/washloka/app-icon-burgundy.svg"
        alt=""
      />
      <img
        className="washloka-wordmark"
        src={
          inverse
            ? "/washloka/wordmark-white.svg"
            : "/washloka/wordmark-burgundy.svg"
        }
        alt="Washloka"
      />
    </a>
  );
}
function DashboardBrand({ compact = false }: { compact?: boolean }) {
  return (
    <a
      className={`dashboard-platform-brand washloka-lockup washloka-lockup-light${compact ? " dashboard-platform-brand-compact" : ""}`}
      href="/"
      aria-label="Washloka beranda"
    >
      <img
        className="washloka-mark"
        src="/washloka/app-icon-burgundy.svg"
        alt=""
      />
      <img
        className="washloka-wordmark"
        src="/washloka/wordmark-burgundy.svg"
        alt="Washloka"
      />
    </a>
  );
}
function Icon({ service, size = 25 }: { service: Service; size?: number }) {
  const C = icons[service.icon as keyof typeof icons] || Shirt;
  return <C size={size} strokeWidth={1.55} />;
}
export default function Studio({ dashboard = false, tenantBranch }: { dashboard?: boolean; tenantBranch?: BranchId }) {
  const auth = useAuth();
  const profileHref = tenantBranch ? `${DFABLE_PROFILE}?branch=${tenantBranch}` : DFABLE_PROFILE;
  const [branch, setBranch] = useState<BranchId>(tenantBranch ?? "dfablelaundry");
  const currentBranch = useRef(branch);
  currentBranch.current = branch;
  const branchName = branches[branch];
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("branch");
    let saved: string | null = null;
    try {
      saved =
        window.localStorage.getItem(CUSTOMER_BRANCH_KEY) ||
        window.localStorage.getItem("dfable-customer-branch");
    } catch {
      // Storage can be unavailable in strict privacy modes.
    }
    const selectedStore = !dashboard && tenantBranch ? tenantBranch : resolveCustomerBranch({ requested, saved: dashboard ? null : saved });
    setBranch(selectedStore);
    if (requested && requested !== selectedStore) {
      const url = new URL(window.location.href);
      url.searchParams.set("branch", selectedStore);
      window.history.replaceState(window.history.state, "", url);
    }
    if (!dashboard) {
      try {
        window.localStorage.setItem(CUSTOMER_BRANCH_KEY, selectedStore);
        window.localStorage.removeItem("dfable-customer-branch");
      } catch {}
    }
  }, [dashboard, tenantBranch]);
  function switchBranch(next: BranchId, remember = !dashboard) {
    if (!dashboard && next !== tenantBranch) {
      const query = new URLSearchParams();
      if (!remember && activeTrack.current.trim()) query.set("track", activeTrack.current.trim());
      window.location.assign(`${tenantStorePath(next)}${query.size ? `?${query}` : ""}`);
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.set("branch", next);
    window.history.replaceState(window.history.state, "", url);
    if (remember) {
      try {
        window.localStorage.setItem(CUSTOMER_BRANCH_KEY, next);
      } catch {
        // A remembered branch is an enhancement; switching still works without it.
      }
    }
    setBranch(next);
  }
  const pendingOrder = useRef(false);
  const [publicTracking, setPublicTracking] = useState<{ token: string; order: TrackingOrder } | null>(null);
  const trackingRequest = useRef<AbortController | null>(null);
  const trackingSequence = useRef(0);
  const [trackingError, setTrackingError] = useState("");
  const [store, setStore] = useState<Store | null>(null);
  const [error, setError] = useState("");
  const [loadedSession, setLoadedSession] = useState("");
  const [view, setView] = useState("home");
  function navigateCustomer(next: "home" | "services" | "tracking") {
    if (next === "tracking" && view === "tracking") scrollMobileTrackingTop(window);
    setView(next);
  }
  const [adminView, setAdminView] = useState("overview");
  const [posCategory, setPosCategory] = useState<ServiceCategory>("daily");
  const [modal, setModal] = useState("");
  const scrollTrackingAfterDialog = useRef(false);
  const [service, setService] = useState("complete");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const [profile, setProfile] = useState({ name: "", phone: "" });
  const [track, setTrack] = useState("");
  const activeTrack = useRef(track);
  activeTrack.current = track;
  const [selected, setSelected] = useState<Order | null>(null);
  const [customerOrder, setCustomerOrder] = useState<{ id: string; token: string } | null>(null);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const sessionKey = `${auth.scope}:${auth.user?.uid || "guest"}:${auth.verified}:${auth.provider}:${branch}`;
  const pageLoading = auth.loading || !store || loadedSession !== sessionKey;
  const loadingProgress = useLoadingProgress(pageLoading);
  const dialogAvailable = Boolean(
    store &&
    loadedSession === sessionKey &&
    !loadingProgress.visible &&
    (!dashboard ||
      (!auth.loading &&
        store.isAdmin &&
        auth.provider === "password" &&
        auth.verified)),
  );
  const activeSession = useRef(sessionKey);
  activeSession.current = sessionKey;
  const loadSequence = useRef(0);
  const storeLoadController = useRef<AbortController | null>(null);
  async function load() {
    storeLoadController.current?.abort();
    const controller = new AbortController();
    storeLoadController.current = controller;
    const capturedSession = sessionKey;
    const sequence = ++loadSequence.current;
    setError("");
    try {
      const data = await requestBranchStore(
        auth.request,
        branch,
        controller.signal,
      );
      if (
        controller.signal.aborted ||
        capturedSession !== activeSession.current ||
        sequence !== loadSequence.current
      )
        return;
      if (dashboard && data.allowedBranches?.length && !data.allowedBranches.includes(branch)) {
        switchBranch(data.allowedBranches[0], false);
        return;
      }
      setStore(data);
      setLoadedSession(capturedSession);
      setProfile({
        name: data.profile?.name || auth.name,
        phone: data.profile?.phone || "",
      });
      setError("");
    } catch (e) {
      if (
        !controller.signal.aborted &&
        capturedSession === activeSession.current &&
        sequence === loadSequence.current
      )
        setError((e as Error).message);
    } finally {
      if (storeLoadController.current === controller)
        storeLoadController.current = null;
    }
  }
  const latestLoad = useRef(load);
  latestLoad.current = load;
  useEffect(() => {
    if (!dashboard || !store?.isAdmin || !auth.user || !auth.verified) return;
    let disposed = false;
    let controller: AbortController | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let connecting = false;
    const connect = async () => {
      if (disposed || connecting || document.visibilityState !== "visible")
        return;
      connecting = true;
      const current = new AbortController();
      controller = current;
      try {
        const response = await auth.request(
          `/api/payments/events?branch=${branch}`,
          { signal: current.signal, cache: "no-store" },
        );
        if (!response.ok) throw Error("Payment updates unavailable");
        await consumePaymentEvents(response, (event) => {
          if (!disposed && !current.signal.aborted && event === "refresh")
            void latestLoad.current();
        });
      } catch {
        // The existing store refresh remains available during reconnection.
      } finally {
        connecting = false;
        if (!disposed && document.visibilityState === "visible")
          retry = setTimeout(connect, 3000);
      }
    };
    const visibility = () => {
      clearTimeout(retry);
      if (document.visibilityState === "visible") {
        void latestLoad.current();
        void connect();
      } else controller?.abort();
    };
    void connect();
    document.addEventListener("visibilitychange", visibility);
    return () => {
      disposed = true;
      clearTimeout(retry);
      controller?.abort();
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [
    dashboard,
    store?.isAdmin,
    auth.user?.uid,
    auth.verified,
    branch,
    auth.request,
  ]);
  useEffect(() => {
    setLoadedSession("");
    setError("");
    setProfile({ name: auth.name, phone: "" });
    setStore((previous) =>
      previous
        ? { ...previous, orders: [], isAdmin: false, canManageUsers: false }
        : previous,
    );
    // The customer's restored Firebase session is part of the initial load.
    // Fetching as a guest first can briefly finish before the real account loads.
    if (auth.loading) return () => storeLoadController.current?.abort();
    load();
    const interval = setInterval(load, 15000);
    return () => {
      clearInterval(interval);
      storeLoadController.current?.abort();
    };
  }, [auth.loading, auth.user?.uid, auth.verified, auth.provider, branch]);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("account") === "1" && !dashboard) setModal("login");
    const requestedView = params.get("view");
    if (
      !dashboard &&
      requestedView &&
      ["home", "services", "tracking"].includes(requestedView)
    )
      setView(requestedView);
    const q = params.get("track");
    if (q) {
      setTrack(q);
      setView("tracking");
    }
  }, [dashboard]);
  async function refreshTracking(requestedTrack: string) {
    if (activeTrack.current.trim() !== requestedTrack) return;
    trackingRequest.current?.abort();
    const controller = new AbortController();
    trackingRequest.current = controller;
    const sequence = ++trackingSequence.current;
    try {
      const response = await fetch(
        `/api/tracking?token=${encodeURIComponent(requestedTrack)}`,
        { signal: controller.signal, cache: "no-store" },
      );
      const data = await response.json();
      if (!response.ok) throw Error(data.error);
      if (controller.signal.aborted || sequence !== trackingSequence.current || activeTrack.current.trim() !== requestedTrack) return;
      const orderBranch = !dashboard && !tenantBranch
        ? normalizeBranchId(data.branchId)
        : trackingBranch(currentBranch.current, data.branchId, dashboard);
      if (orderBranch) switchBranch(orderBranch, false);
      setPublicTracking((previous) => ({
        token: requestedTrack,
        order: acceptTrackingSnapshot(previous?.token === requestedTrack ? previous.order : null, data),
      }));
      setTrackingError("");
    } catch (error) {
      if (!controller.signal.aborted && sequence === trackingSequence.current && activeTrack.current.trim() === requestedTrack)
        setTrackingError(error instanceof Error ? error.message : "Tracking sementara tidak tersedia.");
    } finally {
      if (trackingRequest.current === controller) trackingRequest.current = null;
    }
  }
  useEffect(() => {
    setPublicTracking(null);
    setTrackingError("");
    const requestedTrack = track.trim();
    if (!/^[0-9a-f-]{36}$/i.test(requestedTrack)) return;
    void refreshTracking(requestedTrack);
    const timer = setInterval(() => void refreshTracking(requestedTrack), 15000);
    return () => {
      trackingRequest.current?.abort();
      trackingSequence.current += 1;
      clearInterval(timer);
    };
  }, [track, dashboard, tenantBranch]);
  useEffect(() => {
    if (!dashboard && view === "tracking" && window.matchMedia("(max-width: 800px)").matches) {
      if (modal !== "success") scrollMobileTrackingTop(window);
      return;
    }
    window.scrollTo({ top: 0 });
  }, [view, adminView]);
  useEffect(() => {
    const element = dialog.current;
    if (!dialogAvailable || !modal || !element) return;
    const previousOverflow = document.body.style.overflow;
    if (!element.open) element.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      if (element.open) element.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [modal, dialogAvailable]);
  useEffect(() => {
    if (modal || !scrollTrackingAfterDialog.current) return;
    const frame = requestAnimationFrame(() => {
      scrollTrackingAfterDialog.current = false;
      scrollMobileTrackingTop(window);
    });
    return () => cancelAnimationFrame(frame);
  }, [modal]);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 4500);
      return () => clearTimeout(t);
    }
  }, [toast]);
  async function action(action: string, data: unknown) {
    setBusy(true);
    try {
      const r = await auth.request(`/api/store?branch=${branch}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, data }),
      });
      const result = await r.json();
      if (!r.ok) throw Error(result.error);
      setStore(result.store);
      if (result.store.profile) setProfile(result.store.profile);
      return result;
    } finally {
      setBusy(false);
    }
  }
  function order(id = "complete") {
    if (branch === "buzzwash" && !store?.orderingEnabled) {
      notify("Pemesanan BuzzWash sedang disiapkan.");
      return;
    }
    setService(id);
    if (dashboard && (!auth.user || !auth.verified)) {
      pendingOrder.current = true;
      setModal("login");
      return;
    }
    setModal("order");
  }
  function notify(message: string) {
    setToast(message);
  }
  const orders = store?.orders || [];
  const currentSelected = selected
    ? orders.find((order) => order.id === selected.id) || selected
    : null;
  const myOrders = orders.filter((o) => auth.user && o.uid === auth.user.uid);
  const visible = orders.filter(
    (o) =>
      (filter === "all" ||
        (filter === "active"
          ? o.status < 7
          : filter === "incoming"
            ? o.status === 0
          : filter === "review"
            ? o.manualPayment?.status === "awaiting_review" ||
              o.paymentReconciliationRequired
            : !o.paid)) &&
      `${o.id} ${o.name} ${o.phone}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const publicOrder = publicTracking?.token === track.trim() ? publicTracking.order : null;
  const ownerOrder = auth.user ? orders.find(
    (o) => o.uid === auth.user?.uid &&
      (o.id === publicOrder?.id || o.token === track.trim() || o.id === track.trim().toUpperCase()),
  ) : undefined;
  const tracked = preferOwnerTracking(publicOrder, ownerOrder ? toPublicTracking(ownerOrder) : undefined);
  if (pageLoading || loadingProgress.visible)
    return (
      <main className={`loading${!dashboard && tenantBranch ? ` tenant-${tenantBranch === "dfablelaundry" ? "dfable" : "buzzwash"}` : ""}`}>
        {dashboard ? <DashboardBrand /> : tenantBranch ? <TenantBrand branch={tenantBranch} /> : <Brand />}
        <p role="status" aria-live="polite">
          {error || `Menyiapkan ${!dashboard && tenantBranch ? branches[tenantBranch] : "Washloka"}…`}
        </p>
        {error ? (
          <button className="primary" onClick={load}>
            Coba lagi
          </button>
        ) : (
          <LoadingProgress progress={loadingProgress.progress} label="Memuat data" />
        )}
      </main>
    );
  if (
    dashboard &&
    (!store.isAdmin ||
      auth.loading ||
      auth.provider !== "password" ||
      !auth.verified)
  )
    return (
      <main className="dashboard-login">
        <div className="dashboard-login-inner">
          <DashboardBrand />
          <div className="dashboard-login-card">
            <AccountPanel admin phone={profile.phone} onDone={() => load()} />
          </div>
        </div>
      </main>
    );
  const revenue = orders.reduce(
    (sum, order) => sum + paidOrderSalesValue(order),
    0,
  );
  const pendingPayments = orders.filter(
    (o) =>
      o.manualPayment?.status === "awaiting_review" ||
      o.paymentReconciliationRequired,
  ).length;
  return (
    <>
      <ScrollReveal />
      {dashboard ? (
        <div className="admin-shell">
          <IncomingOrderNotifications
            key={sessionKey}
            orders={orders}
            session={sessionKey}
            onOpen={(order) => { setSelected(order); setModal("detail"); }}
          />
          <aside className="sidebar">
            <DashboardBrand />
            <div className="dashboard-shop-select">
              <ShopSelector
                branch={branch}
                onBranchChange={switchBranch}
                disabled={busy}
                availableBranches={store.allowedBranches ?? ["dfablelaundry"]}
              />
            </div>
            <span className="nav-caption">OPERASIONAL</span>
            {[
              ["overview", "Ringkasan", LayoutDashboard],
              ["orders", "Pesanan", ShoppingBag],
              ["pos", "Kasir / POS", ReceiptText],
              ["prices", "Layanan & harga", Tags],
              ["promo", "Banner & promosi", Megaphone],
              ["payments", "Pembayaran", Wallet],
              ["users", "Pengguna & akses", ShieldCheck],
            ]
              .filter(
                ([id]) =>
                  !["users", "prices", "promo", "payments"].includes(
                    id as string,
                  ) || store.canManageUsers,
              )
              .map(([id, label, C]) => {
                const Component = C as typeof Shirt;
                return (
                  <button
                    key={id as string}
                    className={
                      adminView === id ? "side-link active" : "side-link"
                    }
                    onClick={() => setAdminView(id as string)}
                  >
                    <Component size={20} />
                    {label as string}
                    {id === "orders" && (
                      <span className="count">
                        {orders.filter((o) => o.status < 7).length}
                      </span>
                    )}
                  </button>
                );
              })}
          </aside>
          <div className="admin-main">
            <header className="admin-top">
              <DashboardBrand compact />
              <span>
                Washloka{" "}
                <span className="dashboard-client-crumb">
                  / {branchName}
                </span>{" "}
                <span className="muted">
                  /{" "}
                  {
                    (
                      {
                        overview: "Ringkasan",
                        orders: "Pesanan",
                        pos: "Kasir",
                        prices: "Layanan & harga",
                        promo: "Banner & promosi",
                        payments: "Pembayaran",
                        users: "Pengguna & akses",
                      } as Record<string, string>
                    )[adminView]
                  }
                </span>
              </span>
              <div className="mobile-workspace dashboard-shop-select">
                <ShopSelector
                  branch={branch}
                  onBranchChange={switchBranch}
                  disabled={busy}
                  availableBranches={store.allowedBranches ?? ["dfablelaundry"]}
                />
              </div>
              <DashboardAccount branchName={branchName} />
            </header>
            <main className="admin-content">
              <div className="section-heading">
                <div>
                  <h1>
                    {adminView === "users"
                      ? "Pengguna & akses"
                      : adminView === "overview"
                        ? "Ringkasan"
                        : adminView === "orders"
                          ? "Kelola pesanan"
                          : adminView === "pos"
                            ? "Kasir / POS"
                            : adminView === "prices"
                              ? "Layanan & harga"
                              : adminView === "payments"
                                ? "Pembayaran"
                                : "Banner & promosi"}
                  </h1>
                </div>
              </div>
              {adminView === "users" && store.canManageUsers && (
                <UserManagement branch={branch} allowedBranches={store.allowedBranches ?? ["dfablelaundry"]} />
              )}
              {adminView === "overview" && (
                <>
                  <IncomingOrders
                    orders={orders}
                    services={store.services}
                    hasMore={store.hasMore}
                    onOpen={(order) => { setSelected(order); setModal("detail"); }}
                    onViewAll={() => { setQuery(""); setFilter("incoming"); setAdminView("orders"); }}
                  />
                  {pendingPayments > 0 && (
                    <button
                      type="button"
                      className="payment-review-alert"
                      onClick={() => {
                        setAdminView("orders");
                        setFilter("review");
                      }}
                    >
                      <span className="payment-review-alert-icon">
                        <ReceiptText size={24} />
                      </span>
                      <span className="payment-review-alert-copy">
                        <strong>
                          {pendingPayments} pembayaran perlu konfirmasi
                        </strong>
                        <span>
                          Periksa bukti transfer untuk mengonfirmasi pembayaran
                          pelanggan.
                        </span>
                      </span>
                      <span className="payment-review-alert-action">
                        Periksa sekarang
                      </span>
                    </button>
                  )}
                  <div className="metrics" data-scroll-reveal>
                    {[
                      [Wallet, "Nilai penjualan lunas", money(revenue)],
                      [ShoppingBag, "Total pesanan", orders.length],
                      [
                        WashingMachine,
                        "Dalam proses",
                        orders.filter((o) => o.status < 7).length,
                      ],
                      [
                        CheckCircle2,
                        "Pesanan selesai",
                        orders.filter((o) => o.status === 7).length,
                      ],
                    ].map(([C, label, value]) => {
                      const Component = C as typeof Shirt;
                      return (
                        <div className="metric" key={label as string}>
                          <span>
                            <Component size={19} />
                            {label as string}
                          </span>
                          <strong>{value as string | number}</strong>
                          <small>
                            {label === "Nilai penjualan lunas"
                              ? `Termasuk saldo membership · bukan uang diterima${store.hasMore ? " · 500 pesanan terbaru" : ""}`
                              : store.hasMore
                                ? "500 pesanan terbaru"
                                : "Seluruh pesanan"}
                          </small>
                        </div>
                      );
                    })}
                  </div>
                  <OverviewCharts orders={orders} hasMore={store.hasMore} />
                  <div className="admin-two" data-scroll-reveal>
                    <section className="panel">
                      <div className="section-heading">
                        <h3>Alur operasional</h3>
                        <span className="muted">Pesanan aktif</span>
                      </div>
                      <div className="pipeline">
                        {[
                          "Menunggu",
                          "Penjemputan",
                          "Di studio",
                          "Pengantaran",
                        ].map((s, i) => {
                          const count = orders.filter((o) =>
                            i === 0
                              ? o.status === 0
                              : i === 1
                                ? [1, 2].includes(o.status)
                                : i === 2
                                  ? [3, 4, 5].includes(o.status)
                                  : o.status === 6,
                          ).length;
                          return (
                            <div key={s}>
                              <span className="pipeline-num">0{i + 1}</span>
                              <b>{count}</b>
                              <span>{s}</span>
                              <div className="bar">
                                <i
                                  style={{
                                    width: `${
                                      orders.length
                                        ? (count / orders.length) * 100
                                        : 0
                                    }%`,
                                  }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                    <section className="blue-note">
                      <Truck size={28} />
                      <h3>Status pesanan</h3>
                      <p>
                        Status yang kamu ubah akan langsung terlihat di halaman
                        tracking pelanggan.
                      </p>
                      <button onClick={() => setAdminView("orders")}>
                        Kelola pesanan
                      </button>
                    </section>
                  </div>
                </>
              )}
              {(adminView === "overview" || adminView === "orders") && (
                <section className="panel orders-panel" data-scroll-reveal>
                  <div className="section-heading">
                    <h3>
                      {adminView === "overview"
                        ? "Pesanan terbaru"
                        : "Semua pesanan"}
                    </h3>
                    <span className="muted">{orders.length} pesanan</span>
                  </div>
                  <div className="table-tools">
                    <div className="tabs">
                      {[
                        ["all", "Semua"],
                        ["incoming", "Menunggu konfirmasi"],
                        ["active", "Aktif"],
                        ["unpaid", "Belum dibayar"],
                        [
                          "review",
                          `Perlu konfirmasi${pendingPayments ? ` (${pendingPayments})` : ""}`,
                        ],
                      ].map(([v, t]) => (
                        <button
                          key={v}
                          className={filter === v ? "active" : ""}
                          onClick={() => setFilter(v)}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                    <label className="search-box">
                      <Search size={17} />
                      <input
                        aria-label="Cari nama atau nomor pesanan"
                        placeholder="Cari nama / nomor pesanan"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                    </label>
                  </div>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Pesanan / pelanggan</th>
                          <th>Layanan</th>
                          <th>Total</th>
                          <th>Status</th>
                          <th>Pembayaran</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {visible
                          .slice(0, adminView === "overview" ? 5 : 1000)
                          .map((o) => (
                            <tr
                              key={o.id}
                              className={
                                o.manualPayment?.status === "awaiting_review"
                                  ? "payment-review-row"
                                  : undefined
                              }
                            >
                              <td>
                                <b>{o.name}</b>
                                <small>
                                  {o.id} ·{" "}
                                  {o.source === "pos" ? "Walk-in" : "Online"}
                                </small>
                              </td>
                              <td>
                                {
                                  store.services.find((s) => s.id === o.service)
                                    ?.name
                                }
                                <small>
                                  {o.quantityPending ? "Menunggu jumlah" : `${o.actualKg ?? o.kg} ${unitLabel(o.unit ?? store.services.find((s) => s.id === o.service)?.unit)}`}{" "}
                                  · {speedLabel(o.speed, o.express)}
                                </small>
                              </td>
                              <td>
                                <b>{o.quantityPending ? "Menunggu harga" : money(o.total)}</b>
                              </td>
                              <td>
                                <span className="status">
                                  {statuses[o.status]}
                                </span>
                              </td>
                              <td>
                                <PaymentStatus
                                  paid={o.paid}
                                  manualPayment={o.manualPayment}
                                  payment={o.payment}
                                  reviewRequired={
                                    o.paymentReconciliationRequired
                                  }
                                  compact
                                />
                              </td>
                              <td>
                                <button
                                  className="text-button"
                                  onClick={() => {
                                    setSelected(o);
                                    setModal("detail");
                                  }}
                                >
                                  Detail
                                </button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                  {!visible.length && (
                    <Empty
                      title="Belum ada pesanan"
                      text="Pesanan dari web pelanggan dan kasir akan muncul di sini."
                    />
                  )}
                </section>
              )}
              {adminView === "pos" && (
                <div className="pos-layout" data-scroll-reveal>
                  <section className="panel">
                    <p className="eyebrow">LAYANAN TOKO</p>
                    <h2>Pelanggan datang langsung?</h2>
                    <p className="muted">
                      Buat pesanan, catat berat aktual, lalu bagikan link
                      tracking.
                    </p>
                    <div
                      className="pos-category-tabs"
                      role="group"
                      aria-label="Kategori layanan kasir"
                    >
                      {serviceCategoryOrder
                        .filter((category) => category !== "member")
                        .map((category) => (
                          <button
                            type="button"
                            key={category}
                            className={
                              posCategory === category ? "selected" : ""
                            }
                            aria-pressed={posCategory === category}
                            onClick={() => setPosCategory(category)}
                          >
                            {serviceCategoryLabels[category]}
                          </button>
                        ))}
                    </div>
                    <div className="service-grid pos-services">
                      {store.services
                        .filter((s) => s.category === posCategory)
                        .map((s) => (
                          <button
                            className="service-card"
                            key={s.id}
                            onClick={() => order(s.id)}
                          >
                            <span className="service-icon">
                              <Icon service={s} />
                            </span>
                            <h3>{s.name}</h3>

                            <b>
                              {money(serviceRate(s))}
                              <small>
                                {" "}
                                /{" "}
                                {s.packageSize ? `${s.packageSize} kg` : s.unit}
                              </small>
                            </b>
                            {s.minimumQuantity && s.minimumQuantity > 1 && (
                              <small className="pos-service-minimum">
                                Minimum {s.minimumQuantity} {s.unit}
                              </small>
                            )}
                            <span className="card-plus">
                              <Plus size={19} />
                            </span>
                          </button>
                        ))}
                    </div>
                  </section>
                  <div className="blue-note">
                    <ReceiptText size={32} />
                    <h2>
                      Satu pesanan.
                      <br />
                      Satu nomor tracking.
                    </h2>
                    <p>
                      Pelanggan pertama cukup memberikan nama dan nomor
                      WhatsApp. Tidak perlu membuat akun untuk melihat tracking
                      pesanan.
                    </p>
                    <button type="button" className="primary pos-membership-open" onClick={() => setModal("pos-membership")}>
                      <UserRoundPlus size={18} aria-hidden="true" /> Buka membership
                    </button>
                  </div>
                </div>
              )}
              {adminView === "prices" && (
                <PriceEditor
                  store={store}
                  save={async (data) => {
                    await action("prices", data);
                    notify("Harga berhasil diperbarui");
                  }}
                />
              )}
              {adminView === "payments" && store.canManageUsers && (
                <PaymentSettings
                  key={branch}
                  branchId={branch}
                  onSaved={() => {
                    void load();
                  }}
                />
              )}
              {adminView === "promo" && (
                <div className="banner-settings" data-scroll-reveal>
                  <PromoEditor
                    store={store}
                    save={async (data) => {
                      await action("promo", data);
                      notify("Promosi berhasil diperbarui");
                    }}
                  />
                  <ContentEditor key={branch} store={store} onSaved={load} />
                </div>
              )}
            </main>
          </div>
        </div>
      ) : (
        <div className={tenantBranch === "dfablelaundry" ? "tenant-dfable" : tenantBranch === "buzzwash" ? "tenant-buzzwash" : undefined}>
          <header className="customer-header">
            {tenantBranch ? <TenantBrand branch={tenantBranch} /> : <Brand />}
            <CustomerNavigation tenant={!!tenantBranch} view={view} onView={navigateCustomer} />
            <div className="header-right">
              {tenantBranch ? <ShopSelector
                branch={branch}
                onBranchChange={(next) => switchBranch(next)}
                disabled={busy}
              /> : null}
              <CustomerAccount onLogin={() => setModal("login")} profileHref={profileHref} />
            </div>
          </header>
          <main
            className={`customer-main${view === "home" ? " customer-main-home" : ""}`}
          >
            {view === "home" && (
              tenantBranch ? <CustomerHome
                tenantBranch={tenantBranch}
                store={store}
                name={auth.user ? auth.name : ""}
                onOrder={order}
                onMember={() => setModal("member")}
                onTrack={(code) => {
                  if (code) setTrack(code);
                  setView("tracking");
                }}
                onAccount={() =>
                  auth.user && auth.verified
                    ? window.location.assign(profileHref)
                    : setModal("login")
                }
                onServices={() => setView("services")}
              /> : <WashlokaPortal onSelectShop={(id) => switchBranch(id)} onTrack={(code) => { if (code) setTrack(code); setView("tracking"); }} />
            )}
            {view === "services" && branch === "buzzwash" && (
              <BuzzWashCatalogView services={store.services} orderingEnabled={store.orderingEnabled === true} onOrder={order} onMember={() => setModal("member")} />
            )}
            {view === "services" && branch !== "buzzwash" && (
              <section className="services-section">
                <ServiceStoreHeading branch={branch} />
                <div className="service-catalog">
                  {serviceCategoryOrder.map((category) => {
                    const group = store.services.filter(
                      (item) => item.category === category,
                    );
                    if (!group.length) return null;
                    if (category === "daily")
                      return (
                        <section
                          className="daily-rate-section"
                          key={category}
                          data-scroll-reveal
                        >
                          <div className="service-catalog-heading">
                            <div>
                              <h3>{serviceCategoryLabels[category]}</h3>
                              <p>Pilih layanan dan waktu selesai yang sesuai</p>
                            </div>
                            <span>Jemput & antar</span>
                          </div>
                          <div className="daily-rate-scroll">
                            <table className="daily-rate-table">
                              <thead>
                                <tr>
                                  <th>Layanan</th>
                                  {serviceSpeeds.map((speedOption) => (
                                    <th key={speedOption.id}>
                                      {speedOption.label}
                                      <small>{speedOption.days}</small>
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {group.map((item) => (
                                  <tr key={item.id}>
                                    <th scope="row">
                                      <span>{item.name}</span>
                                      <small>
                                        Minimum {item.minimumQuantity}{" "}
                                        {item.unit}
                                      </small>
                                      <button
                                        type="button"
                                        onClick={() => order(item.id)}
                                      >
                                        Pesan
                                      </button>
                                    </th>
                                    {serviceSpeeds.map((speedOption) => (
                                      <td key={speedOption.id}>
                                        {money(
                                          serviceRate(item, speedOption.id),
                                        )}
                                        <small>
                                          /{" "}
                                          {item.packageSize
                                            ? `${item.packageSize} kg`
                                            : item.unit}
                                        </small>
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </section>
                      );
                    return (
                      <section className="service-catalog-group" key={category}>
                        <div
                          className="service-catalog-heading"
                          data-scroll-reveal
                        >
                          <h3>{serviceCategoryLabels[category]}</h3>
                          {category === "member" && (
                            <span>
                              Deposit mulai Rp100.000 · diskon 20% selama saldo
                              tersedia
                            </span>
                          )}
                        </div>
                        <div className="service-item-grid">
                          {group.map((item) => (
                            <button
                              type="button"
                              className="service-item-card"
                              key={item.id}
                              data-scroll-reveal
                              onClick={() =>
                                item.category === "member"
                                  ? setModal("member")
                                  : order(item.id)
                              }
                            >
                              <span className="service-icon">
                                <Icon service={item} size={21} />
                              </span>
                              <span className="service-item-copy">
                                <b>
                                  {category === "member"
                                    ? "Membership Washloka"
                                    : item.name}
                                </b>
                                {item.minimumQuantity &&
                                  item.minimumQuantity > 1 && (
                                    <small>
                                      Minimum {item.minimumQuantity} {item.unit}
                                    </small>
                                  )}
                              </span>
                              <strong>
                                {money(
                                  category === "member" ? 100000 : item.price,
                                )}
                                <small>
                                  {" "}
                                  /{" "}
                                  {category === "member"
                                    ? "deposit"
                                    : item.unit}
                                </small>
                              </strong>
                              <Plus size={17} />
                            </button>
                          ))}
                        </div>
                      </section>
                    );
                  })}
                </div>
                <div className="pricing-note" data-scroll-reveal>
                  <Info size={16} />
                  <span>
                    Cucian setiap pelanggan diproses di mesin terpisah. Ongkir
                    akan dikonfirmasi oleh toko.
                  </span>
                </div>
              </section>
            )}
            {view === "tracking" && (
              <section className="tracking-page" data-scroll-reveal>
                <h1>Lacak pesanan</h1>
                <form
                  className="track-search"
                  onSubmit={(e) => {
                    e.preventDefault();
                    load();
                  }}
                >
                  <label className="search-box">
                    <Search size={20} />
                    <input
                      aria-label="Nomor pesanan atau kode tracking"
                      required
                      placeholder="Nomor pesanan / kode"
                      value={track}
                      onChange={(e) => setTrack(e.target.value)}
                    />
                  </label>
                  <button className="primary">Lacak pesanan</button>
                </form>
                {tracked ? (
                  <Tracking
                    order={tracked}
                    services={store.services}
                    isOwner={
                      !!auth.user &&
                      orders.some(
                        (order) =>
                          order.id === tracked.id &&
                          order.uid === auth.user?.uid,
                      )
                    }
                    trackingToken={
                      /^[0-9a-f-]{36}$/i.test(track.trim())
                        ? track.trim()
                        : orders.find((o) => o.id === tracked.id)?.token
                    }
                    paymentEnabled={store.paymentEnabled}
                    onOrderChanged={() => {
                      void load();
                      const requestedTrack = track.trim();
                      if (/^[0-9a-f-]{36}$/i.test(requestedTrack))
                        void refreshTracking(requestedTrack);
                    }}
                  />
                ) : !store.configured && !track ? (
                  <Tracking
                    order={previewTracking}
                    services={store.services}
                    preview
                  />
                ) : track ? (
                  <Empty
                    title="Pesanan belum ditemukan"
                    text={
                      trackingError ||
                      "Masuk untuk mencari nomor pesanan, atau buka tautan yang diberikan toko."
                    }
                  />
                ) : (
                  <Empty
                    title="Belum ada pesanan"
                    text="Masukkan nomor pesanan untuk melihat status terbaru cucianmu."
                  />
                )}
                {!!myOrders.length && (
                  <section className="history">
                    <h3>Pesanan kamu</h3>
                    {myOrders.map((o) => (
                      <button key={o.id} onClick={() => { setTrack(o.id); scrollMobileTrackingTop(window); }}>
                        <Package size={20} />
                        <span>
                          <b>{o.id}</b>
                          <small>
                            {
                              store.services.find((s) => s.id === o.service)
                                ?.name
                            }{" "}
                            · {o.quantityPending ? "Menunggu jumlah" : `${o.actualKg ?? o.kg} ${unitLabel(o.unit ?? store.services.find((s) => s.id === o.service)?.unit)}`}
                          </small>
                        </span>
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <span className="status">{statuses[o.status]}</span>
                          <PaymentStatus
                            paid={o.paid}
                            manualPayment={o.manualPayment}
                            payment={o.payment}
                            reviewRequired={o.paymentReconciliationRequired}
                            compact
                          />
                        </div>
                      </button>
                    ))}
                  </section>
                )}
              </section>
            )}
          </main>
          <footer className={tenantBranch ? "tenant-footer" : undefined}>
            {tenantBranch ? <TenantBrand branch={tenantBranch} /> : <Brand />}
            {tenantBranch && <Link href={DFABLE_HOME} className="tenant-platform-link">Semua laundry di Washloka <span aria-hidden="true">→</span></Link>}
            <span>© {new Date().getFullYear()} Washloka. All rights reserved.</span>
          </footer>
          <CustomerNavigation tenant={!!tenantBranch} view={view} mobile onView={navigateCustomer} />
        </div>
      )}
      <dialog
        aria-label={modal === "pos-membership" ? "Membership Washloka" : modal === "order" && !dashboard ? "Form pemesanan" : "Form Washloka"}
        ref={dialog}
        onCancel={() => setModal("")}
        onClick={(e) => {
          if (e.target === dialog.current) setModal("");
        }}
        className={`${!dashboard && modal !== "login" && tenantBranch === "dfablelaundry" ? "tenant-dfable " : !dashboard && modal !== "login" && tenantBranch === "buzzwash" ? "tenant-buzzwash " : ""}${
          modal === "order"
            ? dashboard
              ? "order-dialog dashboard-dialog"
              : "order-dialog customer-order-dialog"
            : modal === "login"
              ? "auth-dialog"
              : modal === "detail"
                ? "staff-detail-dialog"
                : dashboard
                  ? "dashboard-dialog"
                  : ""
        }`}
      >
        <button
          className="close-button"
          onClick={() => setModal("")}
          aria-label="Tutup"
        >
          <X size={21} />
        </button>
        {modal === "order" && dashboard && (
          <OrderForm
            key={branch}
            branchId={branch}
            branchName={branchName}
            initialLocation={branchLocations[branch]}
            services={store.services}
            initialService={service}
            profile={profile}
            pos={dashboard}
            busy={busy}
            submit={async (data) => {
              const result = await action("order", data);
              setTrack(result.id);
              setSelected(
                result.store.orders.find((o: Order) => o.id === result.id),
              );
              setModal("success");
              if (!dashboard) setView("tracking");
            }}
          />
        )}
        {modal === "pos-membership" && dashboard && <PosMembershipForm key={branch} branch={branch} />}
        {modal === "order" && !dashboard && (
          <CustomerOrderForm
            branchId={branch}
            branchName={branchName}
            initialLocation={branchLocations[branch]}
            services={store.services}
            initialService={service}
            profile={profile}
            busy={busy}
            submit={async (data) => {
              const result = await action("order", data);
              if (typeof result.trackingToken !== "string" || !/^[0-9a-f-]{36}$/i.test(result.trackingToken))
                throw Error("Pesanan tersimpan, tetapi tautan tracking belum tersedia. Hubungi toko untuk bantuan.");
              setCustomerOrder({ id: result.id, token: result.trackingToken });
              setTrack(result.trackingToken);
              const next = new URL(window.location.href);
              next.searchParams.set("track", result.trackingToken);
              next.searchParams.set("branch", branch);
              window.history.replaceState(window.history.state, "", next);
              setView("tracking");
              setModal("success");
            }}
          />
        )}
        {modal === "success" && !dashboard && customerOrder && (
          <div className="success">
            <span className="success-icon"><Check size={30} /></span>
            <p className="eyebrow">PESANAN TERSIMPAN</p>
            <h2>Pesanan berhasil dibuat</h2>
            <p>Pesanan <b>{customerOrder.id}</b> sudah diterima {branchName}. Toko akan menghubungi kamu melalui WhatsApp dan mengonfirmasi harga sebelum pembayaran.</p>
            <div className="customer-order-notice">Simpan tautan tracking ini untuk memantau pesanan dan melakukan pembayaran setelah tagihan dikonfirmasi.</div>
            <button type="button" className="primary" onClick={async () => {
              try { await navigator.clipboard.writeText(`${location.origin}${dfableTrackingPath(customerOrder.token, branch)}`); notify("Link tracking disalin"); }
              catch { notify("Salin alamat halaman ini untuk menyimpan tautan tracking."); }
            }}><Copy size={17} /> Salin link tracking</button>
            <button type="button" className="secondary" onClick={() => { scrollTrackingAfterDialog.current = true; setModal(""); setView("tracking"); }}>Lacak pesanan</button>
          </div>
        )}
        {modal === "success" && dashboard && selected && currentSelected && (
          <div className="success">
            <span className="success-icon">
              <Check size={30} />
            </span>
            <p className="eyebrow">PESANAN TERSIMPAN</p>
            <h2>
              {dashboard ? "Pesanan walk-in tersimpan" : "Pilih pembayaran"}
            </h2>
            <p>
              Pesanan <b>{selected.id}</b> tersimpan di {branchName}.
              {dashboard
                ? " Bagikan link tracking kepada pelanggan setelah selesai."
                : " Berat aktual dan ongkir akan dikonfirmasi toko."}
            </p>
            <div className="total-line">
              <span>{dashboard ? "Total tagihan" : "Estimasi sisa pembayaran"}</span>
              <span className="order-success-amount">
                {!dashboard && ((currentSelected.membershipUsed || 0) + (currentSelected.pointsUsed || 0) > 0) && (
                  <del><span className="sr-only">Sebelum saldo dan poin: </span>{money(currentSelected.total + (currentSelected.membershipUsed || 0) + (currentSelected.pointsUsed || 0))}</del>
                )}
                <b>{money(currentSelected.total)}</b>
              </span>
            </div>
            {!dashboard && currentSelected.shippingFee === null && <p className="order-success-shipping-note">Belum termasuk ongkir. Harga akhir mengikuti jumlah yang dikonfirmasi toko.</p>}
            <div className="my-5 text-left">
              {!dashboard && auth.user?.uid === currentSelected.uid && (
                <>
                  <MembershipRedemption order={currentSelected} onChanged={() => { void load(); }} />
                  <LoyaltyRedemption order={currentSelected} onChanged={() => { void load(); }} />
                </>
              )}
              <PaymentPanel
                key={`${currentSelected.id}-${currentSelected.pointsUsed || 0}-${currentSelected.membershipUsed || 0}-${currentSelected.paid}`}
                orderId={selected.id}
                trackingToken={selected.token}
                enabled={store.paymentEnabled}
                hideQrByDefault={dashboard}
                initialPaid={
                  store.orders.find((o) => o.id === selected.id)?.paid ??
                  selected.paid
                }
                initialPayment={
                  store.orders.find((o) => o.id === selected.id)?.payment ??
                  selected.payment
                }
                initialReviewRequired={
                  store.orders.find((o) => o.id === selected.id)
                    ?.paymentReconciliationRequired ??
                  selected.paymentReconciliationRequired
                }
                initialManualPayment={
                  store.orders.find((o) => o.id === selected.id)
                    ?.manualPayment ?? selected.manualPayment
                }
                onChanged={() => {
                  void load();
                }}
              />
            </div>
            {dashboard && (
              <>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => window.print()}
                >
                  <Printer size={17} /> Cetak struk / PDF
                </button>
                <StaffReceipt
                  order={
                    store.orders.find((o) => o.id === selected.id) || selected
                  }
                  services={store.services}
                />
              </>
            )}
            <button
              className="primary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    `${location.origin}${dfableTrackingPath(selected.token, selected.branchId)}`,
                  );
                  notify("Link tracking disalin");
                } catch {
                  notify("Tidak bisa menyalin. Gunakan nomor pesanan di atas.");
                }
              }}
            >
              <Copy size={17} /> Salin link tracking
            </button>
            <button
              className="secondary"
              onClick={() => {
                setModal("");
                if (dashboard) setAdminView("orders");
              }}
            >
              Lihat pesanan
            </button>
          </div>
        )}
        {modal === "login" && (
          <AccountPanel
            phone={profile.phone}
            onDone={() => {
              if (pendingOrder.current) {
                pendingOrder.current = false;
                setModal("order");
              } else setModal("");
            }}
          />
        )}
        {modal === "member" && (
          <div>
            <span className="service-icon">
              <Layers />
            </span>
            <p className="eyebrow">MEMBERSHIP TOKO</p>
            <h2>Lebih hemat dengan membership</h2>
            <p className="muted">
              Deposit mulai Rp100.000 dapat digunakan untuk membayar layanan
              laundry. Setelah deposit dikonfirmasi, nikmati diskon 20% untuk
              layanan selama saldo masih tersedia saat pesanan dibuat.
            </p>
            <div className="notice">
              <Info size={20} /> Tim toko akan memeriksa transfer sebelum saldo
              ditambahkan.
            </div>
            <button
              className="primary"
              onClick={() => {
                if (auth.user && auth.verified)
                  window.location.assign(profileHref);
                else setModal("login");
              }}
            >
              {auth.user && auth.verified
                ? "Buka membership"
                : "Masuk untuk daftar"}
            </button>
          </div>
        )}
        {modal === "detail" && selected && (
          <StaffOrderDetail
            order={store.orders.find((o) => o.id === selected.id) || selected}
            services={store.services}
            busy={busy}
            paymentEnabled={store.paymentEnabled}
            onPaymentChanged={() => {
              void load();
            }}
            save={async (d) => {
              await action("update", d);
              notify("Pesanan berhasil diperbarui");
            }}
          />
        )}
      </dialog>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {toast}
        </div>
      )}
    </>
  );
}
function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty">
      <Package size={34} strokeWidth={1.2} />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
function OrderForm({
  branchId,
  branchName,
  initialLocation,
  services,
  initialService,
  profile,
  pos,
  busy,
  submit,
}: {
  branchId: BranchId;
  branchName: string;
  initialLocation: { latitude: number; longitude: number };
  services: Service[];
  initialService: string;
  profile: { name: string; phone: string };
  pos: boolean;
  busy: boolean;
  submit: (data: unknown) => Promise<void>;
}) {
  const auth = useAuth();
  const [step, setStep] = useState(1);
  const [requestId] = useState(() => crypto.randomUUID());
  const [service, setService] = useState(initialService);
  const [kg, setKg] = useState(() =>
    pos
      ? 0
      : services.find((item) => item.id === initialService)?.minimumQuantity ||
        1,
  );
  const [speed, setSpeed] = useState<ServiceSpeed>(() => defaultSpeed(services.find((item) => item.id === initialService) || services[0]));
  const [insurance, setInsurance] = useState(false);
  const [posUseMembershipBalance, setPosUseMembershipBalance] = useState(false);
  const [memberActive, setMemberActive] = useState(false);
  const [rewardBalances, setRewardBalances] = useState<{ points: number; membership: number; pointsBlocked: boolean } | null>(null);
  const [rewardsLoading, setRewardsLoading] = useState(!pos);
  const [rewardsError, setRewardsError] = useState(false);
  const [rewardsRevision, setRewardsRevision] = useState(0);
  const [usePoints, setUsePoints] = useState(false);
  const [useMembershipBalance, setUseMembershipBalance] = useState(false);
  const [posPayment, setPosPayment] = useState<"later" | "cash" | "transfer">(
    "later",
  );
  const [lat, setLat] = useState(initialLocation.latitude);
  const [lng, setLng] = useState(initialLocation.longitude);
  const pickupLocationEdited = useRef(false);
  const [photo, setPhoto] = useState("");
  const [error, setError] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [form, setForm] = useState({
    name: pos ? "" : profile.name,
    phone: pos ? "" : profile.phone,
    address: pos ? `Datang langsung - ${branchName}` : "",
    date: today(),
    slot: "09.00–12.00",
    notes: "",
  });
  const set = (key: string, value: string) =>
    setForm((p) => ({ ...p, [key]: value }));
  const posLookup = usePosMembership(branchId, form.phone, pos && step === 2);
  const posMember = posLookup.data?.member;
  const waitingForPosMember = pos && step === 2 && (!posLookup.data || posLookup.activationPending);
  const selectedService =
    services.find((item) => item.id === service) || services[0];
  useEffect(() => {
    if (pos || !auth.user) return;
    let current = true;
    setRewardsLoading(true);
    setRewardsError(false);
    Promise.all([
      auth.request(`/api/membership?branch=${encodeURIComponent(branchId)}`),
      auth.request("/api/loyalty"),
    ])
      .then(async ([membershipResponse, pointsResponse]) => {
        if (!membershipResponse.ok || !pointsResponse.ok) throw Error("Saldo belum bisa dimuat");
        const [membership, loyalty] = await Promise.all([membershipResponse.json(), pointsResponse.json()]);
        if (!Number.isSafeInteger(membership.balance) || membership.balance < 0 || !Number.isSafeInteger(loyalty.balance) || loyalty.balance < 0) throw Error("Saldo tidak valid");
        if (current) {
          const eligible = membership.discountEligible === true;
          setMemberActive(eligible);
          setRewardBalances({ points: loyalty.balance, membership: membership.balance, pointsBlocked: loyalty.reconciliationRequired === true });
          setUseMembershipBalance(eligible);
        }
      })
      .catch(() => {
        if (current) {
          setRewardsError(true);
          setRewardBalances(null);
          setMemberActive(false);
          setUsePoints(false);
          setUseMembershipBalance(false);
        }
      })
      .finally(() => { if (current) setRewardsLoading(false); });
    return () => {
      current = false;
    };
  }, [pos, branchId, auth.user?.uid, auth.request, rewardsRevision]);
  const estimatedBaseService = pos && kg === 0 ? 0 : estimate(services, service, kg, speed);
  const membershipEligible = pos ? posMember?.discountEligible : memberActive;
  const estimatedService = membershipEligible ? Math.round(estimatedBaseService * 0.8) : estimatedBaseService;
  const estimatedMemberDiscount = estimatedBaseService - estimatedService;
  const estimatedMembership = !pos && useMembershipBalance && memberActive && rewardBalances
    ? Math.min(rewardBalances.membership, estimatedService) : 0;
  const availablePosBalance = posMember?.discountEligible && !selectedService.startingAt
    ? Math.min(posMember.balance, estimatedService) : 0;
  const posMembershipCharge = posUseMembershipBalance ? availablePosBalance : 0;
  const estimatedPoints = !pos && usePoints && rewardBalances && !rewardBalances.pointsBlocked
    ? Math.min(rewardBalances.points, estimatedService - estimatedMembership) : 0;
  const estimatedRemaining = pos && kg === 0
    ? 0
    : estimatedService - estimatedPoints - estimatedMembership - posMembershipCharge + (insurance ? 1000 : 0);
  const estimatedBeforeDiscounts = estimatedBaseService + (pos && kg === 0 ? 0 : insurance ? 1000 : 0);
  const showOriginalPrice = estimatedBeforeDiscounts > estimatedRemaining;
  const posPaidByBalance = posMembershipCharge > 0 && estimatedRemaining === 0;
  const selectService = (id: string) => {
    setService(id);
    const next = services.find((item) => item.id === id);
    setKg(pos ? 0 : next?.minimumQuantity || 1);
    if (next) setSpeed(defaultSpeed(next));
    setPosPayment("later");
  };
  useEffect(() => {
    if (pickupLocationEdited.current) return;
    setLat(initialLocation.latitude);
    setLng(initialLocation.longitude);
  }, [initialLocation.latitude, initialLocation.longitude]);
  async function photoRead(file?: File) {
    if (!file) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 8 * 1024 * 1024
    ) {
      setError("Gunakan JPG, PNG, atau WebP maksimal 8 MB.");
      return;
    }
    setPhotoBusy(true);
    setError("");
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 1000 / Math.max(bitmap.width, bitmap.height));
      const c = document.createElement("canvas");
      c.width = bitmap.width * scale;
      c.height = bitmap.height * scale;
      c.getContext("2d")!.drawImage(bitmap, 0, 0, c.width, c.height);
      bitmap.close();
      setPhoto(c.toDataURL("image/jpeg", 0.75));
    } catch {
      setError("Foto tidak bisa dibaca. Pilih foto lain.");
    } finally {
      setPhotoBusy(false);
    }
  }
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        if (!pos && (rewardsLoading || rewardsError || !rewardBalances)) {
          setError("Poin dan saldo belum siap. Silakan coba lagi.");
          return;
        }
        if (step === 1) {
          setStep(2);
          return;
        }
        if (waitingForPosMember) {
          setError("Cek status membership pelanggan sebelum menyimpan pesanan.");
          return;
        }
        try {
          await submit({
            ...form,
            service,
            kg,
            speed,
            express: speed !== "regular",
            lat,
            lng,
            photo,
            source: pos ? "pos" : "web",
            insurance,
            ...(!pos ? { usePoints, useMembershipBalance, membershipLimit: estimatedMembership, pointsLimit: estimatedPoints } : {}),
            ...(pos
              ? {
                  posPayment: posPaidByBalance ? "later" : posPayment,
                  ...(posMembershipCharge > 0 ? {
                    posUseMembershipBalance: true,
                    posMembershipReference: posMember?.reference,
                    expectedMembershipAmount: posMembershipCharge,
                  } : {}),
                  expectedTotal: estimatedRemaining,
                }
              : {}),
            requestId,
          });
        } catch (e) {
          setError((e as Error).message);
          if (pos) {
            setPosUseMembershipBalance(false);
            posLookup.refresh();
          }
        }
      }}
    >
      <p className="eyebrow">
        {pos ? `KASIR · ${branchName.toUpperCase()}` : "PESAN LAUNDRY"}
      </p>
      <h2>
        {step === 1
          ? pos
            ? "Catat cucian masuk"
            : "Pilih layanan cucianmu"
          : pos
            ? "Data pelanggan"
            : "Alamat dan jadwal jemput"}
      </h2>
      <div className="form-steps">
        <span className={step === 1 ? "active" : ""}>
          01 {pos ? "Detail cucian" : "Layanan"}
        </span>
        <span className={step === 2 ? "active" : ""}>
          02 {pos ? "Data pelanggan" : "Jadwal & alamat"}
        </span>
      </div>
      {!pos && (
        <div className="order-store-summary">
          <span
            className={`order-store-logo${branchName === branches.dfablelaundry ? " order-store-logo--dfable" : ""}`}
            aria-hidden="true"
          >
            {branchName === branches.dfablelaundry ? (
              "D"
            ) : (
              <StoreIcon size={21} aria-hidden="true" />
            )}
          </span>
          <span>
            <small>Toko pilihan</small>
            <b>{branchName}</b>
          </span>
        </div>
      )}
      {step === 1 ? (
        <>
          {pos ? (
            <div className="pos-selected-service">
              <span className="pos-selected-service-icon">
                <Icon service={selectedService} size={21} />
              </span>
              <span>
                <small>Layanan yang dipilih</small>
                <b>{selectedService.name}</b>
              </span>
              <strong>
                {money(serviceRate(selectedService, speed))}
                <small>
                  {selectedService.packageSize
                    ? ` / ${selectedService.packageSize} kg`
                    : ` / ${selectedService.unit}`}
                </small>
              </strong>
            </div>
          ) : (
            <div className="choice-services">
              {services
                .filter((item) => item.category === "daily")
                .map((s) => (
                  <button
                    type="button"
                    key={s.id}
                    className={service === s.id ? "selected" : ""}
                    onClick={() => selectService(s.id)}
                  >
                    <Icon service={s} />
                    <span>
                      <b>{s.name}</b>
                      <small>
                        {money(serviceRate(s))} /{" "}
                        {s.packageSize ? `${s.packageSize} kg` : s.unit}
                      </small>
                    </span>
                    <span className="radio-dot">
                      {service === s.id && <Check size={12} />}
                    </span>
                  </button>
                ))}
              {selectedService.category !== "daily" && (
                <div className="selected-service-note">
                  <Icon service={selectedService} size={17} />
                  <span>
                    <b>{selectedService.name}</b>
                    <small>
                      {money(serviceRate(selectedService))} /{" "}
                      {selectedService.unit}
                    </small>
                  </span>
                </div>
              )}
              <details
                className="order-other-services"
                open={selectedService.category !== "daily"}
              >
                <summary>Layanan satuan & lainnya</summary>
                <select
                  aria-label="Pilih layanan satuan"
                  value={
                    selectedService.category === "daily"
                      ? ""
                      : selectedService.id
                  }
                  onChange={(event) => selectService(event.target.value)}
                >
                  <option value="" disabled>
                    Pilih layanan
                  </option>
                  {serviceCategoryOrder
                    .filter(
                      (category) =>
                        category !== "daily" && category !== "member",
                    )
                    .map((category) => (
                      <optgroup
                        key={category}
                        label={serviceCategoryLabels[category]}
                      >
                        {services
                          .filter((item) => item.category === category)
                          .map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name} · {money(item.price)} / {item.unit}
                            </option>
                          ))}
                      </optgroup>
                    ))}
                </select>
              </details>
            </div>
          )}
          <label>
            {selectedService.unit === "kg"
              ? pos
                ? "Berat aktual"
                : "Perkiraan berat"
              : `Jumlah ${selectedService.unit}`}
            <div className="weight-control">
              <button
                aria-label={
                  selectedService.unit === "kg"
                    ? "Kurangi berat"
                    : "Kurangi jumlah"
                }
                type="button"
                onClick={() =>
                  setKg(Math.max(selectedService.minimumQuantity || 1, kg - 1))
                }
              >
                <Minus size={17} />
              </button>
              <input
                aria-label={`Jumlah ${selectedService.unit}`}
                type="number"
                min={selectedService.minimumQuantity || 1}
                max={selectedService.maximumQuantity || 100}
                step={selectedService.unit === "kg" ? 0.1 : 1}
                required
                value={pos && kg === 0 ? "" : kg}
                onChange={(e) => setKg(Number(e.target.value))}
                placeholder={
                  pos
                    ? `Min. ${selectedService.minimumQuantity || 1}`
                    : undefined
                }
              />
              <span>{selectedService.unit}</span>
              <button
                aria-label={
                  selectedService.unit === "kg"
                    ? "Tambah berat"
                    : "Tambah jumlah"
                }
                type="button"
                onClick={() =>
                  setKg(
                    kg === 0
                      ? selectedService.minimumQuantity || 1
                      : Math.min(selectedService.maximumQuantity || 100, kg + 1),
                  )
                }
              >
                <Plus size={17} />
              </button>
            </div>
            <small>
              {selectedService.pricingModel === "flat-package"
                ? `Paket maksimal ${selectedService.maximumQuantity} kg, harga tetap per paket.`
                : pos
                ? selectedService.unit === "kg"
                  ? "Masukkan hasil timbangan sebelum lanjut."
                  : "Masukkan jumlah barang sebelum lanjut."
                : selectedService.unit === "kg"
                  ? "Berat pasti dikonfirmasi setelah cucian ditimbang di toko."
                  : "Jumlah pasti dikonfirmasi saat cucian diterima di toko."}
            </small>
          </label>
          {selectedService.rates ? (
            <>
              <label>Kecepatan layanan</label>
              <div className="speed-choice">
                {serviceSpeeds.filter((option) => serviceAvailableSpeeds(selectedService).includes(option.id)).map((option) => (
                  <button
                    className={speed === option.id ? "selected" : ""}
                    type="button"
                    key={option.id}
                    onClick={() => setSpeed(option.id)}
                  >
                    {option.id === "regular" ? (
                      <Clock size={18} />
                    ) : (
                      <Wind size={18} />
                    )}
                    <b>{branchId === "buzzwash" && option.id === "quick" ? "Kilat" : option.label}</b>
                    <small>{option.days}</small>
                    <strong>
                      {money(serviceRate(selectedService, option.id))}
                      <small>
                        /{" "}
                        {selectedService.pricingModel === "flat-package"
                          ? `paket maks. ${selectedService.maximumQuantity} kg`
                          : selectedService.packageSize
                          ? `${selectedService.packageSize} kg`
                          : selectedService.unit}
                      </small>
                    </strong>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="service-standard-time">
              <Clock size={15} /> {selectedService.days === "Dikonfirmasi toko" ? "Waktu pengerjaan dikonfirmasi toko" : `Waktu standar: ${selectedService.days}`}
            </p>
          )}
          {selectedService.startingAt && (
            <div className="notice"><Info size={18} /><span>Harga mulai dari {money(selectedService.price)} per {selectedService.unit}. Harga akhir dikonfirmasi toko sebelum pembayaran.</span></div>
          )}
          {!pos && (
            <section className="order-rewards" aria-label="Poin dan saldo membership">
              <div className="order-rewards-heading">
                <span className="order-rewards-icon"><Wallet size={19} aria-hidden="true" /></span>
                <div><h3>Poin & saldo membership</h3><p>Gunakan untuk mengurangi biaya layanan.</p></div>
              </div>
              {rewardsLoading && <p className="order-rewards-note" role="status">Memuat poin dan saldo…</p>}
              {rewardsError && <p className="order-rewards-note" role="alert">Poin dan saldo belum bisa dimuat. <button type="button" onClick={() => setRewardsRevision((value) => value + 1)}>Coba lagi</button> untuk melanjutkan pesanan.</p>}
              {!rewardsLoading && !rewardsError && rewardBalances && <div className="order-rewards-options">
                <label className="order-rewards-choice">
                  <span className="order-rewards-choice-icon"><Wallet size={18} aria-hidden="true" /></span>
                  <span className="order-rewards-copy"><b>Saldo membership</b><small>{money(rewardBalances.membership)}{memberActive ? " · aktif" : " · belum tersedia"}</small></span>
                  <input type="checkbox" checked={useMembershipBalance} disabled={!memberActive} onChange={(event) => setUseMembershipBalance(event.target.checked)} aria-label="Gunakan saldo membership" />
                </label>
                <label className="order-rewards-choice">
                  <span className="order-rewards-choice-icon"><Coins size={18} aria-hidden="true" /></span>
                  <span className="order-rewards-copy"><b>Poin loyalty</b><small>{rewardBalances.points.toLocaleString("id-ID")} poin · {money(rewardBalances.points)}{rewardBalances.pointsBlocked ? " · sedang diperiksa" : ""}</small></span>
                  <input type="checkbox" checked={usePoints} disabled={rewardBalances.points === 0 || rewardBalances.pointsBlocked} onChange={(event) => setUsePoints(event.target.checked)} aria-label="Gunakan poin loyalty" />
                </label>
              </div>}
              {!rewardsLoading && !rewardsError && rewardBalances && <p className="order-rewards-note">Saldo dipakai lebih dulu, lalu poin. Potongan diterapkan saat pesanan dibuat berdasarkan perkiraan. Jika biaya akhir lebih rendah, kelebihannya dikembalikan; jika lebih tinggi, selisih menjadi tagihan tambahan. Ongkir belum termasuk.</p>}
            </section>
          )}
          {branchId !== "buzzwash" && <label className="insurance-choice">
            <input
              type="checkbox"
              checked={insurance}
              onChange={(event) => setInsurance(event.target.checked)}
            />
            <span>
              <b>Perlindungan cucian · Rp1.000</b>
              <small>
                Untuk kehilangan, kerusakan, atau warna luntur ke pakaian putih.
                Kompensasi berdasarkan harga pakaian setelah depresiasi sesuai
                penilaian toko; syarat selengkapnya ditetapkan lebih lanjut.
              </small>
            </span>
          </label>}
          {!pos && (
            <label className="upload">
              {photo ? (
                <img src={photo} alt="Foto cucian" />
              ) : (
                <Camera size={25} />
              )}
              <span>
                <b>{photo ? "Ganti foto cucian" : "Tambahkan foto cucian"}</b>
                <small>Opsional · JPG, PNG, WebP · maks. 8 MB</small>
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => photoRead(e.target.files?.[0])}
              />
            </label>
          )}
          {!pos && photo && (
            <button
              type="button"
              className="text-button"
              onClick={() => setPhoto("")}
            >
              Hapus foto
            </button>
          )}
          <label>
            Catatan perawatan
            <textarea
              value={form.notes}
              maxLength={1000}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Misalnya: pisahkan baju putih, tanpa pewangi…"
            />
          </label>
        </>
      ) : (
        <>
          <div className="form-two">
            <label>
              Nama pelanggan
              <input
                autoComplete="name"
                required
                minLength={2}
                maxLength={80}
                value={form.name}
                disabled={pos && (busy || posLookup.activationPending)}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Nama lengkap"
              />
            </label>
            <label>
              Nomor WhatsApp
              <input
                autoComplete="tel"
                type="tel"
                required
                pattern={pos ? undefined : "(\\+62|62|0)8[0-9]{7,12}"}
                value={form.phone}
                disabled={pos && (busy || posLookup.activationPending)}
                onChange={(e) => {
                  if (pos && normalizePhone(e.target.value) !== normalizePhone(form.phone)) setPosUseMembershipBalance(false);
                  set("phone", e.target.value);
                }}
                placeholder="08xxxxxxxxxx"
              />
              {pos && form.phone && !posLookup.key && <small>Isi nomor WhatsApp pelanggan dengan lengkap.</small>}
            </label>
          </div>
          {pos && (
            <PosMembershipDetails key={posLookup.key} lookup={posLookup} name={form.name} disabled={busy} />
          )}
          {pos && availablePosBalance > 0 && (
            <label className="pos-member-use">
              <input type="checkbox" checked={posUseMembershipBalance} disabled={busy || posLookup.activationPending}
                onChange={(event) => setPosUseMembershipBalance(event.target.checked)} />
              <span>
                <b>Pakai saldo membership {money(availablePosBalance)}</b>
                <small>Centang jika pelanggan setuju. Pemakaian saldo dicatat saat pesanan disimpan.</small>
              </span>
            </label>
          )}
          {posPaidByBalance && <p className="small-note">Seluruh tagihan akan lunas dengan saldo membership.</p>}
          {pos && !posPaidByBalance && (
            <fieldset className="pos-payment-choice">
              <legend>{posMembershipCharge > 0 ? "Pembayaran sisa tagihan" : "Pembayaran"}</legend>
              {(
                [
                  ["later", "Bayar nanti", "Pesanan dicatat belum dibayar"],
                  ["cash", "Tunai diterima", "Tandai lunas saat disimpan"],
                  [
                    "transfer",
                    "Transfer sekarang",
                    "Periksa transfer setelah pesanan dibuat",
                  ],
                ] as const
              ).filter(([value]) => !selectedService.startingAt || value === "later").map(([value, title, description]) => (
                <label
                  key={value}
                  className={posPayment === value ? "selected" : ""}
                >
                  <input
                    type="radio"
                    name="posPayment"
                    value={value}
                    checked={posPayment === value}
                    onChange={() => setPosPayment(value)}
                  />
                  <span>
                    <b>{title}</b>
                    <small>{description}</small>
                  </span>
                </label>
              ))}
            </fieldset>
          )}
          {pos && selectedService.startingAt && <p className="small-note">Harga akhir perlu dikonfirmasi toko sebelum pembayaran.</p>}
          {!pos && (
            <>
              <label>Titik penjemputan</label>
              <MapPicker
                lat={lat}
                lng={lng}
                onAddress={(address) => set("address", address)}
                onChange={(a, b) => {
                  pickupLocationEdited.current = true;
                  setLat(a);
                  setLng(b);
                }}
              />
              <label>
                Alamat lengkap & patokan
                <textarea
                  autoComplete="street-address"
                  required
                  minLength={8}
                  maxLength={500}
                  value={form.address}
                  onChange={(e) => set("address", e.target.value)}
                  placeholder="Nama jalan, nomor rumah, RT/RW, patokan…"
                />
              </label>
            </>
          )}
          {!pos && (
            <div className="form-two">
              <label>
                Tanggal jemput
                <input
                  type="date"
                  min={today()}
                  required
                  value={form.date}
                  onChange={(e) => set("date", e.target.value)}
                />
              </label>
              <label>
                Waktu
                <select
                  value={form.slot}
                  onChange={(e) => set("slot", e.target.value)}
                >
                  {["09.00–12.00", "12.00–15.00", "15.00–18.00"].map((t) => (
                    <option key={t} value={t}>{t.replaceAll("–", "-")}</option>
                  ))}
                </select>
              </label>
            </div>
          )}
          {!pos && (
            <>
              <div className="notice">
                <Info size={18} />
                <span>
                  Toko akan mengonfirmasi jadwal, ongkir, dan jumlah akhir
                  sebelum kamu melakukan pembayaran.
                </span>
              </div>
              <label className="checkbox">
                <input type="checkbox" required /> Saya setuju jumlah akhir dan
                ongkir dikonfirmasi oleh toko. Nomor WhatsApp saya disimpan
                untuk pesanan ini dan berikutnya.
              </label>
            </>
          )}
        </>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="form-summary">
        <div>
          <small>
            {pos
              ? posMembershipCharge > 0 ? "Sisa pembayaran" : "Total layanan"
              : selectedService.startingAt
                ? "Estimasi dibayar · harga mulai"
                : serviceAvailableSpeeds(selectedService).length === 0
                  ? "Estimasi dibayar · waktu dikonfirmasi toko"
                  : `Estimasi dibayar · ${branchId === "buzzwash" && speed === "quick" ? "kilat" : speedLabel(speed).toLowerCase()}`}
          </small>
          <div className="order-summary-amounts">
            {showOriginalPrice && <del><span className="sr-only">Harga sebelum potongan: </span>{money(estimatedBeforeDiscounts)}</del>}
            <strong>{money(estimatedRemaining)}</strong>
          </div>
          <small>
            {kg} {selectedService.unit} ·{" "}
            {pos ? "berat/jumlah aktual" : "belum termasuk ongkir"}
          </small>
          {showOriginalPrice && (
            <div className="order-summary-breakdown" aria-label="Rincian potongan">
              {estimatedMemberDiscount > 0 && <div><span>Diskon member 20%</span><span>−{money(estimatedMemberDiscount)}</span></div>}
              {posMembershipCharge > 0 && <div><span>Saldo membership</span><span>−{money(posMembershipCharge)}</span></div>}
              {estimatedMembership > 0 && <div><span>Saldo membership</span><span>−{money(estimatedMembership)}</span></div>}
              {estimatedPoints > 0 && <div><span>Poin loyalty</span><span>−{money(estimatedPoints)}</span></div>}
            </div>
          )}
        </div>
        <div>
          {step === 2 && (
            <button
              type="button"
              className="secondary"
              disabled={busy || posLookup.activationPending}
              onClick={() => {
                setStep(1);
                if (pos) setPosUseMembershipBalance(false);
              }}
            >
              Kembali
            </button>
          )}
          <button disabled={busy || photoBusy || waitingForPosMember || (!pos && (rewardsLoading || rewardsError || !rewardBalances))} className="primary">
            {busy
              ? "Menyimpan…"
              : step === 1
                ? "Lanjutkan"
                : pos
                  ? "Simpan pesanan"
                  : "Buat pesanan"}
          </button>
        </div>
      </div>
    </form>
  );
}
function PriceEditor({
  store,
  save,
}: {
  store: Store;
  save: (data: unknown) => Promise<void>;
}) {
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="panel settings-panel"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const f = new FormData(e.currentTarget);
        const data = store.services.map((service) => {
          if (service.category === "member")
            return { id: service.id, price: service.price };
          if (!service.rates)
            return { id: service.id, price: Number(f.get(service.id)) };
          const rates = Object.fromEntries(
            serviceAvailableSpeeds(service).map((speed) => [
              speed,
              Number(f.get(`${service.id}.${speed}`)),
            ]),
          ) as Partial<Record<ServiceSpeed, number>>;
          return { id: service.id, price: rates[defaultSpeed(service)] ?? service.price, rates };
        });
        if (
          data.some(
            (service) =>
              !Number.isFinite(service.price) || service.price < 1000,
          )
        ) {
          setMsg(
            "Periksa kembali harga. Semua layanan harus memiliki harga yang valid.",
          );
          setBusy(false);
          return;
        }
        try {
          await save(data);
          setMsg("Tersimpan. Pesanan lama tetap memakai harga saat dibuat.");
        } catch (e) {
          setMsg((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3>Harga layanan {branches[store.branchId || "dfablelaundry"]}</h3>
      <p className="muted">
        Satu daftar harga dipakai pelanggan, kasir, dan pesanan baru. Pesanan
        lama tetap memakai harga saat dibuat.
      </p>
      <div className="price-editor-catalog">
        {serviceCategoryOrder.map((category) => {
          if (category === "member") return null;
          const group = store.services.filter(
            (service) => service.category === category,
          );
          if (!group.length) return null;
          return (
            <section
              className="price-editor-group"
              data-matrix={category === "daily"}
              key={category}
            >
              <h4>{serviceCategoryLabels[category]}</h4>
              {category === "daily" && (
                <div className="price-editor-speed-head">
                  <span>Harga satuan</span>
                  {serviceSpeeds.map((speed) => (
                    <span key={speed.id}>{speed.label}</span>
                  ))}
                </div>
              )}
              {group.map((service) => (
                <div className="price-editor-row" key={service.id}>
                  <span className="price-editor-name">
                    <b>{service.name}</b>
                    <small>
                      {service.packageSize
                        ? `per ${service.packageSize} kg · minimum ${service.minimumQuantity} kg`
                        : `per ${service.unit}${service.minimumQuantity && service.minimumQuantity > 1 ? ` · minimum ${service.minimumQuantity} ${service.unit}` : ""}`}
                    </small>
                  </span>
                  {service.rates ? (
                    serviceSpeeds.filter((speed) => serviceAvailableSpeeds(service).includes(speed.id)).map((speed) => (
                      <label className="price-editor-input" key={speed.id}>
                        <span
                          className="price-editor-speed-label"
                          aria-hidden="true"
                        >
                          {speed.label}
                        </span>
                        <span className="sr-only">
                          {service.name}, {speed.label}
                        </span>
                        <input
                          aria-label={`${service.name}, ${speed.label}`}
                          name={`${service.id}.${speed.id}`}
                          type="number"
                          required
                          min={1000}
                          max={10000000}
                          step={1000}
                          defaultValue={serviceRate(service, speed.id)}
                        />
                      </label>
                    ))
                  ) : (
                    <label className="price-editor-input price-editor-single">
                      <span className="sr-only">Harga {service.name}</span>
                      <input
                        aria-label={`Harga ${service.name}`}
                        name={service.id}
                        type="number"
                        required
                        min={1000}
                        max={10000000}
                        step={1000}
                        defaultValue={service.price}
                      />
                    </label>
                  )}
                </div>
              ))}
            </section>
          );
        })}
      </div>
      <button disabled={busy} className="primary">
        Simpan harga
      </button>
      {msg && <p role="status">{msg}</p>}
    </form>
  );
}
function PromoEditor({
  store,
  save,
}: {
  store: Store;
  save: (data: unknown) => Promise<void>;
}) {
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="panel settings-panel"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const f = new FormData(e.currentTarget);
        try {
          await save({
            ...store.promo,
            button: store.promo.button || "Jemput sekarang",
            active: f.get("active") === "on",
          });
          setMsg("Banner berhasil diperbarui di beranda pelanggan.");
        } catch (e) {
          setMsg((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3>Banner utama toko</h3>
      <p className="muted">
        Promosi berlaku untuk toko yang dipilih. Gambar banner dapat diganti di bawah.
      </p>
      <label className="checkbox">
        <input
          name="active"
          type="checkbox"
          defaultChecked={store.promo.active}
        />{" "}
        Tampilkan promosi utama di web toko
      </label>
      <button disabled={busy} className="primary">
        Simpan banner
      </button>
      {msg && <p role="status">{msg}</p>}
    </form>
  );
}
