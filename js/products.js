import { mockProducts, categoryTree } from "../data/products.mock.js";
import { formatKRW, escapeHtml, getQueryParam, initHeaderSearch } from "./util.js";
import { renderCartCountBadge } from "./cart-store.js";

const grid = document.getElementById("product-grid");
const categoryList = document.getElementById("category-list");
const sortTabs = document.getElementById("sort-tabs");
const breadcrumbEl = document.getElementById("breadcrumb");
const headingEl = document.getElementById("page-heading");
const searchInput = document.getElementById("search-input");

let currentSort = "recommended";
let expandedCategory = categoryTree[0].name;
let activeCategory = null; // { parent, sub: string|null } | null (null = 전체)
let searchTerm = "";

function getFilteredProducts() {
  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    return mockProducts.filter((p) => p.name.toLowerCase().includes(term));
  }
  if (activeCategory?.sub) {
    return mockProducts.filter((p) => p.category === activeCategory.sub);
  }
  if (activeCategory?.parent) {
    return mockProducts.filter((p) => p.parentCategory === activeCategory.parent);
  }
  return mockProducts;
}

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

function applyFilterChange() {
  searchTerm = "";
  if (searchInput) searchInput.value = "";
  renderCategories();
  renderPageHeading();
  renderGrid();
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

function sortProducts(products, sort) {
  const copy = [...products];
  switch (sort) {
    case "price-asc":
      return copy.sort((a, b) => a.price - b.price);
    case "price-desc":
      return copy.sort((a, b) => b.price - a.price);
    case "reviews":
      return copy.sort((a, b) => b.reviewCount - a.reviewCount);
    default:
      return copy;
  }
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

function renderGrid() {
  const filtered = getFilteredProducts();
  const sorted = sortProducts(filtered, currentSort);
  grid.innerHTML = sorted.length
    ? sorted.map(renderProductCard).join("")
    : `<p class="empty-results">조건에 맞는 상품이 없습니다.</p>`;
}

sortTabs.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-sort]");
  if (!btn) return;
  currentSort = btn.dataset.sort;
  sortTabs.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b === btn));
  renderGrid();
});

const initialSearch = getQueryParam("search");
if (initialSearch) {
  searchTerm = initialSearch;
  if (searchInput) searchInput.value = initialSearch;
  expandedCategory = null;
}

renderCategories();
renderPageHeading();
renderGrid();
renderCartCountBadge();
initHeaderSearch((term) => {
  searchTerm = term;
  activeCategory = null;
  expandedCategory = null;
  renderCategories();
  renderPageHeading();
  renderGrid();
});
