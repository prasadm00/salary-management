import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Remove what a test put on the page, so tests do not affect each other.
afterEach(cleanup);

// The browser test environment has no ResizeObserver, which the charts need.
// This stand-in does nothing, so charts draw nothing in tests. Tests read the chart's table instead.
class ResizeObserverStandIn {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverStandIn;
