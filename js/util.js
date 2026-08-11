export function formatKRW(amount) {
  return new Intl.NumberFormat("ko-KR").format(amount) + "원";
}

export function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

export function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

export function initHeaderSearch(onSearchOnThisPage) {
  const input = document.getElementById("search-input");
  const btn = document.getElementById("search-btn");
  if (!input || !btn) return;

  function submitSearch() {
    const term = input.value.trim();
    if (onSearchOnThisPage) {
      onSearchOnThisPage(term);
    } else {
      window.location.href = term ? `index.html?search=${encodeURIComponent(term)}` : "index.html";
    }
  }

  btn.addEventListener("click", submitSearch);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") submitSearch();
  });
}
