import { api } from "./api.js";
import { formatKRW, escapeHtml, getQueryParam, initHeaderSearch } from "./util.js";
import { refreshCartCountBadge } from "./cart-store.js";
import { renderHeaderAuth } from "./session.js";

const grid = document.getElementById("product-grid");
const categoryList = document.getElementById("category-list");
const sortTabs = document.getElementById("sort-tabs");
const breadcrumbEl = document.getElementById("breadcrumb");
const headingEl = document.getElementById("page-heading");
const searchInput = document.getElementById("search-input");
const pageSizeSelect = document.querySelector(".page-size");

const PAGE_SIZE = 60;

let categoryTree = [];
let currentSort = "recommended";
let expandedCategory = null;
let activeCategory = null; // { parent, sub: string|null } | null (null = 전체)
let searchTerm = "";
let currentPage = 0;
/** Guards against a slow earlier response overwriting a newer one. */
let requestSeq = 0;

function renderCategories() {
  categoryList.innerHTML = `
    <li class="category-group">
      <div class="category-row ${!activeCategory ? "active" : ""}" data-category="__all__">
        <span>전체</span>
      </div>
    </li>
    ${categoryTree
      .map((cat) => {
        const isExpanded = cat.name === expandedCategory;
        const isCategoryActive = activeCategory?.parent === cat.name && !activeCategory?.sub;
        const subItems = isExpanded
          ? `<ul class="subcategory-list">
              ${cat.subcategories
                .map((sub) => {
                  const isSubActive = activeCategory?.parent === cat.name && activeCategory?.sub === sub;
                  return `<li class="subcategory-item ${isSubActive ? "active" : ""}" data-parent="${escapeHtml(cat.name)}" data-sub="${escapeHtml(sub)}">${escapeHtml(sub)}</li>`;
                })
                .join("")}
            </ul>`
          : "";
        return `
          <li class="category-group">
            <div class="category-row ${isCategoryActive ? "active" : ""}" data-category="${escapeHtml(cat.name)}">
              <span>${escapeHtml(cat.name)}</span>
              <span class="chevron ${isExpanded ? "open" : ""}">&gt;</span>
            </div>
            ${subItems}
          </li>`;
      })
      .join("")}
  `;
}

function renderPageHeading() {
  let title;
  let crumbHtml;

  if (searchTerm) {
    title = `'${searchTerm}' 검색결과`;
    crumbHtml = escapeHtml(title);
  } else if (activeCategory?.sub) {
    title = activeCategory.sub;
    crumbHtml = `${escapeHtml(activeCategory.parent)} &gt; ${escapeHtml(activeCategory.sub)}`;
  } else if (activeCategory?.parent) {
    title = activeCategory.parent;
    crumbHtml = escapeHtml(activeCategory.parent);
  } else {
    title = "전체 상품";
    crumbHtml = "전체 상품";
  }

  headingEl.textContent = title;
  breadcrumbEl.innerHTML = `쇼핑 홈 &gt; ${crumbHtml}`;
}

function renderProductCard(p) {
  const discountPercent = p.originalPrice
    ? Math.round((1 - p.price / p.originalPrice) * 100)
    : null;

  return `
    <a class="product-card" href="product.html?id=${p.id}">
      <div class="thumb">
        <img src="${escapeHtml(p.imageUrl)}" alt="${escapeHtml(p.name)}" onerror="this.style.visibility='hidden'" />
      </div>
      <div class="name">${escapeHtml(p.name)}</div>
      ${
        discountPercent
          ? `<div class="discount-line">${discountPercent}%<span class="original-price">${formatKRW(p.originalPrice)}</span></div>`
          : ""
      }
      <div class="price-row">
        <span class="price">${formatKRW(p.price)}</span>
        <span class="badge delivery">${escapeHtml(p.deliveryBadge)}</span>
      </div>
      <div class="delivery-text">${escapeHtml(p.deliveryText)}</div>
      <div class="rating-row">
        <span class="stars">★ ${p.rating.toFixed(1)}</span>
        <span>(${p.reviewCount.toLocaleString("ko-KR")})</span>
      </div>
      ${p.rewardAmount ? `<span class="reward-badge">최대 ${formatKRW(p.rewardAmount)} 적립</span>` : ""}
    </a>
  `;
}

