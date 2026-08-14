import { api } from "./api.js";
import { formatKRW, escapeHtml, initHeaderSearch } from "./util.js";
import { getLastOrderNumber, refreshCartCountBadge } from "./cart-store.js";
import { requireLogin, renderHeaderAuth } from "./session.js";

const layout = document.getElementById("order-complete-layout");

const PAYMENT_METHOD_LABELS = {
  card: "신용/체크카드 (신한카드 1234-****-****-5678)",
  transfer: "무통장입금",
};

function renderOrderItem(item) {
  return `
    <li class="checkout-item">
      <div class="checkout-item-thumb">
        <img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.productName)}" onerror="this.style.visibility='hidden'" />
      </div>
      <div class="checkout-item-info">
        <div class="checkout-item-name">${escapeHtml(item.productName)}</div>
      </div>
      <div class="checkout-item-qty">${item.quantity}개</div>
      <div class="checkout-item-price">${formatKRW(item.subtotal)}</div>
    </li>
  `;
}

function renderEmpty(message) {
  layout.innerHTML = `
    <div class="cart-empty">
      <p>${escapeHtml(message)}</p>
      <a href="index.html" class="btn-outline">쇼핑 계속하기</a>
    </div>
  `;
}

function render(order) {
  layout.innerHTML = `
    <div class="order-complete-card">
      <div class="order-complete-icon">✓</div>
      <h2 class="order-complete-heading">주문이 완료되었습니다</h2>
      <p class="order-complete-sub">주문번호 ${escapeHtml(order.orderNumber)}</p>

      <div class="order-complete-summary">
        <div class="summary-row"><span>결제 금액</span><span>${formatKRW(order.totalPrice)}</span></div>
        <div class="summary-row"><span>결제 수단</span><span>${escapeHtml(PAYMENT_METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod)}</span></div>
        <div class="summary-row"><span>받는사람</span><span>${escapeHtml(order.recipientName)}</span></div>
        <div class="summary-row"><span>배송지</span><span>${escapeHtml(`${order.address1} ${order.address2}`)}</span></div>
      </div>

      <ul class="checkout-item-list order-complete-items">
        ${order.items.map(renderOrderItem).join("")}
      </ul>

      <a href="index.html" class="btn-submit order-complete-action">쇼핑 계속하기</a>

      <p class="order-complete-note">이 화면은 데모용으로, 실제 결제 및 주문 처리는 이루어지지 않았습니다.</p>
    </div>
  `;
}

/**
 * Only the order number is held in session storage -- the order itself is re-fetched, so
 * a refresh still shows it and every figure on screen is the one the server recorded.
 */
async function load() {
  const orderNumber = getLastOrderNumber();
  if (!orderNumber) {
    renderEmpty("완료된 주문 정보가 없습니다.");
    return;
  }

  layout.innerHTML = `<div class="cart-empty"><p>불러오는 중...</p></div>`;
  try {
    render(await api.orders.detail(orderNumber));
  } catch (error) {
    if (error.status === 404) renderEmpty("완료된 주문 정보가 없습니다.");
    else if (error.status !== 401) renderEmpty(error.message);
  }
}

renderHeaderAuth();
if (requireLogin()) {
  load();
  refreshCartCountBadge();
}
initHeaderSearch();
