import { mockProducts, categoryTree } from "../data/products.mock.js";
import { formatKRW, escapeHtml } from "./util.js";
import { renderCartCountBadge } from "./cart-store.js";

const grid = document.getElementById("product-grid");
const categoryList = document.getElementById("category-list");
const sortTabs = document.getElementById("sort-tabs");

let currentSort = "recommended";
let expandedCategory = categoryTree[0].name;

function renderCategories() {
  categoryList.innerHTML = categoryTree
    .map((cat) => {
      const isExpanded = cat.name === expandedCategory;
      const subItems = isExpanded
        ? `<ul class="subcategory-list">
            ${cat.subcategories
              .map((sub) => `<li class="subcategory-item">${escapeHtml(sub)}</li>`)
              .join("")}
          </ul>`
        : "";
      return `
        <li class="category-group">
          <div class="category-row ${isExpanded ? "active" : ""}" data-category="${escapeHtml(cat.name)}">
            <span>${escapeHtml(cat.name)}</span>
            <span class="chevron ${isExpanded ? "open" : ""}">&gt;</span>
          </div>
          ${subItems}
        </li>`;
    })
    .join("");
}

categoryList.addEventListener("click", (e) => {
  const row = e.target.closest(".category-row");
  if (!row) return;
  const name = row.dataset.category;
  expandedCategory = expandedCategory === name ? null : name;
  renderCategories();
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
  const sorted = sortProducts(mockProducts, currentSort);
  grid.innerHTML = sorted.map(renderProductCard).join("");
}

sortTabs.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-sort]");
  if (!btn) return;
  currentSort = btn.dataset.sort;
  sortTabs.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b === btn));
  renderGrid();
});

renderCategories();
renderGrid();
renderCartCountBadge();