function renderPagination(page) {
  document.getElementById("pagination")?.remove();
  if (page.totalPages <= 1) return;

  const nav = document.createElement("div");
  nav.className = "pagination";
  nav.id = "pagination";
  nav.innerHTML = `
    <button type="button" data-page="${page.page - 1}" ${page.page === 0 ? "disabled" : ""}>이전</button>
    <span>${page.page + 1} / ${page.totalPages}</span>
    <button type="button" data-page="${page.page + 1}" ${page.page + 1 >= page.totalPages ? "disabled" : ""}>다음</button>
  `;
  nav.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-page]");
    if (!btn || btn.disabled) return;
    currentPage = Number(btn.dataset.page);
    loadProducts();
  });
  grid.after(nav);
}

/**
 * Filtering, sorting and paging all happen server-side -- the page asks for exactly the
 * slice it is about to draw instead of pulling the whole catalogue down and narrowing it
 * here. The sort keys and category names are passed through untouched because the API
 * accepts the same vocabulary the UI already uses.
 */
async function loadProducts() {
  const seq = ++requestSeq;
  grid.innerHTML = `<p class="empty-results">불러오는 중...</p>`;

  try {
    const page = await api.products.list({
      search: searchTerm || undefined,
      parentCategory:
        !searchTerm && activeCategory && !activeCategory.sub ? activeCategory.parent : undefined,
      category: !searchTerm && activeCategory?.sub ? activeCategory.sub : undefined,
      sort: currentSort,
      page: currentPage,
      size: PAGE_SIZE,
    });
    if (seq !== requestSeq) return;

    grid.innerHTML = page.content.length
      ? page.content.map(renderProductCard).join("")
      : `<p class="empty-results">조건에 맞는 상품이 없습니다.</p>`;
    if (pageSizeSelect) {
      pageSizeSelect.innerHTML = `<option>총 ${page.totalElements.toLocaleString("ko-KR")}개</option>`;
    }
    renderPagination(page);
  } catch (error) {
    if (seq !== requestSeq) return;
    grid.innerHTML = `<p class="empty-results">${escapeHtml(error.message)}</p>`;
  }
}

function applyFilterChange() {
  searchTerm = "";
  currentPage = 0;
  if (searchInput) searchInput.value = "";
  renderCategories();
  renderPageHeading();
  loadProducts();
}

categoryList.addEventListener("click", (e) => {
  const subItem = e.target.closest(".subcategory-item");
  if (subItem) {
    activeCategory = { parent: subItem.dataset.parent, sub: subItem.dataset.sub };
    applyFilterChange();
    return;
  }

  const row = e.target.closest(".category-row");
  if (!row) return;
  const name = row.dataset.category;

  if (name === "__all__") {
    activeCategory = null;
    expandedCategory = null;
  } else {
    expandedCategory = name;
    activeCategory = { parent: name, sub: null };
  }
  applyFilterChange();
});

sortTabs.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-sort]");
  if (!btn) return;
  currentSort = btn.dataset.sort;
  currentPage = 0;
  sortTabs.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b === btn));
  loadProducts();
});

async function loadCategories() {
  try {
    categoryTree = await api.categories.list();
    if (!searchTerm && !activeCategory && categoryTree.length) {
      expandedCategory = categoryTree[0].name;
    }
    renderCategories();
  } catch {
    // The catalogue is still usable without the sidebar, so this is not fatal.
    categoryList.innerHTML = `<li class="category-group">카테고리를 불러오지 못했습니다.</li>`;
  }
}

const initialSearch = getQueryParam("search");
if (initialSearch) {
  searchTerm = initialSearch;
  if (searchInput) searchInput.value = initialSearch;
}

renderPageHeading();
loadCategories();
loadProducts();
renderHeaderAuth();
refreshCartCountBadge();
initHeaderSearch((term) => {
  searchTerm = term;
  activeCategory = null;
  expandedCategory = null;
  currentPage = 0;
  renderCategories();
  renderPageHeading();
  loadProducts();
});
