import { mockProducts } from "../data/products.mock.js";
import { formatKRW, escapeHtml } from "./util.js";
import {
  getCart,
  updateQuantity,
  removeFromCart,
  removeMany,
  renderCartCountBadge,
  setCheckoutSelection,
} from "./cart-store.js";

const layout = document.getElementById("cart-layout");
const titleEl = document.getElementById("cart-title");

let selectedIds = new Set();
let initialized = false;

function getCartWithProducts() {
  return getCart()
    .map((item) => {
      const product = mockProducts.find((p) => p.id === item.productId);
      return product ? { productId: item.productId, quantity: item.quantity, product } : null;
    })
    .filter(Boolean);
}

function renderCartRow(entry) {
  const { product, quantity, productId } = entry;
  const discountPercent = product.originalPrice
    ? Math.round((1 - product.price / product.originalPrice) * 100)
    : null;
  const checked = selectedIds.has(productId);

  return `
    <li class="cart-item">
      <label class="cart-item-check">
        <input type="checkbox" class="item-checkbox" data-id="${productId}" ${checked ? "checked" : ""} />
      </label>
      <a href="product.html?id=${productId}" class="cart-item-thumb">
        <img src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(product.name)}" onerror="this.style.visibility='hidden'" />
      </a>
      <div class="cart-item-info">
        <div class="cart-item-top">
          <a href="product.html?id=${productId}" class="cart-item-name">${escapeHtml(product.name)}</a>
          <button type="button" class="cart-item-delete" data-id="${productId}">삭제</button>
        </div>
        <div class="rating-row">
          <span class="stars">★ ${product.rating.toFixed(1)}</span>
          <span>후기 ${product.reviewCount.toLocaleString("ko-KR")}개</span>
        </div>
        <div class="cart-item-delivery">
          <span class="badge delivery">${escapeHtml(product.deliveryBadge)}</span>
          <span class="delivery-text">${escapeHtml(product.deliveryText)}</span>
        </div>
        ${
          discountPercent
            ? `<div class="discount-line">${discountPercent}%<span class="original-price">${formatKRW(product.originalPrice)}</span></div>`
            : ""
        }
        <div class="cart-item-price">${formatKRW(product.price)}</div>
        <div class="qty-selector cart-qty" data-id="${productId}">
          <button type="button" class="qty-decrease" aria-label="수량 감소">-</button>
          <span class="qty-value">${quantity}</span>
          <button type="button" class="qty-increase" aria-label="수량 증가">+</button>
        </div>
      </div>
    </li>
  `;
}

function renderSummary(selectedEntries) {
  const totalPrice = selectedEntries.reduce((sum, e) => sum + e.product.price * e.quantity, 0);
  const totalDiscount = selectedEntries.reduce((sum, e) => {
    if (!e.product.originalPrice) return sum;
    return sum + (e.product.originalPrice - e.product.price) * e.quantity;
  }, 0);

  return `
    <aside class="cart-summary">
      <h2 class="cart-summary-heading">주문 예상 금액</h2>
      <div class="summary-row"><span>총 상품 가격</span><span>${formatKRW(totalPrice)}</span></div>
      <div class="summary-row"><span>총 즉시할인</span><span class="summary-discount">-${formatKRW(totalDiscount)}</span></div>
      <div class="summary-row"><span>총 배송비</span><span>+0원</span></div>
      <div class="summary-total"><span>${formatKRW(totalPrice)}</span></div>
      <button type="button" class="btn-submit" id="checkout-btn" ${selectedEntries.length === 0 ? "disabled" : ""}>총 ${selectedEntries.length}개 상품 구매하기</button>
    </aside>
  `;
}

function render() {
  const entries = getCartWithProducts();
  titleEl.textContent = `장바구니(${entries.length})`;

  if (entries.length === 0) {
    layout.innerHTML = `
      <div class="cart-empty">
        <p>장바구니가 비어있습니다.</p>
        <a href="index.html" class="btn-outline">쇼핑 계속하기</a>
      </div>
    `;
    renderCartCountBadge();
    return;
  }

  if (!initialized) {
    entries.forEach((e) => selectedIds.add(e.productId));
    initialized = true;
  } else {
    selectedIds = new Set([...selectedIds].filter((id) => entries.some((e) => e.productId === id)));
  }

  const allSelected = entries.every((e) => selectedIds.has(e.productId));
  const selectedEntries = entries.filter((e) => selectedIds.has(e.productId));

  layout.innerHTML = `
    <div class="cart-items-col">
      <ul class="cart-item-list">
        ${entries.map(renderCartRow).join("")}
      </ul>
      <div class="cart-select-row">
        <label class="cart-select-all">
          <input type="checkbox" id="select-all" ${allSelected ? "checked" : ""} />
          <span>전체 선택(${selectedIds.size}/${entries.length})</span>
        </label>
        <button type="button" id="delete-selected-btn">선택삭제</button>
      </div>
    </div>
    ${renderSummary(selectedEntries)}
  `;

  renderCartCountBadge();
}

layout.addEventListener("click", (e) => {
  const deleteBtn = e.target.closest(".cart-item-delete");
  if (deleteBtn) {
    const id = Number(deleteBtn.dataset.id);
    removeFromCart(id);
    selectedIds.delete(id);
    render();
    return;
  }

  if (e.target.closest("#delete-selected-btn")) {
    removeMany([...selectedIds]);
    selectedIds.clear();
    render();
    return;
  }

  const decreaseBtn = e.target.closest(".qty-decrease");
  if (decreaseBtn) {
    const wrapper = decreaseBtn.closest(".cart-qty");
    const id = Number(wrapper.dataset.id);
    const currentQty = Number(wrapper.querySelector(".qty-value").textContent);
    if (currentQty > 1) {
      updateQuantity(id, currentQty - 1);
      render();
    }
    return;
  }

  const increaseBtn = e.target.closest(".qty-increase");
  if (increaseBtn) {
    const wrapper = increaseBtn.closest(".cart-qty");
    const id = Number(wrapper.dataset.id);
    const currentQty = Number(wrapper.querySelector(".qty-value").textContent);
    if (currentQty < 99) {
      updateQuantity(id, currentQty + 1);
      render();
    }
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
    const entries = getCartWithProducts();
    if (selectAll.checked) {
      entries.forEach((entry) => selectedIds.add(entry.productId));
    } else {
      selectedIds.clear();
    }
    render();
  }
});

render();
