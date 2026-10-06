import { sb } from "../core/supabase-client.js";

const loader = document.getElementById("pageLoader");
const errorBox = document.getElementById("authError");
const successBox = document.getElementById("authSuccess");

const showLoader = () => loader?.classList.remove("hidden");
const hideLoader = () => loader?.classList.add("hidden");

function showError(message) {
  errorBox?.classList.remove("hidden");
  successBox?.classList.add("hidden");
  if (errorBox) errorBox.textContent = message;
}

function showSuccess(message) {
  successBox?.classList.remove("hidden");
  errorBox?.classList.add("hidden");
  if (successBox) successBox.textContent = message;
}

function clearMessages() {
  errorBox?.classList.add("hidden");
  successBox?.classList.add("hidden");
  if (errorBox) errorBox.textContent = "";
  if (successBox) successBox.textContent = "";
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeMobile(value) {
  return value.trim().replace(/[^\d+()\-\s]/g, "");
}

function validMobile(value) {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15;
}

function friendlyError(error) {
  const message = String(error?.message || "").trim();
  const lower = message.toLowerCase();

  if (lower.includes("user already registered") || lower.includes("already registered")) {
    return "An account with this email already exists. Please login instead.";
  }
  if (lower.includes("invalid login credentials")) {
    return "Invalid email or password.";
  }
  if (lower.includes("email not confirmed")) {
    return "Please confirm your email address before logging in.";
  }
  if (lower.includes("password")) {
    return message;
  }
  if (lower.includes("rate limit")) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  if (lower.includes("failed to fetch") || lower.includes("network")) {
    return "Unable to connect to Supabase. Check your internet connection and try again.";
  }
  if (lower.includes("database error saving new user")) {
    return "Supabase could not save the new user. Please check the Auth/profile trigger configuration.";
  }
  return message || "Something went wrong. Please try again.";
}

function appUrl(file) {
  return new URL(file, window.location.href).href;
}

async function redirectIfSignedIn() {
  const authPage =
    document.getElementById("loginForm") ||
    document.getElementById("registerForm");

  if (!authPage) return;

  const { data, error } = await sb.auth.getSession();

  if (error) {
    console.error(error);
    return;
  }

  if (data.session) {
    window.location.replace(appUrl("dashboard.html"));
  }
}

async function login(event) {
  event.preventDefault();
  clearMessages();

  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const button = document.getElementById("loginButton");

  const email = emailInput?.value.trim().toLowerCase() || "";
  const password = passwordInput?.value || "";

  if (!validEmail(email)) {
    showError("Please enter a valid email address.");
    emailInput?.focus();
    return;
  }

  if (!password) {
    showError("Please enter your password.");
    passwordInput?.focus();
    return;
  }

  showLoader();
  if (button) button.disabled = true;

  try {
    const { data, error } = await sb.auth.signInWithPassword({
      email,
      password
    });

    console.log("LOGIN RESPONSE:", { data, error });

    if (error) {
      showError(friendlyError(error));
      return;
    }

    if (!data?.session) {
      showError("Login completed but no active session was returned.");
      return;
    }

    window.location.replace(appUrl("dashboard.html"));
  } catch (error) {
    console.error(error);
    showError("Unable to login right now. Please try again.");
  } finally {
    if (button) button.disabled = false;
    hideLoader();
  }
}

async function register(event) {
  event.preventDefault();
  clearMessages();

  const fullNameInput = document.getElementById("fullName");
  const mobileInput = document.getElementById("mobileNumber");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const confirmInput = document.getElementById("confirmPassword");
  const button = document.getElementById("registerButton");

  const fullName = fullNameInput?.value.trim() || "";
  const mobile = normalizeMobile(mobileInput?.value || "");
  const email = emailInput?.value.trim().toLowerCase() || "";
  const password = passwordInput?.value || "";
  const confirmPassword = confirmInput?.value || "";

  if (fullName.length < 2) {
    showError("Please enter your full name.");
    fullNameInput?.focus();
    return;
  }

  if (!validMobile(mobile)) {
    showError("Please enter a valid mobile number.");
    mobileInput?.focus();
    return;
  }

  if (!validEmail(email)) {
    showError("Please enter a valid email address.");
    emailInput?.focus();
    return;
  }

  if (password.length < 8) {
    showError("Password must contain at least 8 characters.");
    passwordInput?.focus();
    return;
  }

  if (password !== confirmPassword) {
    showError("Password and Confirm Password do not match.");
    confirmInput?.focus();
    return;
  }

  showLoader();
  if (button) button.disabled = true;

  try {
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          mobile_number: mobile
        },
        emailRedirectTo: appUrl("auth-callback.html")
      }
    });

    console.log("SIGNUP RESPONSE:", { data, error });

    if (error) {
      showError(friendlyError(error));
      return;
    }

    if (!data?.user) {
      showError("Supabase did not return a user after registration.");
      return;
    }

    if (data.session) {
      window.location.replace(appUrl("dashboard.html"));
      return;
    }

    showSuccess(
      "Account created. Please check your email to confirm your account, then login."
    );

    document.getElementById("registerForm")?.reset();
  } catch (error) {
    console.error(error);
    showError("Unable to create your account right now.");
  } finally {
    if (button) button.disabled = false;
    hideLoader();
  }
}

