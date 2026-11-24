import { formatMoney } from '@/lib/format';

/**
 * Shows an amount of money. Every amount in the app goes through here,
 * so a number is never shown without its currency (for example "95,000.00 USD").
 */
export function MoneyText({ amount, currency }: { amount: string; currency: string }) {
  return <span className="whitespace-nowrap tabular-nums">{formatMoney(amount, currency)}</span>;
}
