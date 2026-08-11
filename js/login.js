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

form.addEventListener("submit", (e) => {
  e.preventDefault();
  toast.hidden = true;

  if (!emailInput.value.trim() || !passwordInput.value) {
    errorEl.textContent = "아이디와 비밀번호를 입력해주세요.";
    errorEl.hidden = false;
    return;
  }

  errorEl.hidden = true;
  toast.textContent = "로그인 기능은 back_web 연동 후 실제로 동작합니다";
  toast.hidden = false;
});
