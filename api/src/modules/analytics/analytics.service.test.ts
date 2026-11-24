import { beforeEach, describe, expect, it } from 'vitest';
import { ValidationError } from '../../errors/appErrors.js';
import { FakeAnalyticsRepository } from '../../tests/fakeAnalyticsRepository.js';
import {
  analyticsFilterSchema,
  distributionQuerySchema,
  extremesQuerySchema,
} from './analytics.schema.js';
import { AnalyticsService } from './analytics.service.js';
import type { StatsRowData } from './analytics.repository.js';

let repository: FakeAnalyticsRepository;
let service: AnalyticsService;

beforeEach(() => {
  repository = new FakeAnalyticsRepository();
  service = new AnalyticsService(repository);
});

const filters = (params: Record<string, string> = {}) => analyticsFilterSchema.parse(params);

const statsRow = (overrides: Partial<StatsRowData> = {}): StatsRowData => ({
  key: null,
  currency: 'INR',
  headcount: 3,
  min: '1.00',
  max: '3.00',
  average: '2.00',
  median: '2.00',
  p25: '1.00',
  p75: '3.00',
  ...overrides,
});

describe('AnalyticsService.summary', () => {
  it('returns the headcount and one group per currency, without the internal key', async () => {
    repository.headcount = 7;
    repository.stats = [statsRow({ currency: 'EUR' }), statsRow({ currency: 'INR' })];

    const result = await service.summary(filters());

    expect(result).toEqual({
      view: 'local',
      headcount: 7,
      groups: [
        {
          currency: 'EUR',
          headcount: 3,
          min: '1.00',
          max: '3.00',
          average: '2.00',
          median: '2.00',
          p25: '1.00',
          p75: '3.00',
        },
        {
          currency: 'INR',
          headcount: 3,
          min: '1.00',
          max: '3.00',
          average: '2.00',
          median: '2.00',
          p25: '1.00',
          p75: '3.00',
        },
      ],
    });
  });

  it('asks the database for ungrouped stats with the filters it was given', async () => {
    await service.summary(filters({ country: 'IN', status: 'ALL' }));

    expect(repository.lastGroupBy).toBe('none');
    expect(repository.lastFilters).toEqual({ country: 'IN', status: 'ALL', view: 'local' });
  });

  it('does not label the local view, because nothing is converted', async () => {
    const result = await service.summary(filters());

    expect(result).not.toHaveProperty('ratesAsOf');
    expect(result).not.toHaveProperty('ratesNote');
  });

  it('labels the USD view with the date of the rates and a plain warning (US-13)', async () => {
    const result = await service.summary(filters({ view: 'usd' }));

    expect(result).toMatchObject({
      view: 'usd',
      ratesAsOf: '2026-01-01',
      ratesNote: 'Fixed, illustrative exchange rates. Not live market data.',
    });
  });
});

describe('AnalyticsService.byGroup', () => {
  it('returns rows with their key and reports what they are grouped by', async () => {
    repository.headcount = 5;
    repository.stats = [statsRow({ key: 'IN' }), statsRow({ key: 'US', currency: 'USD' })];

    const result = await service.byGroup('country', filters());

    expect(result.groupBy).toBe('country');
    expect(result.headcount).toBe(5);
    expect(result.rows.map((row) => [row.key, row.currency])).toEqual([
      ['IN', 'INR'],
      ['US', 'USD'],
    ]);
    expect(repository.lastGroupBy).toBe('country');
  });

  it.each(['country', 'department', 'level'] as const)(
    'passes %s to the database',
    async (groupBy) => {
      await service.byGroup(groupBy, filters());

      expect(repository.lastGroupBy).toBe(groupBy);
    },
  );

  it('labels the USD view', async () => {
    const result = await service.byGroup('level', filters({ view: 'usd' }));

    expect(result.ratesAsOf).toBe('2026-01-01');
  });
});

describe('AnalyticsService.distribution', () => {
  const query = (params: Record<string, string>) => distributionQuerySchema.parse(params);

  it('needs a currency in the local view, and does not touch the database without one', async () => {
    const attempt = service.distribution(query({}));

    await expect(attempt).rejects.toThrowError(ValidationError);
    await expect(attempt).rejects.toMatchObject({
      details: [{ field: 'currency', message: 'Currency is required in the local view.' }],
    });
    expect(repository.calls).toEqual([]);
  });

  it('passes the currency and bucket count to the database', async () => {
    repository.distributionResult = {
      headcount: 3,
      min: '1.00',
      max: '9.00',
      buckets: [{ from: '1.00', to: '9.00', count: 3 }],
    };

    const result = await service.distribution(query({ currency: 'INR', buckets: '8' }));

    expect(repository.lastCurrency).toBe('INR');
    expect(repository.lastBuckets).toBe(8);
    expect(result).toEqual({
      view: 'local',
      currency: 'INR',
      headcount: 3,
      min: '1.00',
      max: '9.00',
      buckets: [{ from: '1.00', to: '9.00', count: 3 }],
    });
  });

  it('in the USD view needs no currency, reports USD, and ignores one that was sent', async () => {
    const result = await service.distribution(query({ view: 'usd', currency: 'INR' }));

    expect(repository.lastCurrency).toBeUndefined();
    expect(result).toMatchObject({ view: 'usd', currency: 'USD', ratesAsOf: '2026-01-01' });
  });
});

describe('AnalyticsService.extremes', () => {
  const query = (params: Record<string, string>) => extremesQuerySchema.parse(params);

  it('needs a currency in the local view', async () => {
    await expect(service.extremes(query({}))).rejects.toMatchObject({
      details: [{ field: 'currency', message: 'Currency is required in the local view.' }],
    });
    expect(repository.calls).toEqual([]);
  });

  it('returns the top and bottom lists the database found', async () => {
    const person = {
      id: 1,
      employeeCode: 'EMP-000001',
      fullName: 'Asha Rao',
      department: 'Engineering',
      level: 'L3',
      country: 'IN',
      amount: '10.00',
    };
    repository.extremesResult = { top: [person], bottom: [{ ...person, id: 2 }] };

    const result = await service.extremes(query({ currency: 'INR', limit: '3' }));

    expect(repository.lastLimit).toBe(3);
    expect(result).toEqual({
      view: 'local',
      currency: 'INR',
      top: [person],
      bottom: [{ ...person, id: 2 }],
    });
  });

  it('in the USD view reports USD and the date of the rates', async () => {
    const result = await service.extremes(query({ view: 'usd' }));

    expect(result).toMatchObject({ view: 'usd', currency: 'USD', ratesAsOf: '2026-01-01' });
    expect(repository.lastCurrency).toBeUndefined();
  });
});

describe('AnalyticsService.recentChanges', () => {
  it('returns the changes the database found, wrapped in data', async () => {
    repository.recent = [
      {
        id: 4,
        employee: { id: 1, employeeCode: 'EMP-000001', fullName: 'Asha Rao' },
        oldAmount: '1.00',
        newAmount: '2.00',
        currency: 'INR',
        reason: 'Review',
        changedAt: '2026-11-01T09:00:00.000Z',
      },
    ];

    const result = await service.recentChanges(5);

    expect(result.data).toHaveLength(1);
    expect(repository.lastLimit).toBe(5);
  });
});
