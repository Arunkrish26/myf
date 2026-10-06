import { sb } from "../core/supabase-client.js";
import { appUrl, setupTheme, setupAppMenu, setupProfileMenu, loadProfileUI, escapeHtml, showToast, friendlySupabaseError } from "../core/app-shared.js";

const loader = document.getElementById("pageLoader");
const state = { user: null, rows: [], editingId: null };
const showLoader = () => loader?.classList.remove("hidden");
const hideLoader = () => loader?.classList.add("hidden");

function openModal(row = null) {
  state.editingId = row?.id || null;
  document.getElementById("categoryModalTitle").textContent = row ? "Edit Category" : "Add Category";
  document.getElementById("categoryName").value = row?.name || "";
  document.getElementById("categoryType").value = row?.category_type || "expense";
  document.getElementById("categoryType").disabled = Boolean(row);
  document.getElementById("categoryError").classList.add("hidden");
  document.getElementById("categoryModal").classList.remove("hidden");
  setTimeout(() => document.getElementById("categoryName")?.focus(), 0);
}
function closeModal() { document.getElementById("categoryModal").classList.add("hidden"); state.editingId = null; document.getElementById("categoryType").disabled = false; }

async function loadCategories() {
  const { data, error } = await sb.from("categories").select("id,user_id,name,category_type,icon,is_active,created_at").or(`user_id.is.null,user_id.eq.${state.user.id}`).order("category_type").order("name");
  if (error) throw error;
  state.rows = data || [];
  render();
}

function groupRows(type) {
  return state.rows.filter(x => x.category_type === type);
}

function renderGroup(type, title, icon) {
  const rows = groupRows(type);
  const system = rows.filter(x => x.user_id === null);
  const custom = rows.filter(x => x.user_id === state.user.id);
  const list = [...system, ...custom];
  return `<article class="category-group category-group-${type}"><h3>${icon} ${title}</h3><div class="category-list">${list.length ? list.map(row => {
    const isCustom = row.user_id === state.user.id;
    return `<div class="category-item"><div><strong>${escapeHtml(row.name)}</strong><small>${isCustom ? (row.is_active ? "Your category" : "Inactive") : "System category"}</small></div>${isCustom ? `<div class="category-actions"><button data-edit="${row.id}">Edit</button><button data-toggle="${row.id}">${row.is_active ? "Deactivate" : "Activate"}</button><button class="danger" data-delete="${row.id}">Delete</button></div>` : `<span class="status-badge active">System</span>`}</div>`;
  }).join("") : `<div class="empty-state"><strong>No categories</strong>Create your first category.</div>`}</div></article>`;
}

function render() {
  document.getElementById("categoryGroups").innerHTML = [
    renderGroup("expense", "Expense", "↙"),
    renderGroup("income", "Income", "↗"),
    renderGroup("savings", "Savings", "◎")
  ].join("");
}

async function saveCategory(event) {
  event.preventDefault();
  const name = document.getElementById("categoryName").value.trim().replace(/\s+/g, " ");
  const type = document.getElementById("categoryType").value;
  const errorBox = document.getElementById("categoryError");
  errorBox.classList.add("hidden");
  if (name.length < 2) { errorBox.textContent = "Category name must contain at least 2 characters."; errorBox.classList.remove("hidden"); return; }
  const button = document.getElementById("saveCategory"); button.disabled = true; showLoader();
  try {
    let result;
    if (state.editingId) result = await sb.from("categories").update({ name, updated_at: new Date().toISOString() }).eq("id", state.editingId).eq("user_id", state.user.id).select().maybeSingle();
    else result = await sb.from("categories").insert({ user_id: state.user.id, name, category_type: type, is_active: true }).select().maybeSingle();
    if (result.error) throw result.error;
    const wasEditing = Boolean(state.editingId); closeModal(); await loadCategories(); showToast(wasEditing ? "Category updated." : "Category created.");
  } catch (error) { console.error(error); errorBox.textContent = friendlySupabaseError(error); errorBox.classList.remove("hidden"); }
  finally { button.disabled = false; hideLoader(); }
}

async function toggleCategory(id) {
  const row = state.rows.find(x => String(x.id) === String(id)); if (!row) return;
  showLoader();
  try {
    const { error } = await sb.from("categories").update({ is_active: !row.is_active, updated_at: new Date().toISOString() }).eq("id", id).eq("user_id", state.user.id);
    if (error) throw error; await loadCategories(); showToast(row.is_active ? "Category deactivated." : "Category activated.");
  } catch (error) { console.error(error); showToast(friendlySupabaseError(error), "error"); } finally { hideLoader(); }
}

async function deleteCategory(id) {
  const row = state.rows.find(x => String(x.id) === String(id)); if (!row) return;
  const { count, error: countError } = await sb.from("transactions").select("id", { count: "exact", head: true }).eq("user_id", state.user.id).eq("category_id", id);
  if (countError) { showToast(friendlySupabaseError(countError), "error"); return; }
  if (count > 0) { showToast("This category is used by transactions. Deactivate it instead of deleting it.", "error"); return; }
  if (!window.confirm(`Delete the custom category “${row.name}”?`)) return;
  showLoader();
  try { const { error } = await sb.from("categories").delete().eq("id", id).eq("user_id", state.user.id); if (error) throw error; await loadCategories(); showToast("Category deleted."); }
  catch (error) { console.error(error); showToast(friendlySupabaseError(error), "error"); }
  finally { hideLoader(); }
}

async function init() {
  setupAppMenu(); setupTheme();
  setupProfileMenu();
  showLoader();
  try { const profile = await loadProfileUI(); state.user = profile.user; await loadCategories(); }
  catch (error) { if (String(error?.message) !== "AUTH_REQUIRED") { console.error(error); showToast(friendlySupabaseError(error), "error"); } }
  finally { hideLoader(); }
}

document.getElementById("addCategoryButton")?.addEventListener("click", () => openModal());
document.getElementById("closeCategoryModal")?.addEventListener("click", closeModal);
document.getElementById("cancelCategory")?.addEventListener("click", closeModal);
document.getElementById("categoryModal")?.addEventListener("click", event => { if (event.target.id === "categoryModal") closeModal(); });
document.getElementById("categoryForm")?.addEventListener("submit", saveCategory);
document.getElementById("categoryGroups")?.addEventListener("click", event => { const edit = event.target.closest("[data-edit]"); const toggle = event.target.closest("[data-toggle]"); const del = event.target.closest("[data-delete]"); if (edit) openModal(state.rows.find(x => String(x.id) === String(edit.dataset.edit))); if (toggle) toggleCategory(toggle.dataset.toggle); if (del) deleteCategory(del.dataset.delete); });
sb.auth.onAuthStateChange((event, session) => { if (event === "SIGNED_OUT" || !session) window.location.replace(appUrl("index.html")); });
init();
