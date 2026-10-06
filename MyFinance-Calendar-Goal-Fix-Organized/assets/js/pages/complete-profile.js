import { sb } from "../core/supabase-client.js";

const loader = document.getElementById("pageLoader");
const errorBox = document.getElementById("profileError");
const successBox = document.getElementById("profileSuccess");

function showLoader() {
  loader?.classList.remove("hidden");
}
function hideLoader() {
  loader?.classList.add("hidden");
}
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
function normalizeMobile(value) {
  return value.trim().replace(/[^\d+()\-\s]/g, "");
}
function validMobile(value) {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15;
}
function url(file) {
  return new URL(file, window.location.href).href;
}

async function loadUser() {
  try {
    const { data, error } = await sb.auth.getSession();
    if (error) throw error;

    if (!data?.session?.user) {
      window.location.replace(url("index.html"));
      return;
    }

    const mobileInput = document.getElementById("mobileNumber");
    const existing =
      data.session.user.user_metadata?.mobile_number || "";

    if (existing && mobileInput) {
      mobileInput.value = existing;
    }
  } catch (error) {
    console.error(error);
    window.location.replace(url("index.html"));
  }
}

async function saveProfile(event) {
  event.preventDefault();

  const input = document.getElementById("mobileNumber");
  const button = document.getElementById("profileButton");
  const mobile = normalizeMobile(input?.value || "");

  if (!validMobile(mobile)) {
    showError("Please enter a valid mobile number.");
    input?.focus();
    return;
  }

  showLoader();
  if (button) button.disabled = true;

  try {
    const { data: userData, error: userError } = await sb.auth.getUser();

    if (userError) throw userError;

    const user = userData?.user;

    if (!user) {
      throw new Error("No authenticated user found.");
    }

    const { error: updateError } = await sb
      .from("profiles")
      .update({
        mobile_number: mobile,
        email: user.email
      })
      .eq("id", user.id);

    if (updateError) throw updateError;

    // Keep Auth metadata consistent too.
    const { error: metadataError } = await sb.auth.updateUser({
      data: {
        ...(user.user_metadata || {}),
        mobile_number: mobile
      }
    });

    if (metadataError) {
      console.warn("Auth metadata update failed:", metadataError);
    }

    showSuccess("Profile completed successfully.");

    setTimeout(() => {
      window.location.replace(url("dashboard.html"));
    }, 700);
  } catch (error) {
    console.error(error);
    showError(error.message || "Unable to save your profile.");
  } finally {
    if (button) button.disabled = false;
    hideLoader();
  }
}

document
  .getElementById("completeProfileForm")
  ?.addEventListener("submit", saveProfile);

loadUser();
