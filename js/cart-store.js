import { api } from "./api.js";
import { isLoggedIn } from "./session.js";

/**
 * The cart itself lives on the server (/api/cart) and is not mirrored here -- this module
 * only holds the two pieces of throwaway UI state that never needed to be persisted
 * server-side, plus the header badge.
 */

const CHECKOUT_SELECTION_KEY = "shopdemo_checkout_selection";
const LAST_ORDER_KEY = "shopdemo_last_order_number";

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
