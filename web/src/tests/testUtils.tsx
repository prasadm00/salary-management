import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import axe from 'axe-core';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router';
import { vi } from 'vitest';

/** Shows a page the way the real app does: with data loading and routing, starting at `route`. */
export function renderWithProviders(ui: ReactElement, route = '/') {
  // Tests do not retry failed calls, so an error shows up straight away.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

export interface FakeReply {
  status?: number;
  body: unknown;
}

/**
 * Replaces the browser's fetch with a fake. `answer` decides the reply for each call,
 * so a test can say "when the page asks for /api/employees, reply with this".
 * The returned function remembers every call, so a test can check what the page asked for.
 */
export function mockFetch(answer: (url: URL, init: RequestInit) => FakeReply) {
  const fake = vi.fn((input: string, init: RequestInit = {}) => {
    const reply = answer(new URL(input, 'http://localhost'), init);
    return Promise.resolve(
      new Response(JSON.stringify(reply.body), {
        status: reply.status ?? 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });
  vi.stubGlobal('fetch', fake);
  return fake;
}

/** The addresses (path and query) that the page asked for, in order. */
export function requestedUrls(fake: ReturnType<typeof mockFetch>): string[] {
  return fake.mock.calls.map(([input]) => input);
}

/** The query parameters of one address, as a plain object. */
export function paramsOf(address: string): Record<string, string> {
  return Object.fromEntries(new URL(address, 'http://localhost').searchParams);
}

/**
 * Runs the axe accessibility checker on the page and returns the problems it finds (an empty list is good).
 * Colour contrast is skipped here, because the test environment has no real screen to measure.
 * Contrast is checked in a real browser instead. The "landmark" rules are skipped because the
 * pages are tested without the app frame (menu and main area) around them.
 */
export async function findAccessibilityProblems(): Promise<string[]> {
  const results = await axe.run(document.body, {
    rules: {
      'color-contrast': { enabled: false },
      region: { enabled: false },
      'landmark-one-main': { enabled: false },
      'page-has-heading-one': { enabled: false },
    },
  });
  return results.violations.map(
    (violation) => `${violation.id}: ${violation.help} (${violation.nodes.length})`,
  );
}

/** The JSON that the page sent in a request, as an object. Undefined when nothing was sent. */
export function sentJson(init: RequestInit | undefined): unknown {
  return typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
}
