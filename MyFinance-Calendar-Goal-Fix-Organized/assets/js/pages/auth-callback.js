import { sb } from "../core/supabase-client.js";

const errorBox = document.getElementById("callbackError");

function showError(message) {
  errorBox?.classList.remove("hidden");
  if (errorBox) errorBox.textContent = message;
  document.querySelector(".callback-spinner")?.classList.add("hidden");
}

function url(file) {
  return new URL(file, window.location.href).href;
}

async function finishAuthentication() {
  try {
    const { data, error } = await sb.auth.getSession();

    if (error) throw error;

    const session = data?.session;

    if (!session?.user) {
      showError("We could not complete sign-in. Please return to the login page and try again.");
      return;
    }

    const user = session.user;

    const { data: profile, error: profileError } = await sb
      .from("profiles")
      .select("id, full_name, mobile_number, email")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Profile lookup error:", profileError);
    }

    const mobile =
      profile?.mobile_number?.trim() ||
      user.user_metadata?.mobile_number?.trim() ||
      "";

    if (!mobile) {
      window.location.replace(url("complete-profile.html"));
      return;
    }

    window.location.replace(url("dashboard.html"));
  } catch (error) {
    console.error("OAuth callback error:", error);
    showError("Unable to finish sign-in. Please try again.");
  }
}

finishAuthentication();
