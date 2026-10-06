import { sb } from "./supabase-client.js";

export function appUrl(file) {
  return new URL(file, window.location.href).href;
}

export function firstLetter(name) {
  return (name || "U").trim().charAt(0).toUpperCase() || "U";
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function formatCurrency(amount, currency = "INR") {
  const number = Number(amount || 0);
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 2
    }).format(number);
  } catch {
    return `₹${number.toFixed(2)}`;
  }
}

export function formatDate(dateValue) {
  if (!dateValue) return "—";
  const [y, m, d] = String(dateValue).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return String(dateValue);
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit", month: "short", year: "numeric"
  }).format(new Date(y, m - 1, d));
}

export function localDateInputValue(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function monthBounds(date = new Date()) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const next = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return {
    start: localDateInputValue(first),
    endExclusive: localDateInputValue(next),
    label: new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(first)
  };
}

export function startOfThisWeek(date = new Date()) {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return localDateInputValue(copy);
}

export function showToast(message, type = "success") {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}

export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("myfinance-theme", theme);
  const button = document.getElementById("themeToggle");
  if (button) {
    button.textContent = theme === "dark" ? "☀️" : "🌙";
    button.setAttribute("aria-label", theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
  }
}

export function setupTheme() {
  const theme = localStorage.getItem("myfinance-theme") || "light";
  applyTheme(theme);
  document.getElementById("themeToggle")?.addEventListener("click", () => {
    const current = document.documentElement.dataset.theme || "light";
    applyTheme(current === "dark" ? "light" : "dark");
  });
}

const APP_NAV_ITEMS = [
  ["dashboard.html", "⌂", "Dashboard"],
  ["transactions.html", "↔", "Transactions"],
  ["reports.html", "▥", "Reports"],
  ["analytics.html", "◔", "Analytics"],
  ["reminders.html", "🔔", "Reminders"],
  ["calendar.html", "▣", "Calendar"],
  ["categories.html", "▦", "Categories"],
  ["goals.html", "◎", "Goals"],
  ["vehicles.html", "🚗", "Vehicles"],
  ["why-50-30-20.html", "50", "50/30/20"],
  ["help.html", "?", "Help"]
];

export function setupAppMenu() {
  const toggle = document.getElementById("menuToggle");
  if (!toggle || document.getElementById("appNavDrawer")) return;

  const overlay = document.createElement("div");
  overlay.id = "appNavOverlay";
  overlay.className = "app-nav-overlay hidden";

  const drawer = document.createElement("aside");
  drawer.id = "appNavDrawer";
  drawer.className = "app-nav-drawer";
  drawer.setAttribute("aria-label", "Application navigation");

  const current = location.pathname.split("/").pop() || "dashboard.html";
  const links = APP_NAV_ITEMS.map(([href, icon, label]) => {
    const active = current.toLowerCase() === href.toLowerCase();
    return `<a href="${href}" class="drawer-link${active ? " active" : ""}"><span class="drawer-icon">${icon}</span><span>${label}</span></a>`;
  }).join("");

  drawer.innerHTML = `
    <div class="drawer-head">
      <div><strong>MyFinance</strong><small>Navigate</small></div>
      <button type="button" class="drawer-close" aria-label="Close navigation menu">×</button>
    </div>
    <nav class="drawer-links">${links}</nav>
  `;

  document.body.append(overlay, drawer);
  const close = () => {
    overlay.classList.add("hidden");
    drawer.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
  };
  const open = () => {
    overlay.classList.remove("hidden");
    drawer.classList.add("open");
    toggle.setAttribute("aria-expanded", "true");
  };

  toggle.addEventListener("click", (event) => {
    event.preventDefault();
    drawer.classList.contains("open") ? close() : open();
  });
  overlay.addEventListener("click", close);
  drawer.querySelector(".drawer-close")?.addEventListener("click", close);
  drawer.querySelectorAll("a").forEach(link => link.addEventListener("click", close));
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") close();
  });
}

export function setupProfileMenu({onProfile, onSettings} = {}) {
  const button = document.getElementById("profileButton");
  const menu = document.getElementById("profileMenu");

  const close = () => {
    menu?.classList.add("hidden");
    button?.setAttribute("aria-expanded", "false");
  };

  button?.addEventListener("click", (event) => {
    event.stopPropagation();
    const isHidden = menu?.classList.contains("hidden");
    menu?.classList.toggle("hidden", !isHidden);
    button.setAttribute("aria-expanded", String(Boolean(isHidden)));
  });

  document.addEventListener("click", (event) => {
    if (button && menu && !button.contains(event.target) && !menu.contains(event.target)) close();
  });

  document.getElementById("myProfileLink")?.addEventListener("click", () => {
    close();
    if (onProfile) onProfile(); else window.location.href = appUrl("profile.html");
  });
  document.getElementById("settingsLink")?.addEventListener("click", () => {
    close();
    if (onSettings) onSettings(); else window.location.href = appUrl("settings.html");
  });

  document.getElementById("logoutButton")?.addEventListener("click", async () => {
    close();
    const { error } = await sb.auth.signOut();
    if (error) {
      showToast("Unable to logout right now.", "error");
      return;
    }
    window.location.replace(appUrl("index.html"));
  });
}

export async function requireUser() {
  const { data, error } = await sb.auth.getSession();
  if (error) throw error;
  if (!data.session?.user) {
    window.location.replace(appUrl("index.html"));
    throw new Error("AUTH_REQUIRED");
  }
  return data.session.user;
}

export async function loadProfileUI() {
  const user = await requireUser();
  const { data: profile, error } = await sb
    .from("profiles")
    .select("full_name, email, mobile_number, currency_code, timezone")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw error;

  const name = profile?.full_name?.trim() || user.user_metadata?.full_name?.trim() || user.email?.split("@")[0] || "User";
  const email = profile?.email || user.email || "—";
  const initial = firstLetter(name);

  document.querySelectorAll("[data-profile-name]").forEach(el => el.textContent = name);
  document.querySelectorAll("[data-profile-email]").forEach(el => el.textContent = email);
  document.querySelectorAll("[data-profile-initial]").forEach(el => el.textContent = initial);

  return { user, profile, currency: profile?.currency_code || "INR", name, email };
}

export function transactionIcon(type) {
  return type === "income" ? "↗" : type === "savings" ? "◎" : "↙";
}

export function transactionClass(type) {
  return type === "income" ? "income" : type === "savings" ? "saving" : "expense";
}

export function friendlySupabaseError(error) {
  const message = String(error?.message || "").trim();
  const lower = message.toLowerCase();
  if (lower.includes("violates row-level security")) return "You are not allowed to access this data.";
  if (lower.includes("duplicate key") || lower.includes("already exists")) return "That record already exists.";
  if (lower.includes("foreign key")) return "This item is already linked to existing data and cannot be removed.";
  if (lower.includes("check constraint")) return "One of the values is not valid for this transaction.";
  if (lower.includes("network") || lower.includes("failed to fetch")) return "Unable to connect. Check your internet connection and try again.";
  return message || "Something went wrong. Please try again.";
}
