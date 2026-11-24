import { COUNTRIES } from '@acme/shared';

/** "2400000.00" becomes "2,400,000.00". It works on the text, so the amount is never rounded. */
export function formatAmount(amount: string): string {
  const [whole = '', decimals] = amount.split('.');
  const wholeWithCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return decimals === undefined ? wholeWithCommas : `${wholeWithCommas}.${decimals}`;
}

/** An amount is always shown with its currency, for example "2,400,000.00 INR". */
export function formatMoney(amount: string, currency: string): string {
  return `${formatAmount(amount)} ${currency}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2021-04-12" becomes "12 Apr 2021". The text is split, so time zones cannot move the day. */
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${Number(day)} ${MONTHS[Number(month) - 1]} ${year}`;
}

/** "2026-11-01T09:30:00.000Z" becomes "1 Nov 2026, 09:30 UTC". */
export function formatDateTime(timestamp: string): string {
  const date = new Date(timestamp);
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const day = formatDate(date.toISOString().slice(0, 10));
  return `${day}, ${hours}:${minutes} UTC`;
}

/** "IN" becomes "India". An unknown code is shown as it is. */
export function countryName(code: string): string {
  return COUNTRIES.find((country) => country.code === code)?.name ?? code;
}
