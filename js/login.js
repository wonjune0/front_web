import { api } from "./api.js";
import { setSession } from "./session.js";
import { getQueryParam } from "./util.js";

const form = document.getElementById("login-form");
const toast = document.getElementById("login-toast");
const errorEl = document.getElementById("error-login");
const emailInput = document.getElementById("field-login-email");
const passwordInput = document.getElementById("field-login-password");
const togglePasswordBtn = document.getElementById("toggle-password-btn");

document.getElementById("clear-email-btn").addEventListener("click", () => {
  emailInput.value = "";
  emailInput.focus();
});

togglePasswordBtn.addEventListener("click", () => {
  const willShow = passwordInput.type === "password";
  passwordInput.type = willShow ? "text" : "password";
  togglePasswordBtn.textContent = willShow ? "🙈" : "👁";
  togglePasswordBtn.setAttribute("aria-label", willShow ? "비밀번호 숨기기" : "비밀번호 표시");
});

const submitBtn = form.querySelector('button[type="submit"]');

/**
 * Pages that need a session send the user here with ?redirect=, so a successful login
 * returns them to whatever they were trying to do. Only same-page relative targets are
 * honoured -- an absolute URL in the query string would be an open redirect.
 */
function redirectTarget() {
  const requested = getQueryParam("redirect");
  if (!requested || /^[a-z]+:|^\/\//i.test(requested) || requested.startsWith("/")) {
    return "index.html";
  }
  return requested;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  toast.hidden = true;

  if (!emailInput.value.trim() || !passwordInput.value) {
    errorEl.textContent = "아이디와 비밀번호를 입력해주세요.";
    errorEl.hidden = false;
    return;
  }

  errorEl.hidden = true;
  if (submitBtn) submitBtn.disabled = true;

  try {
    const login = await api.auth.login({
      email: emailInput.value.trim(),
      password: passwordInput.value,
    });
    setSession(login);
    window.location.href = redirectTarget();
  } catch (error) {
    errorEl.textContent = error.message;
    errorEl.hidden = false;
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
});
