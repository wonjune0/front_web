import { api } from "./api.js";
import { formatKRW, escapeHtml, initHeaderSearch } from "./util.js";
import { setCartCountBadge, setCheckoutSelection } from "./cart-store.js";
import { requireLogin, renderHeaderAuth } from "./session.js";

const layout = document.getElementById("cart-layout");
const titleEl = document.getElementById("cart-title");

/**
 * The server cart is the only source of truth: every mutation sends a request and redraws
 * from the response, so the page can never disagree with what checkout will order. Ticked
 * rows are the one piece of state kept locally, since selection is not persisted server-side.
 */
let items = [];
let selectedIds = new Set();
let initialized = false;

function renderCartRow(item) {
  const discountPercent = item.originalPrice
    ? Math.round((1 - item.price / item.originalPrice) * 100)
    : null;
  const checked = selectedIds.has(item.productId);

  return `
    <li class="cart-item">
      <label class="cart-item-check">
        <input type="checkbox" class="item-checkbox" data-id="${item.productId}" ${checked ? "checked" : ""} />
      </label>
      <a href="product.html?id=${item.productId}" class="cart-item-thumb">
        <img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.name)}" onerror="this.style.visibility='hidden'" />
      </a>
      <div class="cart-item-info">
        <div class="cart-item-top">
          <a href="product.html?id=${item.productId}" class="cart-item-name">${escapeHtml(item.name)}</a>
          <button type="button" class="cart-item-delete" data-id="${item.productId}">삭제</button>
        </div>
        <div class="rating-row">
          <span class="stars">★ ${item.rating.toFixed(1)}</span>
          <span>후기 ${item.reviewCount.toLocaleString("ko-KR")}개</span>
        </div>
        <div class="cart-item-delivery">
          <span class="badge delivery">${escapeHtml(item.deliveryBadge)}</span>
          <span class="delivery-text">${escapeHtml(item.deliveryText)}</span>
        </div>
        ${
          discountPercent
            ? `<div class="discount-line">${discountPercent}%<span class="original-price">${formatKRW(item.originalPrice)}</span></div>`
            : ""
        }
        <div class="cart-item-price">${formatKRW(item.price)}</div>
        <div class="qty-selector cart-qty" data-id="${item.productId}">
          <button type="button" class="qty-decrease" aria-label="수량 감소">-</button>
          <span class="qty-value">${item.quantity}</span>
          <button type="button" class="qty-increase" aria-label="수량 증가">+</button>
        </div>
      </div>
    </li>
  `;
}

function renderSummary(selectedItems) {
  const totalPrice = selectedItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const totalDiscount = selectedItems.reduce((sum, item) => {
    if (!item.originalPrice) return sum;
    return sum + (item.originalPrice - item.price) * item.quantity;
  }, 0);

  return `
    <aside class="cart-summary">
      <h2 class="cart-summary-heading">주문 예상 금액</h2>
      <div class="summary-row"><span>총 상품 가격</span><span>${formatKRW(totalPrice)}</span></div>
      <div class="summary-row"><span>총 즉시할인</span><span class="summary-discount">-${formatKRW(totalDiscount)}</span></div>
      <div class="summary-row"><span>총 배송비</span><span>+0원</span></div>
      <div class="summary-total"><span>${formatKRW(totalPrice)}</span></div>
      <button type="button" class="btn-submit" id="checkout-btn" ${selectedItems.length === 0 ? "disabled" : ""}>총 ${selectedItems.length}개 상품 구매하기</button>
    </aside>
  `;
}

