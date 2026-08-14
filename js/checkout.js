import { api } from "./api.js";
import { formatKRW, escapeHtml, initHeaderSearch } from "./util.js";
import {
  getCheckoutSelection,
  clearCheckoutSelection,
  setCartCountBadge,
  setLastOrderNumber,
} from "./cart-store.js";
import { requireLogin, renderHeaderAuth } from "./session.js";

const layout = document.getElementById("checkout-layout");

const PHONE_REGEX = /^01[0-9]-?\d{3,4}-?\d{4}$/;

/**
 * Rows the buyer ticked on the cart page. The same ids go to POST /api/orders so the
 * server orders exactly what this page priced -- and it rejects the request outright if
 * any of them are no longer in the cart.
 */
let entries = [];
let selectedProductIds = null;

function loadEntries(cartItems) {
  const selection = getCheckoutSelection();
  const ids = selection && selection.length > 0 ? new Set(selection) : null;
  const chosen = ids ? cartItems.filter((item) => ids.has(item.productId)) : cartItems;
  // Send exactly what this page priced. A selection can go stale -- another tab may have
  // emptied the cart since -- and an id the cart no longer holds is rejected outright.
  selectedProductIds = ids ? chosen.map((item) => item.productId) : null;
  return chosen;
}

function renderOrderItem(item) {
  return `
    <li class="checkout-item">
      <div class="checkout-item-thumb">
        <img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.name)}" onerror="this.style.visibility='hidden'" />
      </div>
      <div class="checkout-item-info">
        <div class="checkout-item-name">${escapeHtml(item.name)}</div>
        <div class="cart-item-delivery">
          <span class="badge delivery">${escapeHtml(item.deliveryBadge)}</span>
          <span class="delivery-text">${escapeHtml(item.deliveryText)}</span>
        </div>
      </div>
      <div class="checkout-item-qty">${item.quantity}개</div>
      <div class="checkout-item-price">${formatKRW(item.lineTotal)}</div>
    </li>
  `;
}

function renderSummary(orderItems) {
  const totalPrice = orderItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const totalDiscount = orderItems.reduce((sum, item) => {
    if (!item.originalPrice) return sum;
    return sum + (item.originalPrice - item.price) * item.quantity;
  }, 0);

  return `
    <aside class="cart-summary checkout-summary">
      <h2 class="cart-summary-heading">최종 결제 금액</h2>
      <div class="summary-row"><span>총 상품 가격</span><span>${formatKRW(totalPrice)}</span></div>
      <div class="summary-row"><span>즉시할인</span><span class="summary-discount">-${formatKRW(totalDiscount)}</span></div>
      <div class="summary-row"><span>배송비</span><span>0원</span></div>
      <div class="summary-total"><span>${formatKRW(totalPrice)}</span></div>

      <label class="checkout-consent">
        <input type="checkbox" id="checkout-consent" />
        <span>위 주문 내용을 확인하였으며 결제에 동의합니다</span>
      </label>
      <p class="field-error" id="error-consent" hidden></p>

      <button type="button" class="btn-submit" id="pay-btn">결제하기</button>
    </aside>
  `;
}

function render() {
  if (entries.length === 0) {
    layout.innerHTML = `
      <div class="cart-empty">
        <p>주문할 상품이 없습니다.</p>
        <a href="cart.html" class="btn-outline">장바구니로 이동</a>
      </div>
    `;
    return;
  }

  layout.innerHTML = `
    <div class="checkout-main-col">
      <section class="checkout-section">
        <h2 class="section-heading">배송지</h2>
        <div class="address-form">
          <div class="form-row">
            <input type="text" id="recipient-name" class="text-input" placeholder="받는사람" />
            <input type="text" id="recipient-phone" class="text-input" placeholder="연락처 ('-' 없이 숫자만 입력)" />
          </div>
          <div class="form-row address-row">
            <input type="text" id="zipcode" class="text-input" placeholder="우편번호" readonly />
            <button type="button" id="address-search-btn" class="btn-outline-sm">주소 검색</button>
          </div>
          <input type="text" id="address1" class="text-input" placeholder="주소 검색을 통해 입력해주세요" readonly />
          <input type="text" id="address2" class="text-input" placeholder="상세주소를 입력해주세요" />
          <p class="field-error" id="error-address" hidden></p>
        </div>
      </section>

      <section class="checkout-section">
        <h2 class="section-heading">배송 요청사항</h2>
        <select id="delivery-request" class="page-size">
          <option value="문 앞에 놓아주세요">문 앞에 놓아주세요</option>
          <option value="직접 받을게요">직접 받을게요</option>
          <option value="경비실에 맡겨주세요">경비실에 맡겨주세요</option>
          <option value="배송 전 연락해주세요">배송 전 연락해주세요</option>
        </select>
      </section>

      <section class="checkout-section">
        <h2 class="section-heading">주문 상품</h2>
        <ul class="checkout-item-list">
          ${entries.map(renderOrderItem).join("")}
        </ul>
      </section>

      <section class="checkout-section">
        <h2 class="section-heading">결제수단</h2>
        <div class="payment-methods">
          <label class="payment-method-option">
            <input type="radio" name="payment-method" value="card" checked />
            <span class="payment-method-label">신용/체크카드</span>
            <span class="payment-method-detail">신한카드 1234-****-****-5678 (등록된 카드)</span>
          </label>
          <label class="payment-method-option">
            <input type="radio" name="payment-method" value="transfer" />
            <span class="payment-method-label">무통장입금</span>
            <span class="payment-method-detail">주문 완료 후 입금 계좌를 안내해드립니다</span>
          </label>
        </div>
      </section>
    </div>

    ${renderSummary(entries)}
  `;
}

