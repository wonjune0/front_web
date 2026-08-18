import { escapeHtml } from "./util.js";

const SESSION_KEY = "shopdemo_session";

/**
 * The login response carries expiresIn, so the expiry is checked here before a request
 * goes out. A token the server has already rejected still gets cleared by api.js on a
 * 401 -- this only avoids the round trip in the common case.
 */
function read() {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY));
    if (!session?.accessToken) return null;
    if (session.expiresAt && Date.now() >= session.expiresAt) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function setSession(loginResponse) {
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      accessToken: loginResponse.accessToken,
      expiresAt: Date.now() + (loginResponse.expiresIn ?? 0),
      user: loginResponse.user ?? null,
    })
  );
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export function getToken() {
  return read()?.accessToken ?? null;
}

export function getUser() {
  return read()?.user ?? null;
}

export function isLoggedIn() {
  return read() !== null;
}

/**
 * Guard for the pages that cannot render anything useful without a cart: returns false
 * after starting the redirect, so callers can bail out instead of running on.
 */
export function requireLogin() {
  if (isLoggedIn()) return true;
  const returnTo = window.location.pathname.split("/").pop() + window.location.search;
  window.location.href = `login.html?redirect=${encodeURIComponent(returnTo)}`;
  return false;
}

export function renderHeaderAuth() {
  const el = document.getElementById("header-auth");
  if (!el) return;

  const user = getUser();
  el.innerHTML = user
    ? `<span class="account-user">${escapeHtml(user.name)}님</span>
       <a href="orders.html">주문내역</a>
       <button type="button" class="account-link-btn" id="logout-btn">로그아웃</button>`
    : `<a href="login.html">로그인</a>
       <a href="signup.html">회원가입</a>`;

  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      clearSession();
      window.location.href = "index.html";
    });
  }
}