function render() {
  titleEl.textContent = `장바구니(${items.length})`;
  setCartCountBadge(items.length);

  if (items.length === 0) {
    layout.innerHTML = `
      <div class="cart-empty">
        <p>장바구니가 비어있습니다.</p>
        <a href="index.html" class="btn-outline">쇼핑 계속하기</a>
      </div>
    `;
    return;
  }

  if (!initialized) {
    items.forEach((item) => selectedIds.add(item.productId));
    initialized = true;
  } else {
    selectedIds = new Set(
      [...selectedIds].filter((id) => items.some((item) => item.productId === id))
    );
  }

  const allSelected = items.every((item) => selectedIds.has(item.productId));
  const selectedItems = items.filter((item) => selectedIds.has(item.productId));

  layout.innerHTML = `
    <div class="cart-items-col">
      <ul class="cart-item-list">
        ${items.map(renderCartRow).join("")}
      </ul>
      <div class="cart-select-row">
        <label class="cart-select-all">
          <input type="checkbox" id="select-all" ${allSelected ? "checked" : ""} />
          <span>전체 선택(${selectedIds.size}/${items.length})</span>
        </label>
        <button type="button" id="delete-selected-btn">선택삭제</button>
      </div>
    </div>
    ${renderSummary(selectedItems)}
  `;
}

function showError(message) {
  layout.innerHTML = `<div class="cart-empty"><p>${escapeHtml(message)}</p>
    <a href="index.html" class="btn-outline">쇼핑 계속하기</a></div>`;
}

/** Applies a cart mutation and redraws from whatever the server says the cart now is. */
async function mutate(action) {
  layout.setAttribute("aria-busy", "true");
  try {
    items = (await action()).items;
    render();
  } catch (error) {
    if (error.status !== 401) window.alert(error.message);
  } finally {
    layout.removeAttribute("aria-busy");
  }
}

layout.addEventListener("click", (e) => {
  const deleteBtn = e.target.closest(".cart-item-delete");
  if (deleteBtn) {
    const id = Number(deleteBtn.dataset.id);
    selectedIds.delete(id);
    mutate(() => api.cart.removeItem(id));
    return;
  }

  if (e.target.closest("#delete-selected-btn")) {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    selectedIds.clear();
    mutate(async () => {
      let cart;
      for (const id of ids) cart = await api.cart.removeItem(id);
      return cart;
    });
    return;
  }

  const decreaseBtn = e.target.closest(".qty-decrease");
  if (decreaseBtn) {
    const wrapper = decreaseBtn.closest(".cart-qty");
    const id = Number(wrapper.dataset.id);
    const currentQty = Number(wrapper.querySelector(".qty-value").textContent);
    if (currentQty > 1) mutate(() => api.cart.updateItem(id, currentQty - 1));
    return;
  }

  const increaseBtn = e.target.closest(".qty-increase");
  if (increaseBtn) {
    const wrapper = increaseBtn.closest(".cart-qty");
    const id = Number(wrapper.dataset.id);
    const currentQty = Number(wrapper.querySelector(".qty-value").textContent);
    if (currentQty < 99) mutate(() => api.cart.updateItem(id, currentQty + 1));
    return;
  }

  if (e.target.closest("#checkout-btn")) {
    setCheckoutSelection([...selectedIds]);
    window.location.href = "checkout.html";
  }
});

layout.addEventListener("change", (e) => {
  const itemCheckbox = e.target.closest(".item-checkbox");
  if (itemCheckbox) {
    const id = Number(itemCheckbox.dataset.id);
    if (itemCheckbox.checked) selectedIds.add(id);
    else selectedIds.delete(id);
    render();
    return;
  }

  const selectAll = e.target.closest("#select-all");
  if (selectAll) {
    if (selectAll.checked) items.forEach((item) => selectedIds.add(item.productId));
    else selectedIds.clear();
    render();
  }
});

async function load() {
  layout.innerHTML = `<div class="cart-empty"><p>불러오는 중...</p></div>`;
  try {
    items = (await api.cart.get()).items;
    render();
  } catch (error) {
    if (error.status !== 401) showError(error.message);
  }
}

renderHeaderAuth();
if (requireLogin()) {
  load();
}
initHeaderSearch();
