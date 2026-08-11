const form = document.getElementById("signup-form");
const toast = document.getElementById("form-toast");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^01[0-9]-?\d{3,4}-?\d{4}$/;

const fields = {
  email: {
    input: document.getElementById("field-email"),
    error: document.getElementById("error-email"),
  },
  password: {
    input: document.getElementById("field-password"),
    error: document.getElementById("error-password"),
  },
  passwordConfirm: {
    input: document.getElementById("field-password-confirm"),
    error: document.getElementById("error-password-confirm"),
  },
  name: {
    input: document.getElementById("field-name"),
    error: document.getElementById("error-name"),
  },
  phone: {
    input: document.getElementById("field-phone"),
    error: document.getElementById("error-phone"),
  },
};

const agreeAll = document.getElementById("agree-all");
const requiredAgreements = Array.from(document.querySelectorAll(".agree-required"));
const agreementError = document.getElementById("error-agreement");

function setFieldError(field, message) {
  field.input.classList.toggle("invalid", Boolean(message));
  field.error.textContent = message ?? "";
  field.error.hidden = !message;
}

function validateEmail() {
  const value = fields.email.input.value.trim();
  if (!value) {
    setFieldError(fields.email, "아이디(이메일)를 입력해주세요.");
    return false;
  }
  if (!EMAIL_REGEX.test(value)) {
    setFieldError(fields.email, "이메일 형식이 올바르지 않습니다.");
    return false;
  }
  setFieldError(fields.email, null);
  return true;
}

function validatePassword() {
  const value = fields.password.input.value;
  if (!value) {
    setFieldError(fields.password, "비밀번호를 입력해주세요.");
    return false;
  }
  if (value.length < 8) {
    setFieldError(fields.password, "비밀번호는 8자 이상이어야 합니다.");
    return false;
  }
  setFieldError(fields.password, null);
  return true;
}

function validatePasswordConfirm() {
  const value = fields.passwordConfirm.input.value;
  if (!value) {
    setFieldError(fields.passwordConfirm, "비밀번호를 다시 입력해주세요.");
    return false;
  }
  if (value !== fields.password.input.value) {
    setFieldError(fields.passwordConfirm, "비밀번호가 일치하지 않습니다.");
    return false;
  }
  setFieldError(fields.passwordConfirm, null);
  return true;
}

function validateName() {
  const value = fields.name.input.value.trim();
  if (!value) {
    setFieldError(fields.name, "이름을 입력해주세요.");
    return false;
  }
  setFieldError(fields.name, null);
  return true;
}

function validatePhone() {
  const value = fields.phone.input.value.trim();
  if (!value) {
    setFieldError(fields.phone, "휴대폰번호를 입력해주세요.");
    return false;
  }
  if (!PHONE_REGEX.test(value)) {
    setFieldError(fields.phone, "휴대폰번호 형식이 올바르지 않습니다.");
    return false;
  }
  setFieldError(fields.phone, null);
  return true;
}

function validateAgreements() {
  const allChecked = requiredAgreements.every((cb) => cb.checked);
  agreementError.hidden = allChecked;
  return allChecked;
}

function syncMasterCheckbox() {
  agreeAll.checked = requiredAgreements.every((cb) => cb.checked);
}

agreeAll.addEventListener("change", () => {
  requiredAgreements.forEach((cb) => {
    cb.checked = agreeAll.checked;
  });
  validateAgreements();
});

requiredAgreements.forEach((checkbox) => {
  checkbox.addEventListener("change", () => {
    syncMasterCheckbox();
    validateAgreements();
  });
});

form.addEventListener("submit", (e) => {
  e.preventDefault();
  toast.hidden = true;

  const results = [
    validateEmail(),
    validatePassword(),
    validatePasswordConfirm(),
    validateName(),
    validatePhone(),
    validateAgreements(),
  ];

  if (!results.every(Boolean)) {
    const firstInvalid = Object.values(fields).find((f) => f.input.classList.contains("invalid"));
    if (firstInvalid) firstInvalid.input.focus();
    return;
  }

  toast.textContent = "회원가입 기능은 back_web 연동 후 실제로 동작합니다";
  toast.hidden = false;
});
