import type { FilterOptions } from '@acme/shared';
import { apiGet } from './client';

/** The choices for the filter dropdowns, taken from the data. */
export const getFilterOptions = () => apiGet<FilterOptions>('/api/meta/filters');
