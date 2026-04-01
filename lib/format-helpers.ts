export function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatPrice(value: number) {
  if (value <= 0) return "Free";
  return new Intl.NumberFormat("en-EE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(value);
}

export function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
