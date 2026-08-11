import { mockProducts } from "../data/products.mock.js";
import { formatKRW, escapeHtml, initHeaderSearch } from "./util.js";
import { getLastOrder, renderCartCountBadge } from "./cart-store.js";

const layout = document.getElementById("order-complete-layout");

function renderOrderItem(entry) {
  const { product, quantity } = entry;
  return `
    <li class="checkout-item">
      <div class="checkout-item-thumb">
        <img src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(product.name)}" onerror="this.style.visibility='hidden'" />
      </div>
      <div class="checkout-item-info">
        <div class="checkout-item-name">${escapeHtml(product.name)}</div>
      </div>
      <div class="checkout-item-qty">${quantity}개</div>
      <div class="checkout-item-price">${formatKRW(product.price * quantity)}</div>
    </li>
  `;
}

function render() {
  const order = getLastOrder();

  if (!order) {
    layout.innerHTML = `
      <div class="cart-empty">
        <p>완료된 주문 정보가 없습니다.</p>
        <a href="index.html" class="btn-outline">쇼핑 계속하기</a>
      </div>
    `;
    renderCartCountBadge();
    return;
  }

  const items = order.items
    .map((item) => {
      const product = mockProducts.find((p) => p.id === item.productId);
      return product ? { product, quantity: item.quantity } : null;
    })
    .filter(Boolean);

  layout.innerHTML = `
    <div class="order-complete-card">
      <div class="order-complete-icon">✓</div>
      <h2 class="order-complete-heading">주문이 완료되었습니다</h2>
      <p class="order-complete-sub">주문번호 ${escapeHtml(order.orderNumber)}</p>

      <div class="order-complete-summary">
        <div class="summary-row"><span>결제 금액</span><span>${formatKRW(order.totalPrice)}</span></div>
        <div class="summary-row"><span>결제 수단</span><span>${escapeHtml(order.paymentMethodLabel)}</span></div>
        <div class="summary-row"><span>받는사람</span><span>${escapeHtml(order.recipientName)}</span></div>
        <div class="summary-row"><span>배송지</span><span>${escapeHtml(order.address)}</span></div>
      </div>

      <ul class="checkout-item-list order-complete-items">
        ${items.map(renderOrderItem).join("")}
      </ul>

      <a href="index.html" class="btn-submit order-complete-action">쇼핑 계속하기</a>

      <p class="order-complete-note">이 화면은 데모용으로, 실제 결제 및 주문 처리는 이루어지지 않았습니다.</p>
    </div>
  `;

  renderCartCountBadge();
}

render();
initHeaderSearch();
