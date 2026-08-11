const CART_KEY = "shopdemo_cart";

function readCart() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CART_KEY));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

export function getCart() {
  return readCart();
}

export function addToCart(productId, quantity = 1) {
  const cart = readCart();
  const existing = cart.find((item) => item.productId === productId);
  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({ productId, quantity });
  }
  writeCart(cart);
  return cart;
}

export function updateQuantity(productId, quantity) {
  const cart = readCart();
  const item = cart.find((i) => i.productId === productId);
  if (item) {
    item.quantity = Math.max(1, quantity);
    writeCart(cart);
  }
  return cart;
}

export function removeFromCart(productId) {
  const cart = readCart().filter((item) => item.productId !== productId);
  writeCart(cart);
  return cart;
}

export function removeMany(productIds) {
  const idSet = new Set(productIds);
  const cart = readCart().filter((item) => !idSet.has(item.productId));
  writeCart(cart);
  return cart;
}

export function getCartCount() {
  return readCart().length;
}

export function renderCartCountBadge() {
  const el = document.getElementById("cart-count");
  if (el) el.textContent = String(getCartCount());
}

const CHECKOUT_SELECTION_KEY = "shopdemo_checkout_selection";

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