function setError(el, message) {
  el.textContent = message ?? "";
  el.hidden = !message;
}

function validateAddress() {
  const name = document.getElementById("recipient-name").value.trim();
  const phone = document.getElementById("recipient-phone").value.trim();
  const address1 = document.getElementById("address1").value.trim();
  const address2 = document.getElementById("address2").value.trim();
  const errorEl = document.getElementById("error-address");

  if (!name || !phone || !address1 || !address2) {
    setError(errorEl, "받는사람, 연락처, 주소를 모두 입력해주세요.");
    return false;
  }
  if (!PHONE_REGEX.test(phone)) {
    setError(errorEl, "연락처 형식이 올바르지 않습니다.");
    return false;
  }
  setError(errorEl, null);
  return true;
}

function validateConsent() {
  const consent = document.getElementById("checkout-consent");
  const errorEl = document.getElementById("error-consent");
  if (!consent.checked) {
    setError(errorEl, "주문 내용 확인 및 결제 동의가 필요합니다.");
    return false;
  }
  setError(errorEl, null);
  return true;
}

layout.addEventListener("click", (e) => {
  if (e.target.closest("#address-search-btn")) {
    if (typeof daum === "undefined" || !daum.Postcode) {
      alert("주소 검색 스크립트를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
      return;
    }
    new daum.Postcode({
      oncomplete(data) {
        document.getElementById("zipcode").value = data.zonecode;
        document.getElementById("address1").value = data.roadAddress;
        document.getElementById("address2").focus();
      },
    }).open();
    return;
  }

  if (e.target.closest("#pay-btn")) {
    placeOrder(e.target.closest("#pay-btn"));
  }
});

/**
 * The server generates the order number, prices the items from its own product rows and
 * clears the ordered lines from the cart, so nothing here is computed for the record --
 * only the order number is carried forward, and the completion page re-fetches the rest.
 */
async function placeOrder(button) {
  const addressOk = validateAddress();
  const consentOk = validateConsent();
  if (!addressOk || !consentOk) return;

  button.disabled = true;
  try {
    const order = await api.orders.create({
      productIds: selectedProductIds ?? undefined,
      recipientName: document.getElementById("recipient-name").value.trim(),
      recipientPhone: document.getElementById("recipient-phone").value.trim(),
      zipcode: document.getElementById("zipcode").value.trim(),
      address1: document.getElementById("address1").value.trim(),
      address2: document.getElementById("address2").value.trim(),
      deliveryRequest: document.getElementById("delivery-request").value,
      paymentMethod: document.querySelector('input[name="payment-method"]:checked').value,
    });

    setLastOrderNumber(order.orderNumber);
    clearCheckoutSelection();
    window.location.href = "order-complete.html";
  } catch (error) {
    if (error.status !== 401) {
      setError(document.getElementById("error-consent"), error.message);
    }
  } finally {
    button.disabled = false;
  }
}

async function load() {
  layout.innerHTML = `<div class="cart-empty"><p>불러오는 중...</p></div>`;
  try {
    const cart = await api.cart.get();
    setCartCountBadge(cart.items.length);
    entries = loadEntries(cart.items);
    render();
  } catch (error) {
    if (error.status !== 401) {
      layout.innerHTML = `<div class="cart-empty"><p>${escapeHtml(error.message)}</p>
        <a href="cart.html" class="btn-outline">장바구니로 이동</a></div>`;
    }
  }
}

renderHeaderAuth();
if (requireLogin()) {
  load();
}
initHeaderSearch();