async function googleLogin() {
  clearMessages();
  showLoader();

  try {
    const { data, error } = await sb.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: appUrl("auth-callback.html")
      }
    });

    console.log("GOOGLE RESPONSE:", { data, error });

    if (error) {
      showError(friendlyError(error));
      hideLoader();
    }
  } catch (error) {
    console.error(error);
    showError("Google sign-in could not be started.");
    hideLoader();
  }
}

async function forgotPassword(event) {
  event.preventDefault();
  clearMessages();

  const emailInput = document.getElementById("email");
  const button = document.getElementById("forgotButton");
  const email = emailInput?.value.trim().toLowerCase() || "";

  if (!validEmail(email)) {
    showError("Please enter a valid email address.");
    emailInput?.focus();
    return;
  }

  if (button) button.disabled = true;

  try {
    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: appUrl("reset-password.html")
    });

    if (error) {
      showError(friendlyError(error));
      return;
    }

    showSuccess(
      "If an account exists for that email, a secure password reset link has been sent."
    );

    document.getElementById("forgotForm")?.reset();
  } catch (error) {
    console.error(error);
    showError("Unable to send the reset link right now.");
  } finally {
    if (button) button.disabled = false;
  }
}

async function resetPassword(event) {
  event.preventDefault();
  clearMessages();

  const passwordInput = document.getElementById("password");
  const confirmInput = document.getElementById("confirmPassword");
  const button = document.getElementById("resetButton");

  const password = passwordInput?.value || "";
  const confirmPassword = confirmInput?.value || "";

  if (password.length < 8) {
    showError("Password must contain at least 8 characters.");
    passwordInput?.focus();
    return;
  }

  if (password !== confirmPassword) {
    showError("Password and Confirm Password do not match.");
    confirmInput?.focus();
    return;
  }

  if (button) button.disabled = true;

  try {
    const { error } = await sb.auth.updateUser({
      password
    });

    if (error) {
      showError(friendlyError(error));
      return;
    }

    showSuccess("Password updated successfully. You can now login with your new password.");

    document.getElementById("resetForm")?.reset();

    setTimeout(() => {
      window.location.replace(appUrl("index.html"));
    }, 1800);
  } catch (error) {
    console.error(error);
    showError("Unable to update your password right now.");
  } finally {
    if (button) button.disabled = false;
  }
}

document.getElementById("loginForm")?.addEventListener("submit", login);
document.getElementById("registerForm")?.addEventListener("submit", register);
document.querySelectorAll("#googleButton").forEach((button) => {
  button.addEventListener("click", googleLogin);
});
document.getElementById("forgotForm")?.addEventListener("submit", forgotPassword);
document.getElementById("resetForm")?.addEventListener("submit", resetPassword);

redirectIfSignedIn();
