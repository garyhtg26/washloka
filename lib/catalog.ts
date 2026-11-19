import { catalogServices } from "./defaults";
import { buzzwashServices } from "./buzzwash-catalog";
import { brandCopy } from "./brand-copy";
import type { Service, ServiceSpeed } from "./types";

export const serviceSpeeds: Array<{
  id: ServiceSpeed;
  label: string;
  days: string;
}> = [
  { id: "regular", label: "Reguler", days: "3 hari" },
  { id: "oneDay", label: "One Day", days: "1 hari" },
  { id: "express", label: "Express", days: "6-8 jam" },
  { id: "quick", label: "Quick", days: "3 jam" },
];

export const serviceCategoryLabels = {
  daily: "Daily Kiloan",
  household: "Household (Satuan)",
  premium: "Premium (Satuan)",
  additional: "Tambahan / Additional",
  member: "Membership",
} as const;

export const serviceCategoryOrder = [
  "daily",
  "household",
  "premium",
  "additional",
  "member",
] as const;

export function serviceRate(service: Service, speed: ServiceSpeed = "regular") {
  return service.rates?.[speed] ?? service.price;
}

export function serviceUnitRate(
  service: Service,
  speed: ServiceSpeed = "regular",
) {
  if (service.pricingModel === "flat-package") return serviceRate(service, speed);
  return serviceRate(service, speed) / (service.packageSize || 1);
}

export function serviceTotal(
  service: Service,
  quantity: number,
  speed: ServiceSpeed = "regular",
) {
  if (service.pricingModel === "flat-package") return serviceRate(service, speed);
  const billable = Math.max(service.minimumQuantity || 1, quantity);
  return Math.round(billable * serviceUnitRate(service, speed));
}

export function serviceAvailableSpeeds(service: Service): ServiceSpeed[] {
  return service.availableSpeeds ?? (service.rates ? serviceSpeeds.map(({ id }) => id) : ["regular"]);
}

export function defaultSpeed(service: Service): ServiceSpeed {
  return serviceAvailableSpeeds(service)[0] ?? "regular";
}

// An empty list means that no turnaround was published. "regular" is a
// neutral internal value only; the UI must show "Dikonfirmasi toko".
export function serviceAllowsSpeed(service: Service, speed: ServiceSpeed) {
  const speeds = serviceAvailableSpeeds(service);
  return speeds.length ? speeds.includes(speed) : speed === "regular";
}

export function catalogForBranch(branch?: string): Service[] {
  return branch === "buzzwash" ? buzzwashServices : catalogServices;
}

export function normalizeServices(value: unknown, branch?: string): Service[] {
  const catalog = catalogForBranch(branch);
  if (!Array.isArray(value)) return catalog;
  const current = value as Partial<Service>[];
  const storedIds = new Set(current.map((service) => service.id));
  const isCurrentCatalog =
    current.length === catalog.length &&
    catalog.every((service) => storedIds.has(service.id)) &&
    current.every(
      (service) =>
        typeof service.category === "string" &&
        typeof service.price === "number" &&
        Number.isSafeInteger(service.price),
    );
  if (!isCurrentCatalog) return catalog;

  const byId = new Map(current.map((service) => [service.id, service]));
  return catalog.map((service) => {
    const stored = byId.get(service.id);
    return {
      ...service,
      ...stored,
      name: brandCopy(stored?.name, service.name),
      description: brandCopy(stored?.description, service.description),
      ...(service.rates
        ? { rates: { ...service.rates, ...stored?.rates } }
        : {}),
    } as Service;
  });
}

export function unitLabel(unit?: string) {
  if (unit === "kg") return "kg";
  if (unit === "pcs") return "pcs";
  if (unit === "set") return "set";
  if (unit === "bulan") return "bulan";
  return unit || "kg";
}

export function speedLabel(speed?: ServiceSpeed, express?: boolean) {
  if (speed)
    return (
      serviceSpeeds.find((option) => option.id === speed)?.label || "Reguler"
    );
  return express ? "Express" : "Reguler";
}
