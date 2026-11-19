export type ServiceSpeed = "regular" | "oneDay" | "express" | "quick";
export type ServiceCategory =
  "daily" | "household" | "premium" | "additional" | "member";
export type Service = {
  id: string;
  name: string;
  description: string;
  price: number;
  unit: string;
  days: string;
  icon: string;
  category: ServiceCategory;
  rates?: Partial<Record<ServiceSpeed, number>>;
  minimumQuantity?: number;
  maximumQuantity?: number;
  packageSize?: number;
  pricingModel?: "flat-package";
  availableSpeeds?: ServiceSpeed[];
  startingAt?: boolean;
};
export type Order = {
  id: string;
  token: string;
  uid: string | null;
  branchId: string;
  name: string;
  phone: string;
  service: string;
  unit?: string;
  speed?: ServiceSpeed;
  pricingVersion?: 2;
  minimumQuantity?: number;
  maximumQuantity?: number;
  pricingModel?: "flat-package";
  startingAt?: boolean;
  pricePending?: boolean;
  /** Customer has not supplied a quantity; the store will weigh/count it. */
  quantityPending?: boolean;
  fulfillment?: "delivery" | "dropoff";
  kg: number;
  actualKg: number | null;
  express: boolean;
  address: string;
  lat: number;
  lng: number;
  date: string;
  slot: string;
  notes: string;
  photo: string;
  photoPath?: string;
  status: number;
  paid: boolean;
  paidAt?: string;
  paymentMethod?: "cash" | "points" | "membership";
  posPayment?: "later" | "cash" | "transfer";
  payment?: import("./payments/types").PaymentSummary;
  paymentReconciliationRequired?: boolean;
  manualPayment?: import("./payments/manual-types").ManualPaymentSummary;
  paymentRevision?: number;
  shippingFee: number | null;
  total: number;
  pointsUsed?: number;
  pointsEarned?: number;
  usePoints?: boolean;
  useMembershipBalance?: boolean;
  pointsLimit?: number;
  membershipLimit?: number;
  rewardsAppliedAt?: string;
  rewardsReservedAt?: string;
  insurance?: boolean;
  membershipDiscount?: boolean;
  membershipUsed?: number;
  unitPrice: number;
  washPrice: number;
  source: "web" | "pos";
  createdAt: string;
  history: { status: number; at: string }[];
};
export type CustomerProfile = { name: string; phone: string; email?: string };
export type Store = {
  branchId?: import("./branches").BranchId;
  content?: import("./site-content").SiteContent;
  services: Service[];
  orders: Order[];
  promo: {
    title: string;
    description: string;
    code: string;
    active: boolean;
    button?: string;
  };
  configured?: boolean;
  isAdmin?: boolean;
  allowedBranches?: import("./branches").BranchId[];
  canManageUsers?: boolean;
  role?: "owner" | "admin" | "staff" | "customer";
  profile?: CustomerProfile;
  hasMore?: boolean;
  paymentEnabled?: boolean;
  orderingEnabled?: boolean;
  bank?: import("./payments/manual-types").BankDetails;
};
export type TrackingOrder = Pick<
  Order,
  | "id"
  | "service"
  | "unit"
  | "speed"
  | "pricingVersion"
  | "minimumQuantity"
  | "maximumQuantity"
  | "pricingModel"
  | "startingAt"
  | "pricePending"
  | "quantityPending"
  | "fulfillment"
  | "kg"
  | "actualKg"
  | "express"
  | "status"
  | "paid"
  | "payment"
  | "paymentReconciliationRequired"
  | "manualPayment"
  | "branchId"
  | "total"
  | "pointsUsed"
  | "pointsEarned"
  | "rewardsReservedAt"
  | "insurance"
  | "membershipDiscount"
  | "membershipUsed"
  | "shippingFee"
  | "date"
  | "slot"
  | "history"
  | "createdAt"
> & { source?: Order["source"]; guest?: boolean };
export const statuses = [
  "Menunggu konfirmasi",
  "Dijadwalkan jemput",
  "Dalam penjemputan",
  "Ditimbang di toko",
  "Sedang dicuci",
  "Finishing & quality check",
  "Dalam pengantaran",
  "Selesai",
];
export const money = (v: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(v);
