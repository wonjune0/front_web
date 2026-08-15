import { api, ApiError, loginUrl } from "./api.js";
import { formatKRW, escapeHtml, getQueryParam, initHeaderSearch } from "./util.js";
import { refreshCartCountBadge, setCartCountBadge, setCheckoutSelection } from "./cart-store.js";
import { isLoggedIn, renderHeaderAuth } from "./session.js";

const breadcrumb = document.getElementById("breadcrumb");
const layout = document.getElementById("detail-layout");
const tabsSection = document.getElementById("detail-tabs-section");

// Reviews and Q&A are still generated client-side -- the backend exposes no endpoint
// for either, so the product's own rating/reviewCount are used to fabricate a plausible
// tab rather than leaving the section empty.
const REVIEW_NICKNAMES = ["김**", "이**", "박**", "최**", "정**", "우**"];
const REVIEW_TEMPLATES = [
  (name) => `${name} 가격 대비 만족스럽게 잘 쓰고 있어요. 재구매 의사 있습니다.`,
  () => `배송도 빠르고 상품 상태도 좋았습니다. 추천해요.`,
  () => `생각보다 품질이 좋아서 놀랐어요. 주변에도 추천하고 싶네요.`,
  (name) => `${name} 설명대로 잘 왔고 사용감도 무난합니다.`,
];

const QNA_TEMPLATES = [
  { question: "빠른 배송 가능한가요?", answer: "네, 오후 2시 이전 결제 완료 시 당일 출고됩니다." },
  { question: "재고 있나요?", answer: "네, 현재 재고 보유 중입니다." },
  { question: "구성품에 사용 설명서도 포함되나요?", answer: null },
];

const SHIPPING_POLICY_TEXT = `
  <p><strong>배송 안내</strong><br />
  기본 배송비는 무료이며, 결제 완료 후 평균 1~3일 이내 출고됩니다. 도서산간 지역은 추가
  배송비 및 배송기간이 발생할 수 있습니다.</p>
  <p><strong>교환/반품 안내</strong><br />
  상품 수령 후 7일 이내 단순 변심에 의한 교환/반품이 가능합니다(왕복 배송비 구매자 부담).
  상품 하자 또는 오배송의 경우 배송비 없이 교환/반품이 가능합니다. 사용하였거나 상품 가치가
  훼손된 경우 교환/반품이 제한될 수 있습니다.</p>
  <p><strong>문의</strong><br />
  주문/배송 관련 문의는 상품문의 탭을 이용해주세요.</p>
`;

function buildImageVariants(baseUrl, suffixes) {
  const match = baseUrl.match(/seed\/([^/]+)\//);
  const seed = match ? match[1] : "product";
  return suffixes.map((s) => `https://picsum.photos/seed/${seed}${s}/500/500`);
}

function formatDateOffset(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function generateMockReviews(product) {
  const baseRating = Math.round(product.rating);
  return REVIEW_TEMPLATES.map((template, i) => ({
    nickname: REVIEW_NICKNAMES[(product.id + i) % REVIEW_NICKNAMES.length],
    rating: i === REVIEW_TEMPLATES.length - 1 ? Math.max(1, baseRating - 1) : baseRating,
    date: formatDateOffset((i + 1) * 6),
    content: template(product.name.split(",")[0]),
  }));
}

function generateMockQna(product) {
  return QNA_TEMPLATES.map((qna, i) => ({
    ...qna,
    date: formatDateOffset((i + 1) * 4),
  }));
}

function showToast(message) {
  const toast = document.getElementById("cart-toast");
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    toast.hidden = true;
  }, 1500);
}

function renderDetailPanel(product) {
  const images = buildImageVariants(product.imageUrl, ["-detail1", "-detail2"]);
  return `
    <p class="detail-description-text">${escapeHtml(product.detailDescription)}</p>
    <div class="detail-description-images">
      ${images
        .map(
          (url) =>
            `<img src="${url}" alt="상세 이미지" onerror="this.style.visibility='hidden'" />`
        )
        .join("")}
    </div>
  `;
}

