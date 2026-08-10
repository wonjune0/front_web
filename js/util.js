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
