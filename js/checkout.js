import { mockProducts } from "../data/products.mock.js";
import { formatKRW, escapeHtml } from "./util.js";
import { getCart, getCheckoutSelection, renderCartCountBadge, removeMany, setLastOrder } from "./cart-store.js";

const layout = document.getElementById("checkout-layout");

const PHONE_REGEX = /^01[0-9]-?\d{3,4}-?\d{4}$/;

function getOrderEntries() {
  const cart = getCart();
  const selection = getCheckoutSelection();
  const ids = selection && selection.length > 0 ? new Set(selection) : new Set(cart.map((item) => item.productId));

  return cart
    .filter((item) => ids.has(item.productId))
    .map((item) => {
      const product = mockProducts.find((p) => p.id === item.productId);
      return product ? { productId: item.productId, quantity: item.quantity, product } : null;
    })
    .filter(Boolean);
}

function renderOrderItem(entry) {
  const { product, quantity } = entry;
  return `
    <li class="checkout-item">
      <div class="checkout-item-thumb">
        <img src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(product.name)}" onerror="this.style.visibility='hidden'" />
      </div>
      <div class="checkout-item-info">
        <div class="checkout-item-name">${escapeHtml(product.name)}</div>
        <div class="cart-item-delivery">
          <span class="badge delivery">${escapeHtml(product.deliveryBadge)}</span>
          <span class="delivery-text">${escapeHtml(product.deliveryText)}</span>
        </div>
      </div>
      <div class="checkout-item-qty">${quantity}개</div>
      <div class="checkout-item-price">${formatKRW(product.price * quantity)}</div>
    </li>
  `;
}

function renderSummary(entries) {
  const totalPrice = entries.reduce((sum, e) => sum + e.product.price * e.quantity, 0);
  const totalDiscount = entries.reduce((sum, e) => {
    if (!e.product.originalPrice) return sum;
    return sum + (e.product.originalPrice - e.product.price) * e.quantity;
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

function generateOrderNumber() {
  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const randomPart = Math.floor(100000 + Math.random() * 900000);
  return `${datePart}-${randomPart}`;
}

function render() {
  const entries = getOrderEntries();

  if (entries.length === 0) {
    layout.innerHTML = `
      <div class="cart-empty">
        <p>주문할 상품이 없습니다.</p>
        <a href="cart.html" class="btn-outline">장바구니로 이동</a>
      </div>
    `;
    renderCartCountBadge();
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

  renderCartCountBadge();
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
    const addressOk = validateAddress();
    const consentOk = validateConsent();
    if (!addressOk || !consentOk) return;

    const entries = getOrderEntries();
    const totalPrice = entries.reduce((sum, entry) => sum + entry.product.price * entry.quantity, 0);
    const paymentMethod = document.querySelector('input[name="payment-method"]:checked').value;
    const paymentMethodLabel =
      paymentMethod === "card" ? "신용/체크카드 (신한카드 1234-****-****-5678)" : "무통장입금";
    const address1 = document.getElementById("address1").value.trim();
    const address2 = document.getElementById("address2").value.trim();

    setLastOrder({
      orderNumber: generateOrderNumber(),
      placedAt: new Date().toISOString(),
      items: entries.map((entry) => ({ productId: entry.productId, quantity: entry.quantity })),
      totalPrice,
      recipientName: document.getElementById("recipient-name").value.trim(),
      address: `${address1} ${address2}`,
      paymentMethodLabel,
    });
    removeMany(entries.map((entry) => entry.productId));
    window.location.href = "order-complete.html";
  }
});

render();
