import { describe, expect, it } from 'vitest';
import { countryName, formatAmount, formatDate, formatDateTime, formatMoney } from './format';

describe('formatAmount', () => {
  it.each([
    ['0.10', '0.10'],
    ['999.99', '999.99'],
    ['1000.00', '1,000.00'],
    ['95000.50', '95,000.50'],
    ['2400000.00', '2,400,000.00'],
    ['999999999999.99', '999,999,999,999.99'],
  ])('formats %s as %s', (amount, shown) => {
    expect(formatAmount(amount)).toBe(shown);
  });

  it('works on the text, so it never rounds', () => {
    expect(formatAmount('0.10')).toBe('0.10');
    expect(formatAmount('1234567.89')).toBe('1,234,567.89');
  });

  it('handles an amount without decimals', () => {
    expect(formatAmount('1500')).toBe('1,500');
  });
});

describe('formatMoney', () => {
  it('always shows the currency, so a number is never shown on its own', () => {
    expect(formatMoney('2400000.00', 'INR')).toBe('2,400,000.00 INR');
    expect(formatMoney('95000.00', 'USD')).toBe('95,000.00 USD');
  });
});

describe('formatDate', () => {
  it('shows a day, short month and year', () => {
    expect(formatDate('2021-04-12')).toBe('12 Apr 2021');
  });

  it('does not move the day because of the time zone', () => {
    expect(formatDate('2021-01-01')).toBe('1 Jan 2021');
    expect(formatDate('2021-12-31')).toBe('31 Dec 2021');
  });
});

describe('formatDateTime', () => {
  it('shows the date and the time in UTC', () => {
    expect(formatDateTime('2026-11-01T09:30:00.000Z')).toBe('1 Nov 2026, 09:30 UTC');
  });
});

describe('countryName', () => {
  it('turns a country code into its name', () => {
    expect(countryName('IN')).toBe('India');
    expect(countryName('US')).toBe('United States');
  });

  it('falls back to the code for a country it does not know', () => {
    expect(countryName('ZZ')).toBe('ZZ');
  });
});
