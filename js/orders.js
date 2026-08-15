import { api } from "./api.js";
import { formatKRW, escapeHtml, initHeaderSearch } from "./util.js";
import { refreshCartCountBadge } from "./cart-store.js";
import { requireLogin, renderHeaderAuth } from "./session.js";

const layout = document.getElementById("orders-layout");
const titleEl = document.getElementById("orders-title");

const PAGE_SIZE = 10;

const STATUS_LABELS = { PLACED: "결제 완료" };
const PAYMENT_LABELS = { card: "신용/체크카드", transfer: "무통장입금" };

let currentPage = 0;
/** 펼쳐 둔 주문번호. 상세는 열 때 한 번만 받아 여기에 담아 둔다. */
const expanded = new Map();

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}  ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function summaryTitle(order) {
  if (!order.firstProductName) return "주문 상품";
  return order.itemCount > 1
    ? `${order.firstProductName} 외 ${order.itemCount - 1}건`
    : order.firstProductName;
}

function renderDetail(detail) {
  const items = detail.items
    .map(
      (item) => `
      <li class="checkout-item">
        <div class="checkout-item-thumb">
          <img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.productName)}" onerror="this.style.visibility='hidden'" />
        </div>
        <div class="checkout-item-info">
          <a href="product.html?id=${item.productId}" class="checkout-item-name">${escapeHtml(item.productName)}</a>
        </div>
        <div class="checkout-item-qty">${item.quantity}개</div>
        <div class="checkout-item-price">${formatKRW(item.subtotal)}</div>
      </li>`
    )
    .join("");

  return `
    <ul class="checkout-item-list order-detail-items">${items}</ul>
    <div class="order-detail-info">
      <div class="summary-row"><span>받는사람</span><span>${escapeHtml(detail.recipientName)}</span></div>
      <div class="summary-row"><span>연락처</span><span>${escapeHtml(detail.recipientPhone)}</span></div>
      <div class="summary-row"><span>배송지</span><span>${escapeHtml(`(${detail.zipcode}) ${detail.address1} ${detail.address2}`)}</span></div>
      <div class="summary-row"><span>배송 요청</span><span>${escapeHtml(detail.deliveryRequest)}</span></div>
      <div class="summary-row"><span>결제 수단</span><span>${escapeHtml(PAYMENT_LABELS[detail.paymentMethod] ?? detail.paymentMethod)}</span></div>
    </div>
  `;
}

function renderOrderCard(order) {
  const detail = expanded.get(order.orderNumber);
  const open = expanded.has(order.orderNumber);

  return `
    <li class="order-card">
      <div class="order-card-head">
        <div class="order-card-meta">
          <span class="order-date">${formatDate(order.placedAt)}</span>
          <span class="order-status">${escapeHtml(STATUS_LABELS[order.status] ?? order.status)}</span>
        </div>
        <span class="order-number">주문번호 ${escapeHtml(order.orderNumber)}</span>
      </div>
      <div class="order-card-body">
        <div class="order-card-title">${escapeHtml(summaryTitle(order))}</div>
        <div class="order-card-price">${formatKRW(order.totalPrice)}</div>
        <button type="button" class="btn-outline-sm order-toggle" data-order="${escapeHtml(order.orderNumber)}">
          ${open ? "접기" : "상세 보기"}
        </button>
      </div>
      ${open ? `<div class="order-card-detail">${detail ? renderDetail(detail) : "<p class=\"empty-results\">불러오는 중...</p>"}</div>` : ""}
    </li>
  `;
}

function renderPagination(page) {
  if (page.totalPages <= 1) return "";
  return `
    <div class="pagination" id="orders-pagination">
      <button type="button" data-page="${page.page - 1}" ${page.page === 0 ? "disabled" : ""}>이전</button>
      <span>${page.page + 1} / ${page.totalPages}</span>
      <button type="button" data-page="${page.page + 1}" ${page.page + 1 >= page.totalPages ? "disabled" : ""}>다음</button>
    </div>
  `;
}

let lastPage = null;

function render() {
  if (!lastPage) return;
  titleEl.textContent = `주문 내역(${lastPage.totalElements})`;

  if (lastPage.content.length === 0) {
    layout.innerHTML = `
      <div class="cart-empty">
        <p>주문 내역이 없습니다.</p>
        <a href="index.html" class="btn-outline">쇼핑하러 가기</a>
      </div>
    `;
    return;
  }

  layout.innerHTML = `
    <ul class="order-list">${lastPage.content.map(renderOrderCard).join("")}</ul>
    ${renderPagination(lastPage)}
  `;
}

async function load() {
  layout.innerHTML = `<div class="cart-empty"><p>불러오는 중...</p></div>`;
  try {
    lastPage = await api.orders.list({ page: currentPage, size: PAGE_SIZE });
    render();
  } catch (error) {
    if (error.status !== 401) {
      layout.innerHTML = `<div class="cart-empty"><p>${escapeHtml(error.message)}</p>
        <a href="index.html" class="btn-outline">쇼핑 계속하기</a></div>`;
    }
  }
}

layout.addEventListener("click", async (e) => {
  const pageBtn = e.target.closest("#orders-pagination button[data-page]");
  if (pageBtn && !pageBtn.disabled) {
    currentPage = Number(pageBtn.dataset.page);
    expanded.clear();
    load();
    return;
  }

  const toggle = e.target.closest(".order-toggle");
  if (!toggle) return;

  const orderNumber = toggle.dataset.order;
  if (expanded.has(orderNumber)) {
    expanded.delete(orderNumber);
    render();
    return;
  }

  // 목록에는 요약만 오므로 펼칠 때 한 번만 상세를 받아 둔다.
  expanded.set(orderNumber, null);
  render();
  try {
    expanded.set(orderNumber, await api.orders.detail(orderNumber));
    render();
  } catch (error) {
    expanded.delete(orderNumber);
    render();
    if (error.status !== 401) window.alert(error.message);
  }
});

renderHeaderAuth();
if (requireLogin()) {
  load();
  refreshCartCountBadge();
}
initHeaderSearch();