function renderReviewPanel(product) {
  const reviews = generateMockReviews(product);
  return `
    <div class="review-list">
      ${reviews
        .map(
          (r) => `
        <div class="review-card">
          <div class="review-header">
            <span class="review-nickname">${escapeHtml(r.nickname)}</span>
            <span class="stars">${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}</span>
            <span class="review-date">${r.date}</span>
          </div>
          <p class="review-content">${escapeHtml(r.content)}</p>
        </div>`
        )
        .join("")}
    </div>
  `;
}

function renderQnaPanel(product) {
  const qnaList = generateMockQna(product);
  return `
    <div class="qna-list">
      ${qnaList
        .map(
          (q) => `
        <div class="qna-item">
          <div class="qna-question"><span class="qna-tag q">Q</span>${escapeHtml(q.question)}<span class="qna-date">${q.date}</span></div>
          ${
            q.answer
              ? `<div class="qna-answer"><span class="qna-tag a">A</span>${escapeHtml(q.answer)}</div>`
              : `<div class="qna-answer pending">답변 대기중입니다.</div>`
          }
        </div>`
        )
        .join("")}
    </div>
  `;
}

function renderTabsSection(product) {
  const tabs = [
    { key: "detail", label: "상품상세" },
    { key: "review", label: `상품평 (${product.reviewCount.toLocaleString("ko-KR")})` },
    { key: "qna", label: "상품문의" },
    { key: "shipping", label: "배송/교환/반품 안내" },
  ];

  const panels = {
    detail: renderDetailPanel(product),
    review: renderReviewPanel(product),
    qna: renderQnaPanel(product),
    shipping: SHIPPING_POLICY_TEXT,
  };

  tabsSection.innerHTML = `
    <div class="detail-tabs-inner">
      <div class="detail-tabs" id="detail-tabs">
        ${tabs
          .map(
            (t, i) =>
              `<button type="button" class="tab-btn ${i === 0 ? "active" : ""}" data-tab="${t.key}">${escapeHtml(t.label)}</button>`
          )
          .join("")}
      </div>
      ${tabs
        .map(
          (t) => `
        <section class="tab-panel" id="panel-${t.key}">
          <h2 class="section-heading">${escapeHtml(t.label)}</h2>
          ${panels[t.key]}
        </section>`
        )
        .join("")}
    </div>
  `;

  document.getElementById("detail-tabs").addEventListener("click", (e) => {
    const btn = e.target.closest(".tab-btn");
    if (!btn) return;
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b === btn));
    document
      .getElementById(`panel-${btn.dataset.tab}`)
      .scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function render(product) {
  breadcrumb.innerHTML = `쇼핑 홈 &gt; ${escapeHtml(product.parentCategory)} &gt; ${escapeHtml(product.category)}`;

  const images = buildImageVariants(product.imageUrl, ["", "-2", "-3", "-4"]);
  const discountPercent = product.originalPrice
    ? Math.round((1 - product.price / product.originalPrice) * 100)
    : null;

  layout.innerHTML = `
    <div class="gallery-thumbs" id="gallery-thumbs">
      ${images
        .map(
          (url, i) => `
        <button type="button" class="thumb-btn ${i === 0 ? "active" : ""}" data-src="${url}">
          <img src="${url}" alt="썸네일 ${i + 1}" onerror="this.style.visibility='hidden'" />
        </button>`
        )
        .join("")}
    </div>
    <div class="gallery-main">
      <img id="main-image" src="${images[0]}" alt="${escapeHtml(product.name)}" onerror="this.style.visibility='hidden'" />
    </div>
    <div class="detail-info">
      <h1 class="detail-title">${escapeHtml(product.name)}</h1>
      <div class="rating-row detail-rating">
        <span class="stars">★ ${product.rating.toFixed(1)}</span>
        <span>후기 ${product.reviewCount.toLocaleString("ko-KR")}개</span>
      </div>
      <div class="detail-price-block">
        ${
          discountPercent
            ? `<div class="detail-discount-line"><span class="discount-percent">${discountPercent}%</span><span class="original-price">${formatKRW(product.originalPrice)}</span></div>`
            : ""
        }
        <div class="detail-price">${formatKRW(product.price)}</div>
      </div>
      <div class="qty-row">
        <span>수량</span>
        <div class="qty-selector">
          <button type="button" id="qty-decrease" aria-label="수량 감소">-</button>
          <span id="qty-value">1</span>
          <button type="button" id="qty-increase" aria-label="수량 증가">+</button>
        </div>
      </div>
      <div class="total-row">
        총 상품금액 <strong id="total-price">${formatKRW(product.price)}</strong>
      </div>
      <div class="detail-actions">
        <button type="button" class="btn-cart" id="add-cart-btn">장바구니 담기</button>
        <button type="button" class="btn-buy" id="buy-now-btn">바로구매</button>
      </div>
      <div id="cart-toast" class="cart-toast" hidden></div>
    </div>
  `;

  let quantity = 1;
  const maxQty = 99;
  const qtyValue = document.getElementById("qty-value");
  const totalPrice = document.getElementById("total-price");

  function updateQuantityDisplay() {
    qtyValue.textContent = String(quantity);
    totalPrice.textContent = formatKRW(product.price * quantity);
  }

  document.getElementById("qty-decrease").addEventListener("click", () => {
    if (quantity > 1) {
      quantity -= 1;
      updateQuantityDisplay();
    }
  });

  document.getElementById("qty-increase").addEventListener("click", () => {
    if (quantity < maxQty) {
      quantity += 1;
      updateQuantityDisplay();
    }
  });

  document.getElementById("gallery-thumbs").addEventListener("click", (e) => {
    const btn = e.target.closest(".thumb-btn");
    if (!btn) return;
    document.getElementById("main-image").src = btn.dataset.src;
    document
      .querySelectorAll(".thumb-btn")
      .forEach((b) => b.classList.toggle("active", b === btn));
  });

  // The cart lives on the server, so both buttons need a session. Sending the user to
  // log in with a redirect back here keeps the product they were looking at.
  async function addCurrentSelectionToCart(button) {
    if (!isLoggedIn()) {
      window.location.href = loginUrl(`product.html?id=${product.id}`);
      return false;
    }
    button.disabled = true;
    try {
      const cart = await api.cart.addItem(product.id, quantity);
      setCartCountBadge(cart.items.length);
      return true;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return false;
      showToast(error.message);
      return false;
    } finally {
      button.disabled = false;
    }
  }

  document.getElementById("add-cart-btn").addEventListener("click", async (e) => {
    if (await addCurrentSelectionToCart(e.currentTarget)) {
      showToast("장바구니에 담았습니다");
    }
  });

  // 바로구매는 장바구니에 담되 결제 화면에서 이 상품만 선택된 상태로 넘어간다.
  // 카트에 다른 상품이 있어도 함께 결제되지 않는다.
  document.getElementById("buy-now-btn").addEventListener("click", async (e) => {
    if (await addCurrentSelectionToCart(e.currentTarget)) {
      setCheckoutSelection([product.id]);
      window.location.href = "checkout.html";
    }
  });

  renderTabsSection(product);
}

async function load() {
  const id = Number(getQueryParam("id"));
  if (!Number.isInteger(id) || id <= 0) {
    layout.innerHTML = `<p style="padding: 40px 20px;">상품을 찾을 수 없습니다.</p>`;
    return;
  }

  layout.innerHTML = `<p style="padding: 40px 20px;">불러오는 중...</p>`;
  try {
    render(await api.products.detail(id));
  } catch (error) {
    const message = error.status === 404 ? "상품을 찾을 수 없습니다." : error.message;
    layout.innerHTML = `<p style="padding: 40px 20px;">${escapeHtml(message)}</p>`;
  }
}

load();
renderHeaderAuth();
refreshCartCountBadge();
initHeaderSearch();
