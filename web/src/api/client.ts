/** One problem with one input field, as sent by the API. */
export interface FieldDetail {
  field: string;
  message: string;
}

/** An error answered by the API, or a failure to reach it. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: FieldDetail[] = [],
    /** Quote this when asking for help. It matches a line in the server log. */
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** The message for one input field, if the API had one. */
  messageFor(field: string): string | undefined {
    return this.details.find((detail) => detail.field === field)?.message;
  }
}

type Params = Record<string, string | number | undefined>;

/** Reads data. Empty parameters are left out of the address. */
export function apiGet<T>(path: string, params: Params = {}): Promise<T> {
  const query = new URLSearchParams();
  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') query.set(name, String(value));
  }
  const queryText = query.toString();
  return request<T>(queryText ? `${path}?${queryText}` : path);
}

/** Creates or changes data. The body is sent as JSON. */
export function apiSend<T>(method: 'POST' | 'PATCH', path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function request<T>(address: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(address, init);
  } catch {
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      'Cannot reach the server. Check your connection and try again.',
    );
  }

  if (!response.ok) throw await toApiError(response);
  return (await response.json()) as T;
}

async function toApiError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as {
      error: { code: string; message: string; details?: FieldDetail[]; requestId?: string };
    };
    const { code, message, details, requestId } = body.error;
    return new ApiError(response.status, code, message, details, requestId);
  } catch {
    // Not our error format. A sleeping free server often answers with a page of HTML.
    return new ApiError(
      response.status,
      'BAD_RESPONSE',
      'The server did not answer properly. Please try again in a moment.',
    );
  }
}
