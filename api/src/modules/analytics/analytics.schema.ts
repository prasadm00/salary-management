import { z } from 'zod';
import {
  countryField,
  currencyField,
  departmentField,
  levelField,
  viewField,
} from '../../validation/filterFields.js';
import { wholeNumber } from '../../validation/wholeNumber.js';

/**
 * ACTIVE (the default) counts only people who work here now, INACTIVE only people who left,
 * and ALL counts everyone (R-40).
 */
const statusField = z
  .enum(['ACTIVE', 'INACTIVE', 'ALL'], { error: 'Status must be ACTIVE, INACTIVE or ALL.' })
  .default('ACTIVE');

/** The filters every analytics endpoint takes (docs/API.md section 1.4). */
const filterShape = {
  country: countryField,
  department: departmentField,
  level: levelField,
  status: statusField,
  view: viewField,
};

const limitField = wholeNumber('Limit must be a whole number from 1 to 25.', 1, 25).default(10);

/** Query string of /summary and /by-country, /by-department, /by-level. Unknown parameters are refused. */
export const analyticsFilterSchema = z.strictObject(filterShape);
export type AnalyticsFilters = z.output<typeof analyticsFilterSchema>;

/** Query string of /distribution: the shared filters, a currency and the number of buckets. */
export const distributionQuerySchema = z.strictObject({
  ...filterShape,
  /** Needed in the local view. A histogram cannot mix rupees and dollars. */
  currency: currencyField,
  buckets: wholeNumber('Buckets must be a whole number from 5 to 30.', 5, 30).default(10),
});
export type DistributionQuery = z.output<typeof distributionQuerySchema>;

/** Query string of /extremes: the shared filters, a currency and how many people to list. */
export const extremesQuerySchema = z.strictObject({
  ...filterShape,
  currency: currencyField,
  limit: limitField,
});
export type ExtremesQuery = z.output<typeof extremesQuerySchema>;

/** Query string of /recent-changes. It takes only a limit, and no filters. */
export const recentChangesQuerySchema = z.strictObject({ limit: limitField });
