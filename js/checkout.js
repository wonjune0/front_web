import { api } from "./api.js";
import { formatKRW, escapeHtml, initHeaderSearch } from "./util.js";
import {
  getCheckoutSelection,
  clearCheckoutSelection,
  setCartCountBadge,
  setLastOrderNumber,
  getCheckoutIdempotencyKey,
  rotateCheckoutIdempotencyKey,
} from "./cart-store.js";
import { requireLogin, renderHeaderAuth } from "./session.js";

const layout = document.getElementById("checkout-layout");

// 결제 진행 오버레이는 body에 붙인다. layout은 재렌더될 때마다 통째로 갈아끼워지므로
// 그 안에 두면 결제 도중에 사라진다.
const payOverlay = document.createElement("div");
payOverlay.className = "pay-overlay";
payOverlay.id = "pay-overlay";
payOverlay.hidden = true;
payOverlay.innerHTML = `
  <div class="pay-overlay-card">
    <div class="pay-spinner" aria-hidden="true"></div>
    <p class="pay-overlay-title">결제를 진행하고 있습니다</p>
    <p class="pay-overlay-note">창을 닫거나 새로고침하지 마세요</p>
  </div>
`;
document.body.appendChild(payOverlay);

const PHONE_REGEX = /^01[0-9]-?\d{3,4}-?\d{4}$/;

// 결제 실패 화면을 촬영해야 해서 남겨 둔 스위치. ?demo=1 일 때만 노출되고,
// 서버도 운영 환경에서는 이 헤더를 무시한다.
const DEMO_MODE = new URLSearchParams(window.location.search).get("demo") === "1";

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
      ${shortfallNotice(item)}
    </li>
  `;
}

/**
 * The cart carries the stock it last saw, so a line that can no longer be filled is
 * called out before the buyer presses pay. This is a courtesy, not a guarantee -- the
 * quantity can still go out from under us between here and the server's decrement, which
 * is why that decrement is the check that actually decides.
 */
function shortfallNotice(item) {
  if (item.stockQuantity === undefined || item.stockQuantity === null) return "";
  if (item.stockQuantity >= item.quantity) return "";
  const message = item.stockQuantity === 0
    ? "품절된 상품입니다"
    : `재고가 ${item.stockQuantity}개 남아 주문할 수 없습니다`;
  return `<p class="checkout-item-warning">${escapeHtml(message)}</p>`;
}

function hasShortfall() {
  return entries.some(
    (item) => item.stockQuantity !== undefined
      && item.stockQuantity !== null
      && item.stockQuantity < item.quantity
  );
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

      ${
        DEMO_MODE
          ? `<label class="checkout-consent demo-toggle">
               <input type="checkbox" id="force-failure" />
               <span>결제 실패 시뮬레이션</span>
             </label>`
          : ""
      }

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
    placeOrder();
  }
});

function setProcessing(on) {
  document.getElementById("pay-overlay").hidden = !on;
  const button = document.getElementById("pay-btn");
  if (button) button.disabled = on;
}

/**
 * The server generates the order number, prices the items from its own product rows and
 * clears the ordered lines from the cart, so nothing here is computed for the record --
 * only the order number is carried forward, and the completion page re-fetches the rest.
 *
 * Payment takes long enough to see, so the button locks behind an overlay for the
 * duration. That is presentation, not protection: the guarantee that a second press
 * cannot buy twice is the idempotency key, which holds even if this page is reloaded
 * mid-request.
 */
async function placeOrder() {
  const errorEl = document.getElementById("error-consent");
  const addressOk = validateAddress();
  const consentOk = validateConsent();
  if (!addressOk || !consentOk) return;

  if (hasShortfall()) {
    setError(errorEl, "재고가 부족한 상품이 있습니다. 장바구니에서 수량을 조정해주세요.");
    return;
  }

  setProcessing(true);
  try {
    const order = await api.orders.create(
      {
        productIds: selectedProductIds ?? undefined,
        recipientName: document.getElementById("recipient-name").value.trim(),
        recipientPhone: document.getElementById("recipient-phone").value.trim(),
        zipcode: document.getElementById("zipcode").value.trim(),
        address1: document.getElementById("address1").value.trim(),
        address2: document.getElementById("address2").value.trim(),
        deliveryRequest: document.getElementById("delivery-request").value,
        paymentMethod: document.querySelector('input[name="payment-method"]:checked').value,
      },
      {
        idempotencyKey: getCheckoutIdempotencyKey(),
        forceFailure: document.getElementById("force-failure")?.checked ?? false,
      }
    );

    // This attempt is settled, so the next checkout must not reuse its key.
    rotateCheckoutIdempotencyKey();
    setLastOrderNumber(order.orderNumber);
    clearCheckoutSelection();
    window.location.href = "order-complete.html";
  } catch (error) {
    handleCheckoutError(error, errorEl);
  } finally {
    setProcessing(false);
  }
}

/**
 * Three failures that look alike to the user and are not alike at all to the key.
 */
function handleCheckoutError(error, errorEl) {
  // api.js already redirects to login on 401.
  if (error.status === 401) return;

  if (error.status === 402) {
    // Declined. The attempt is recorded as failed and its stock is already back, so a
    // retry has to be a new attempt -- reusing the key would just replay this decline.
    rotateCheckoutIdempotencyKey();
    setError(errorEl, `${error.message} 다시 시도해주세요.`);
    return;
  }

  if (error.status === 409) {
    // Someone else took the last of it, or an earlier attempt is still in flight. Either
    // way the cart is worth re-reading before the buyer presses again.
    setError(errorEl, error.message);
    load();
    return;
  }

  if (error.status === 0) {
    // The request may or may not have reached the server. Keeping the key is the whole
    // point: pressing again returns the original outcome instead of ordering twice.
    setError(errorEl, "결제 결과를 확인하지 못했습니다. 다시 결제하기를 눌러주세요.");
    return;
  }

  setError(errorEl, error.message);
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
