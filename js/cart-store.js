import { api } from "./api.js";
import { isLoggedIn } from "./session.js";

/**
 * The cart itself lives on the server (/api/cart) and is not mirrored here -- this module
 * only holds the two pieces of throwaway UI state that never needed to be persisted
 * server-side, plus the header badge.
 */

const CHECKOUT_SELECTION_KEY = "shopdemo_checkout_selection";
const LAST_ORDER_KEY = "shopdemo_last_order_number";
const IDEMPOTENCY_KEY = "shopdemo_checkout_idempotency_key";

export function setCheckoutSelection(productIds) {
  sessionStorage.setItem(CHECKOUT_SELECTION_KEY, JSON.stringify(productIds));
}

export function getCheckoutSelection() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(CHECKOUT_SELECTION_KEY));
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function clearCheckoutSelection() {
  sessionStorage.removeItem(CHECKOUT_SELECTION_KEY);
}

/**
 * Only the order number is kept; the completion page re-fetches the order so a refresh
 * still shows it and every number on screen comes from the server.
 */
export function setLastOrderNumber(orderNumber) {
  sessionStorage.setItem(LAST_ORDER_KEY, orderNumber);
}

export function getLastOrderNumber() {
  return sessionStorage.getItem(LAST_ORDER_KEY);
}

function randomKey() {
  // randomUUID needs a secure context; the fallback keeps a plain-http dev server working.
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `k-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * One key per checkout attempt, held in sessionStorage so it survives a reload of the
 * payment page. That is the case it exists for: if the response is lost -- a refresh
 * mid-request, a dropped connection, a double click -- resending the same key makes the
 * server return the original attempt rather than placing a second order.
 */
export function getCheckoutIdempotencyKey() {
  let key = sessionStorage.getItem(IDEMPOTENCY_KEY);
  if (!key) {
    key = randomKey();
    sessionStorage.setItem(IDEMPOTENCY_KEY, key);
  }
  return key;
}

/**
 * Call this once an attempt has an answer -- paid or declined. A declined attempt is
 * recorded against its key, so reusing it would replay the same decline forever; a
 * genuine retry has to be a new attempt. Never rotate after an error that leaves the
 * outcome unknown, which is exactly when the old key still has work to do.
 */
export function rotateCheckoutIdempotencyKey() {
  sessionStorage.removeItem(IDEMPOTENCY_KEY);
}

export function setCartCountBadge(count) {
  const el = document.getElementById("cart-count");
  if (el) el.textContent = String(count);
}

export async function refreshCartCountBadge() {
  if (!isLoggedIn()) {
    setCartCountBadge(0);
    return;
  }
  try {
    const cart = await api.cart.get();
    setCartCountBadge(cart.items.length);
  } catch {
    // The badge is decoration; a failure here must not break the page it sits on.
    setCartCountBadge(0);
  }
}
