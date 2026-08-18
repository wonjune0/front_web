import { getToken, clearSession } from "./session.js";

/**
 * In production CloudFront serves this site and routes /api/* to the backend under the
 * same domain, so a relative base is correct and no CORS is involved. Point
 * window.__API_BASE__ at a local backend to develop against one (the backend's local
 * profile allows localhost origins).
 */
const API_BASE = window.__API_BASE__ ?? "";

export class ApiError extends Error {
  constructor(status, message, fieldErrors) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors ?? [];
  }
}

export function loginUrl(returnTo = window.location.pathname + window.location.search) {
  return `login.html?redirect=${encodeURIComponent(returnTo)}`;
}

/**
 * The backend answers errors in two shapes: the security entry point writes a bare
 * {message}, while GlobalExceptionHandler writes {timestamp,status,error,message,path,
 * fieldErrors}. Both carry `message`, so one read covers them, and anything unparseable
 * falls back to the status line.
 */
async function toApiError(response) {
  let message = `요청에 실패했습니다 (${response.status})`;
  let fieldErrors = [];
  try {
    const body = await response.json();
    if (body?.message) message = body.message;
    if (Array.isArray(body?.fieldErrors)) fieldErrors = body.fieldErrors;
  } catch {
    // non-JSON body (e.g. a proxy error page) -- keep the default message
  }
  return new ApiError(response.status, message, fieldErrors);
}

async function request(path, { method = "GET", body, auth = false, headers: extraHeaders } = {}) {
  const headers = { ...extraHeaders };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = getToken();
    if (!token) {
      window.location.href = loginUrl();
      throw new ApiError(401, "로그인이 필요합니다");
    }
    headers.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (cause) {
    throw new ApiError(0, "서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.", []);
  }

  // An expired or revoked token looks the same as never having had one; drop it and
  // send the user to log in rather than leaving the page half-rendered.
  if (response.status === 401 && auth) {
    clearSession();
    window.location.href = loginUrl();
    throw new ApiError(401, "로그인이 필요합니다");
  }

  if (!response.ok) throw await toApiError(response);
  if (response.status === 204) return null;
  return response.json();
}

function query(params) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== "") search.set(key, value);
  });
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export const api = {
  categories: {
    list: () => request("/api/categories"),
  },
  products: {
    list: (params = {}) => request(`/api/products${query(params)}`),
    detail: (id) => request(`/api/products/${id}`),
  },
  auth: {
    signup: (body) => request("/api/auth/signup", { method: "POST", body }),
    login: (body) => request("/api/auth/login", { method: "POST", body }),
    me: () => request("/api/auth/me", { auth: true }),
  },
  cart: {
    get: () => request("/api/cart", { auth: true }),
    addItem: (productId, quantity) =>
      request("/api/cart/items", { method: "POST", body: { productId, quantity }, auth: true }),
    updateItem: (productId, quantity) =>
      request(`/api/cart/items/${productId}`, { method: "PATCH", body: { quantity }, auth: true }),
    removeItem: (productId) =>
      request(`/api/cart/items/${productId}`, { method: "DELETE", auth: true }),
    clear: () => request("/api/cart", { method: "DELETE", auth: true }),
  },
  orders: {
    /**
     * The idempotency key is what makes a retry safe: if the first attempt reached the
     * server but the answer never came back, resending the same key returns that attempt's
     * outcome instead of charging again. forceFailure is a demo switch and is ignored by
     * the server unless the environment explicitly enables it.
     */
    create: (body, { idempotencyKey, forceFailure = false } = {}) =>
      request("/api/orders", {
        method: "POST",
        body,
        auth: true,
        headers: {
          ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
          ...(forceFailure ? { "X-Force-Payment-Failure": "true" } : {}),
        },
      }),
    list: (params = {}) => request(`/api/orders${query(params)}`, { auth: true }),
    detail: (orderNumber) => request(`/api/orders/${orderNumber}`, { auth: true }),
    cancel: (orderNumber) =>
      request(`/api/orders/${orderNumber}/cancel`, { method: "POST", auth: true }),
  },
};
