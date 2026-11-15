export const formatMoney = (cents: number) =>
  new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(cents / 100);

export const currentYear = () => String(new Date().getFullYear());

export const validYear = (year: string) =>
  /^\d{4}$/.test(year) && Number(year) >= 1900 && Number(year) <= 9998;

export const stayNights = (checkIn: string, checkOut: string): number | null => {
  const parse = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !validYear(value.slice(0, 4))) return NaN;
    const time = Date.parse(`${value}T00:00:00Z`);
    return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time : NaN;
  };
  const nights = (parse(checkOut) - parse(checkIn)) / 86400000;
  return Number.isSafeInteger(nights) && nights >= 1 ? nights : null;
};

export const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

export const moneyToCents = (value: string): number | null => {
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.replace(",", ".").split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents >= 1 && cents <= 10000000000 ? cents : null;
};

export const signedMoneyToCents = (value: string): number | null => {
  if (!/^-?\d+(?:[.,]\d{1,2})?$/.test(value)) return null;
  const negative = value.startsWith("-");
  const [whole, fraction = ""] = (negative ? value.slice(1) : value).replace(",", ".").split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents <= 10000000000 ? (negative ? -cents : cents) : null;
};
