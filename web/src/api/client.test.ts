import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiGet, apiSend } from './client';
import { mockFetch, requestedUrls } from '@/tests/testUtils';

afterEach(() => vi.unstubAllGlobals());

describe('apiGet', () => {
  it('asks for the path and returns the JSON answer', async () => {
    mockFetch(() => ({ body: { hello: 'world' } }));

    expect(await apiGet('/api/thing')).toEqual({ hello: 'world' });
  });

  it('adds the parameters to the address', async () => {
    const fake = mockFetch(() => ({ body: {} }));

    await apiGet('/api/employees', { q: 'priya', page: 2 });

    expect(requestedUrls(fake)).toEqual(['/api/employees?q=priya&page=2']);
  });

  it('leaves out empty parameters, so the address stays short', async () => {
    const fake = mockFetch(() => ({ body: {} }));

    await apiGet('/api/employees', { q: '', country: undefined, level: 'L3' });

    expect(requestedUrls(fake)).toEqual(['/api/employees?level=L3']);
  });

  it('writes special characters safely in the address', async () => {
    const fake = mockFetch(() => ({ body: {} }));

    await apiGet('/api/employees', { q: 'a&b=c d' });

    expect(requestedUrls(fake)).toEqual(['/api/employees?q=a%26b%3Dc+d']);
  });
});

describe('apiSend', () => {
  it('sends the body as JSON with the chosen method', async () => {
    const fake = mockFetch(() => ({ body: { id: 1 } }));

    const result = await apiSend('POST', '/api/employees', { fullName: 'Asha' });

    expect(result).toEqual({ id: 1 });
    const [, init] = fake.mock.calls[0] ?? [];
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe('{"fullName":"Asha"}');
    expect(init?.headers).toMatchObject({ 'Content-Type': 'application/json' });
  });
});

describe('errors', () => {
  const errorBody = {
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Some fields are invalid.',
      details: [{ field: 'amount', message: 'Amount must be greater than zero.' }],
      requestId: 'abc-123',
    },
  };

  it('turns the API error format into an ApiError', async () => {
    mockFetch(() => ({ status: 400, body: errorBody }));

    const error = await apiGet('/api/x').catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Some fields are invalid.',
      requestId: 'abc-123',
      details: [{ field: 'amount', message: 'Amount must be greater than zero.' }],
    });
  });

  it('has no field details when the API sent none', async () => {
    mockFetch(() => ({
      status: 404,
      body: { error: { code: 'NOT_FOUND', message: 'Employee not found.' } },
    }));

    const error = (await apiGet('/api/x').catch((caught: unknown) => caught)) as ApiError;

    expect(error.details).toEqual([]);
    expect(error.status).toBe(404);
  });

  it('gives a plain message when the server answers with something that is not our error format', async () => {
    // A sleeping free server often answers with a page of HTML.
    vi.stubGlobal('fetch', () =>
      Promise.resolve(new Response('<html>Bad gateway</html>', { status: 502 })),
    );

    const error = (await apiGet('/api/x').catch((caught: unknown) => caught)) as ApiError;

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(502);
    expect(error.message).toBe('The server did not answer properly. Please try again in a moment.');
  });

  it('tells the user when the server cannot be reached at all', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('Failed to fetch')));

    const error = (await apiGet('/api/x').catch((caught: unknown) => caught)) as ApiError;

    expect(error.code).toBe('NETWORK_ERROR');
    expect(error.message).toBe('Cannot reach the server. Check your connection and try again.');
  });

  it('can say which field an error is about', async () => {
    mockFetch(() => ({ status: 400, body: errorBody }));

    const error = (await apiGet('/api/x').catch((caught: unknown) => caught)) as ApiError;

    expect(error.messageFor('amount')).toBe('Amount must be greater than zero.');
    expect(error.messageFor('reason')).toBeUndefined();
  });
});
