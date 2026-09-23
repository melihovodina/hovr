// Same-origin calls to the Go API. The session lives in httpOnly cookies, so there is no token here.

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    // "upgrade_required", "domain_not_allowed", "rate_limited"...
    readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }

  get upgradeRequired(): boolean {
    return this.code === "upgrade_required";
  }
}

const NETWORK_ERROR = "Can’t reach hovr right now. Check your connection and try again.";
const UNKNOWN_ERROR = "Something went wrong. Try again.";

type Body = Record<string, unknown> | FormData;

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: Body;
  signal?: AbortSignal;
}

// Sends the request and returns the raw response; failures become an ApiError with the server's message.
export async function request(path: string, { method = "GET", body, signal }: RequestOptions = {}): Promise<Response> {
  const init: RequestInit = { method, credentials: "same-origin", signal };
  if (body instanceof FormData) {
    init.body = body;
  } else if (body) {
    init.body = JSON.stringify(body);
    init.headers = { "Content-Type": "application/json" };
  }

  let res: Response;
  try {
    res = await fetch(`/api${path}`, init);
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError(0, NETWORK_ERROR);
  }
  if (!res.ok) throw await toError(res);
  return res;
}

// JSON endpoints; 204 answers resolve to undefined.
export async function api<T = void>(path: string, options?: RequestOptions): Promise<T> {
  const res = await request(path, options);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

async function toError(res: Response): Promise<ApiError> {
  try {
    const data = (await res.json()) as { error?: string; code?: string };
    return new ApiError(res.status, data.error || UNKNOWN_ERROR, data.code);
  } catch {
    return new ApiError(res.status, UNKNOWN_ERROR);
  }
}

export function errorMessage(err: unknown): string {
  return err instanceof ApiError ? err.message : UNKNOWN_ERROR;
}
