/** Format the creation time consistently for customers, including older orders. */
export function formatOrderCreatedAt(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const input = value.trim();
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(input);
  const localDateTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/.test(input);
  const zonedDateTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:?\d{2})$/i.test(input);
  if (!dateOnly && !localDateTime && !zonedDateTime) return null;
  const date = new Date(dateOnly ? `${input}T12:00:00+07:00` : localDateTime ? `${input}+07:00` : input);
  if (!Number.isFinite(date.getTime())) return null;
  const [year, month, day] = input.slice(0, 10).split("-").map(Number);
  const expected = new Date(Date.UTC(year, month - 1, day));
  if (expected.getUTCFullYear() !== year || expected.getUTCMonth() !== month - 1 || expected.getUTCDate() !== day) return null;
  const formatted = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(!dateOnly ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(date);
  // A date-only value contains no reliable time. Avoid inventing one.
  return dateOnly ? formatted : `${formatted} WIB`;
}
