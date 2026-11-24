import { describe, expect, it } from 'vitest';
import { FakeEmployeeQueryRepository } from '../../tests/fakeEmployeeQueryRepository.js';
import { MetaService } from './meta.service.js';

const serviceWith = (countries: string[], departments: string[]) =>
  new MetaService(new FakeEmployeeQueryRepository(undefined, countries, departments));

describe('MetaService.filters', () => {
  it('lists only countries that have employees, with name and currency, sorted by name', async () => {
    const options = await serviceWith(['US', 'DE', 'IN'], []).filters();

    expect(options.countries).toEqual([
      { code: 'DE', name: 'Germany', currency: 'EUR' },
      { code: 'IN', name: 'India', currency: 'INR' },
      { code: 'US', name: 'United States', currency: 'USD' },
    ]);
  });

  it('lists each currency once, sorted, for the countries that are present', async () => {
    const options = await serviceWith(['FR', 'DE', 'JP', 'US'], []).filters();

    expect(options.currencies).toEqual(['EUR', 'JPY', 'USD']);
  });

  it('ignores a country code that is not in the reference data', async () => {
    const options = await serviceWith(['IN', 'XX'], []).filters();

    expect(options.countries.map((country) => country.code)).toEqual(['IN']);
  });

  it('sorts departments alphabetically, ignoring letter case', async () => {
    const options = await serviceWith([], ['sales', 'Engineering', 'HR', 'finance']).filters();

    expect(options.departments).toEqual(['Engineering', 'finance', 'HR', 'sales']);
  });

  it('always lists every level and status, even with no employees', async () => {
    const options = await serviceWith([], []).filters();

    expect(options.levels).toEqual(['L1', 'L2', 'L3', 'L4', 'L5', 'L6']);
    expect(options.statuses).toEqual(['ACTIVE', 'INACTIVE']);
    expect(options.countries).toEqual([]);
    expect(options.currencies).toEqual([]);
    expect(options.departments).toEqual([]);
  });

  it('includes the date the USD rates are as of', async () => {
    const options = await serviceWith([], []).filters();

    expect(options.ratesAsOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
