import { sb } from "../core/supabase-client.js";
import {
    appUrl,
    setupTheme,
    setupAppMenu,
    setupProfileMenu,
    loadProfileUI,
    formatCurrency,
    formatDate,
    localDateInputValue,
    escapeHtml,
    showToast,
    friendlySupabaseError
} from "../core/app-shared.js";

const ATTACHMENT_BUCKET = "transaction-attachments";
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;

const loader = document.getElementById("pageLoader");
const showLoader = () => loader?.classList.remove("hidden");
const hideLoader = () => loader?.classList.add("hidden");

const state = {
    user: null,
    currency: "INR",
    categories: [],
    vehicles: [],
    goals: [],
    goalContributions: [],
    transactions: [],
    editingId: null,
    existingAttachment: null,
    removeExistingAttachment: false,

    // Recent transaction display pagination
    transactionDisplayLimit: 10
};


function showFormMessage(kind, message) {
    const err = document.getElementById("formError");
    const ok = document.getElementById("formSuccess");

    err?.classList.toggle(
        "hidden",
        kind !== "error"
    );

    ok?.classList.toggle(
        "hidden",
        kind !== "success"
    );

    if (err) {
        err.textContent =
            kind === "error" ? message : "";
    }

    if (ok) {
        ok.textContent =
            kind === "success" ? message : "";
    }
}


function transactionType() {
    return (
        document.querySelector(
            'input[name="transactionType"]:checked'
        )?.value || "expense"
    );
}


function budgetType() {
    return (
        document.querySelector(
            'input[name="budgetType"]:checked'
        )?.value || "needs"
    );
}


function loadCategoriesForType() {
    const type = transactionType();

    const select =
        document.getElementById("category");

    const current = select.value;

    const rows =
        state.categories.filter(
            x =>
                x.is_active &&
                x.category_type === type
        );

    select.innerHTML =
        '<option value="">Select category</option>' +
        rows
            .map(
                x =>
                    `<option value="${x.id}">${escapeHtml(
                        x.name
                    )}</option>`
            )
            .join("");

    if (
        rows.some(
            x => String(x.id) === current
        )
    ) {
        select.value = current;
    }
}


function loadVehiclesIntoSelect(
    selected = ""
) {
    const select =
        document.getElementById("vehicle");

    if (!select) return;

    select.innerHTML =
        '<option value="">No vehicle</option>' +
        state.vehicles
            .map(
                v =>
                    `<option value="${v.id}">${escapeHtml(
                        v.name ||
                        v.brand ||
                        "Vehicle"
                    )}</option>`
            )
            .join("");

    select.value =
        selected &&
            state.vehicles.some(
                v =>
                    String(v.id) ===
                    String(selected)
            )
            ? String(selected)
            : "";
}


/* =========================================================
   GOALS
   ========================================================= */

// async function loadGoals() {
//     const { data, error } = await sb
//         .from("goals")
//         .select("id,name,target_amount")
//         .eq("user_id", state.user.id)
//         .order("name");

//     if (error) throw error;

//     state.goals = data || [];
//     loadGoalsIntoSelect();
// }


async function loadGoals() {

    const { data, error } = await sb
        .from("goals")
        .select(
            "id,name,target_amount,completed_at"
        )
        .eq(
            "user_id",
            state.user.id
        )
        .order("name");

    if (error) throw error;


    const {
        data: contributions,
        error: contributionError
    } = await sb
        .from("goal_contributions")
        .select(
            "goal_id,amount"
        )
        .eq(
            "user_id",
            state.user.id
        );

    if (contributionError)
        throw contributionError;


    state.goals =
        (data || []).map(goal => {

            const saved =
                (contributions || [])
                    .filter(
                        row =>
                            String(row.goal_id) ===
                            String(goal.id)
                    )
                    .reduce(
                        (sum, row) =>
                            sum +
                            Number(
                                row.amount || 0
                            ),
                        0
                    );

            return {
                ...goal,
                saved
            };
        });


    // Load goal-funded expenses so we can calculate remaining goal money
    const {
        data: goalExpenses,
        error: goalExpenseError
    } = await sb
        .from("transactions")
        .select(
            "goal_id,amount"
        )
        .eq(
            "user_id",
            state.user.id
        )
        .eq(
            "transaction_type",
            "expense"
        )
        .not(
            "goal_id",
            "is",
            null
        );

    if (goalExpenseError)
        throw goalExpenseError;


    state.goals =
        state.goals.map(goal => {

            const spent =
                (goalExpenses || [])
                    .filter(
                        row =>
                            String(row.goal_id) ===
                            String(goal.id)
                    )
                    .reduce(
                        (sum, row) =>
                            sum +
                            Number(
                                row.amount || 0
                            ),
                        0
                    );

            return {
                ...goal,
                available: Math.max(
                    0,
                    goal.saved - spent
                )
            };
        });


    loadGoalsIntoSelect();
}


/* =========================================================
   LOAD GOAL CONTRIBUTIONS
   ========================================================= */

async function loadGoalContributions() {

    const {
        data,
        error
    } = await sb
        .from("goal_contributions")
        .select("id, goal_id, amount, contribution_date, note")
        .eq("user_id", state.user.id)
        .order("contribution_date", {
            ascending: false
        })
        .order("id", {
            ascending: false
        });

    if (error) {
        throw error;
    }

    state.goalContributions =
        (data || []).map(row => {

            const goal =
                state.goals.find(
                    g =>
                        String(g.id) ===
                        String(row.goal_id)
                );

            return {
                ...row,
                goal_name:
                    goal?.name ||
                    "Unknown Goal"
            };
        });
}

// function loadGoalsIntoSelect(selected = "") {
//     const select = document.getElementById("goal");
//     if (!select) return;

//     select.innerHTML =
//         '<option value="">Normal expense — not from a goal</option>' +
//         state.goals
//             .map(goal =>
//                 `<option value="${goal.id}">${escapeHtml(goal.name)}</option>`
//             )
//             .join("");

//     if (
//         selected &&
//         state.goals.some(x => String(x.id) === String(selected))
//     ) {
//         select.value = String(selected);
//     } else {
//         select.value = "";
//     }
// }


function loadGoalsIntoSelect(
    selected = ""
) {

    const select =
        document.getElementById("goal");

    if (!select) return;


    const usableGoals =
        state.goals.filter(
            goal =>
                goal.completed_at &&
                Number(
                    goal.available || 0
                ) > 0
        );


    select.innerHTML =
        '<option value="">Normal expense — not from a goal</option>' +
        usableGoals
            .map(
                goal =>
                    `<option value="${goal.id}">${escapeHtml(
                        goal.name
                    )}</option>`
            )
            .join("");


    if (
        selected &&
        usableGoals.some(
            x =>
                String(x.id) ===
                String(selected)
        )
    ) {
        select.value =
            String(selected);
    } else {
        select.value = "";
    }
}


/* =========================================================
   TYPE UI
   ========================================================= */

function updateTypeUI() {

    const type =
        transactionType();


    document
        .getElementById(
            "budgetTypeField"
        )
        ?.classList.toggle(
            "conditional-hidden",
            type !== "expense"
        );


    document
        .getElementById(
            "vehicleField"
        )
        ?.classList.toggle(
            "conditional-hidden",
            type !== "expense"
        );


    document
        .getElementById(
            "goalField"
        )
        ?.classList.toggle(
            "conditional-hidden",
            type !== "expense"
        );


    loadCategoriesForType();
}


/* =========================================================
   LOAD CATEGORIES
   ========================================================= */

async function loadCategories() {

    const {
        data,
        error
    } = await sb
        .from("categories")
        .select(
            "id,name,category_type,is_active,user_id"
        )
        .or(
            `user_id.is.null,user_id.eq.${state.user.id}`
        )
        .order("name");

    if (error) throw error;

    state.categories =
        data || [];

    loadCategoriesForType();
}


/* =========================================================
   LOAD VEHICLES
   ========================================================= */

async function loadVehicles() {

    const {
        data,
        error
    } = await sb
        .from("vehicles")
        .select(
            "id,name,brand,model,vehicle_type,registration_number"
        )
        .eq(
            "user_id",
            state.user.id
        )
        .order("name");

    if (error) throw error;

    state.vehicles =
        data || [];

    loadVehiclesIntoSelect();
}


/* =========================================================
   LOAD TRANSACTIONS
   ========================================================= */

async function loadTransactions() {

    const {
        data,
        error
    } = await sb
        .from("transactions")
        .select(
            "id,transaction_type,amount,category_id,budget_type,goal_id,vehicle_id,transaction_date,description,notes,attachment_path,attachment_name,attachment_size,attachment_type,categories(name),vehicles(name,brand,model)"
        )
        .eq(
            "user_id",
            state.user.id
        )
        .order(
            "transaction_date",
            {
                ascending: false
            }
        )
        .order(
            "id",
            {
                ascending: false
            }
        );

    if (error) throw error;

    /*
     * Keep ALL transactions in state.
     *
     * This is important because Edit,
     * Delete, Search, Filter and
     * Attachment functionality continue
     * using the complete transaction list.
     */
    state.transactions =
        data || [];


    /*
     * Start displaying from first 10.
     */
    state.transactionDisplayLimit =
        10;


    renderTransactions();
}


/* =========================================================
   FILE / ATTACHMENT HELPERS
   ========================================================= */

function formatBytes(bytes) {

    if (
        !Number.isFinite(
            Number(bytes)
        ) ||
        Number(bytes) <= 0
    ) {
        return "";
    }

    const units = [
        "B",
        "KB",
        "MB",
        "GB"
    ];

    let value =
        Number(bytes);

    let i = 0;

    while (
        value >= 1024 &&
        i < units.length - 1
    ) {
        value /= 1024;
        i++;
    }

    return `${value.toFixed(
        value >= 10 || i === 0
            ? 0
            : 1
    )} ${units[i]}`;
}


function setAttachmentError(
    message = ""
) {

    const box =
        document.getElementById(
            "attachmentError"
        );

    box?.classList.toggle(
        "hidden",
        !message
    );

    if (box) {
        box.textContent =
            message;
    }
}


function clearSelectedAttachment() {

    const input =
        document.getElementById(
            "attachment"
        );

    if (input) {
        input.value = "";
    }

    const preview =
        document.getElementById(
            "attachmentPreview"
        );

    preview?.classList.add(
        "hidden"
    );

    setAttachmentError("");
}


function showSelectedAttachment(
    file
) {

    const preview =
        document.getElementById(
            "attachmentPreview"
        );

    if (!file) {
        preview?.classList.add(
            "hidden"
        );

        return;
    }

    document.getElementById(
        "attachmentName"
    ).textContent =
        file.name;

    document.getElementById(
        "attachmentMeta"
    ).textContent =
        `${file.type || "File"} · ${formatBytes(
            file.size
        )}`;

    preview?.classList.remove(
        "hidden"
    );
}


function resetAttachmentState() {

    state.existingAttachment =
        null;

    state.removeExistingAttachment =
        false;

    clearSelectedAttachment();
}


function hasValidAttachmentType(
    file
) {

    return (
        file &&
        (
            file.type.startsWith(
                "image/"
            ) ||
            file.type ===
            "application/pdf"
        )
    );
}


function validateAttachment(
    file
) {

    if (!file) return null;

    if (
        file.size >
        MAX_ATTACHMENT_SIZE
    ) {
        return "Attachment must be 10 MB or smaller.";
    }

    if (
        !hasValidAttachmentType(
            file
        )
    ) {
        return "Please choose an image or PDF attachment.";
    }

    return null;
}


function renderAttachmentForHistory(
    row
) {

    if (!row.attachment_path)
        return "—";

    const name =
        escapeHtml(
            row.attachment_name ||
            "View"
        );

    return `
    <button
      class="row-action attachment-view"
      type="button"
      data-attachment="${row.id}"
    >
      ${name}
    </button>
  `;
}


/* =========================================================
   RENDER TRANSACTIONS
   ========================================================= */

function renderTransactions() {

    const search =
        document
            .getElementById("searchInput")
            .value
            .trim()
            .toLowerCase();

    const filter =
        document.getElementById("typeFilter").value;


    /* =====================================================
       NORMAL TRANSACTIONS
       ===================================================== */

    const transactionRows =
        state.transactions.map(row => ({
            ...row,
            activity_type: "transaction"
        }));


    /* =====================================================
       GOAL CONTRIBUTIONS
       ===================================================== */

    const contributionRows =
        state.goalContributions.map(row => ({
            ...row,

            activity_type:
                "goal_contribution",

            transaction_type:
                "goal_contribution",

            transaction_date:
                row.contribution_date,

            description:
                row.goal_name,

            notes:
                row.note || "",

            amount:
                Number(row.amount || 0)
        }));


    /* =====================================================
       COMBINE BOTH
       ===================================================== */

    const allRows = [
        ...transactionRows,
        ...contributionRows
    ];


    /* =====================================================
       SEARCH + FILTER
       ===================================================== */

    const rows =
        allRows
            .filter(row => {

                const haystack = `
                    ${row.description || ""}
                    ${row.notes || ""}
                    ${row.categories?.name || ""}
                    ${row.vehicles?.name || ""}
                    ${row.goal_name || ""}
                `
                    .toLowerCase();


                const matchesSearch =
                    !search ||
                    haystack.includes(search);


                let matchesFilter = true;


                if (filter === "goal_contribution") {

                    matchesFilter =
                        row.activity_type ===
                        "goal_contribution";

                } else if (filter !== "all") {

                    matchesFilter =
                        row.activity_type ===
                        "transaction" &&
                        row.transaction_type ===
                        filter;
                }


                return (
                    matchesSearch &&
                    matchesFilter
                );
            })
            .sort((a, b) => {

                const dateA =
                    new Date(
                        a.transaction_date
                    ).getTime();

                const dateB =
                    new Date(
                        b.transaction_date
                    ).getTime();


                if (dateB !== dateA) {
                    return dateB - dateA;
                }


                return Number(b.id || 0) -
                    Number(a.id || 0);
            });


    const empty =
        document.getElementById(
            "emptyTransactions"
        );


    empty?.classList.toggle(
        "hidden",
        rows.length > 0
    );


    const visibleRows =
        rows.slice(
            0,
            state.transactionDisplayLimit
        );


    const tableBody =
        document.getElementById(
            "transactionRows"
        );


    tableBody.innerHTML =
        visibleRows
            .map(row => {

                /* Goal contribution row */
                if (
                    row.activity_type ===
                    "goal_contribution"
                ) {

                    return `
                        <tr class="goal-contribution-row">

                            <td>
                                ${escapeHtml(
                        formatDate(
                            row.transaction_date
                        )
                    )}
                            </td>

                            <td>
                                <span class="status-badge type-goal-contribution">
                                    Goal Contribution
                                </span>
                            </td>

                            <td>—</td>

                            <td>—</td>

                            <td>
                                Goal:
                                <strong>
                                    ${escapeHtml(
                        row.goal_name
                    )}
                                </strong>

                                ${row.notes
                            ? `<br><small>${escapeHtml(row.notes)}</small>`
                            : ""
                        }
                            </td>

                            <td class="tx-amount income">
                                +${escapeHtml(
                            formatCurrency(
                                row.amount,
                                state.currency
                            )
                        )}
                            </td>

                            <td>—</td>

                            <td>—</td>

                        </tr>
                    `;
                }


                /* Normal transaction row */
                const label =
                    row.transaction_type[0]
                        .toUpperCase() +
                    row.transaction_type.slice(1);


                const sign =
                    row.transaction_type ===
                        "income"
                        ? "+"
                        : row.transaction_type ===
                            "expense"
                            ? "−"
                            : "↗";


                const vehicle =
                    row.vehicles?.name
                        ? ` · ${escapeHtml(
                            row.vehicles.name
                        )}`
                        : "";


                return `
                    <tr>

                        <td>
                            ${escapeHtml(
                    formatDate(
                        row.transaction_date
                    )
                )}
                        </td>

                        <td>
                            <span
                                class="status-badge type-${row.transaction_type}"
                            >
                                ${escapeHtml(label)}
                            </span>
                        </td>

                        <td>
                            ${escapeHtml(
                    row.categories?.name ||
                    "—"
                )}
                        </td>

                        <td>
                            ${row.transaction_type ===
                        "expense"
                        ? escapeHtml(
                            row.budget_type ===
                                "needs"
                                ? "Need"
                                : "Want"
                        )
                        : "—"
                    }
                        </td>

                        <td>
                            ${escapeHtml(
                        row.description ||
                        row.notes ||
                        "—"
                    )}
                            ${vehicle}
                        </td>

                        <td
                            class="tx-amount ${row.transaction_type ===
                        "income"
                        ? "income"
                        : row.transaction_type ===
                            "savings"
                            ? "saving"
                            : "expense"
                    }"
                        >
                            ${sign}${escapeHtml(
                        formatCurrency(
                            row.amount,
                            state.currency
                        )
                    )}
                        </td>

                        <td>
                            ${renderAttachmentForHistory(
                        row
                    )}
                        </td>

                        <td>
                            <div class="row-actions">

                                <button
                                    class="row-action"
                                    data-edit="${row.id}"
                                >
                                    Edit
                                </button>

                                <button
                                    class="row-action danger"
                                    data-delete="${row.id}"
                                >
                                    Delete
                                </button>

                            </div>
                        </td>

                    </tr>
                `;
            })
            .join("");


    /* =====================================================
       LOAD MORE
       ===================================================== */

    let loadMore =
        document.getElementById(
            "transactionLoadMore"
        );


    if (
        rows.length >
        state.transactionDisplayLimit
    ) {

        if (!loadMore) {

            loadMore =
                document.createElement(
                    "div"
                );

            loadMore.id =
                "transactionLoadMore";

            loadMore.className =
                "transaction-load-more-wrap";

            tableBody
                .parentElement
                ?.parentElement
                ?.appendChild(
                    loadMore
                );
        }


        loadMore.innerHTML = `
            <button
                type="button"
                id="loadMoreTransactions"
                class="transaction-load-more"
                style="font-size:10px;float:right;margin: 0 10px 10px 15px;"
            >
                Load More
            </button>
        `;

        loadMore.classList.remove(
            "hidden"
        );

    } else if (loadMore) {

        loadMore.classList.add(
            "hidden"
        );
    }
}


/* =========================================================
   LOAD MORE TRANSACTIONS
   ========================================================= */

function loadMoreTransactions() {

    /*
     * Add exactly 10 more rows.
     */
    state.transactionDisplayLimit +=
        10;


    renderTransactions();
}


/* =========================================================
   RESET FORM
   ========================================================= */

function resetForm() {

    document
        .getElementById(
            "transactionForm"
        )
        .reset();


    document.querySelector(
        'input[name="transactionType"][value="expense"]'
    ).checked = true;


    document.querySelector(
        'input[name="budgetType"][value="needs"]'
    ).checked = true;


    document.getElementById(
        "transactionDate"
    ).value =
        localDateInputValue();


    loadVehiclesIntoSelect();


    state.editingId =
        null;


    resetAttachmentState();


    document.getElementById(
        "formTitle"
    ).textContent =
        "Add Transaction";


    document.getElementById(
        "saveButton"
    ).textContent =
        "Save Transaction";


    document
        .getElementById(
            "formSuccess"
        )
        ?.classList.add(
            "hidden"
        );


    document
        .getElementById(
            "formError"
        )
        ?.classList.add(
            "hidden"
        );


    updateTypeUI();
}


/* =========================================================
   EXISTING ATTACHMENT
   ========================================================= */

function setExistingAttachment(
    row
) {

    state.existingAttachment =
        row?.attachment_path
            ? {
                path:
                    row.attachment_path,
                name:
                    row.attachment_name,
                size:
                    row.attachment_size,
                type:
                    row.attachment_type
            }
            : null;


    state.removeExistingAttachment =
        false;


    const preview =
        document.getElementById(
            "attachmentPreview"
        );


    if (
        state.existingAttachment
    ) {

        document.getElementById(
            "attachmentName"
        ).textContent =
            state.existingAttachment.name ||
            "Existing attachment";


        document.getElementById(
            "attachmentMeta"
        ).textContent =
            `Saved attachment${state.existingAttachment.size
                ? ` · ${formatBytes(
                    state.existingAttachment.size
                )}`
                : ""
            }`;


        preview?.classList.remove(
            "hidden"
        );

    } else {

        preview?.classList.add(
            "hidden"
        );
    }
}


/* =========================================================
   EDIT TRANSACTION
   ========================================================= */

function loadForEdit(id) {

    const row =
        state.transactions.find(
            x =>
                String(x.id) ===
                String(id)
        );


    if (!row) return;


    state.editingId =
        row.id;


    document.getElementById(
        "formTitle"
    ).textContent =
        "Edit Transaction";


    document.getElementById(
        "saveButton"
    ).textContent =
        "Update Transaction";


    document
        .querySelectorAll(
            'input[name="transactionType"]'
        )
        .forEach(
            x =>
            (x.checked =
                x.value ===
                row.transaction_type)
        );


    updateTypeUI();


    document.getElementById(
        "amount"
    ).value =
        row.amount;


    document.getElementById(
        "category"
    ).value =
        row.category_id;


    document
        .querySelectorAll(
            'input[name="budgetType"]'
        )
        .forEach(
            x =>
            (x.checked =
                x.value ===
                (row.budget_type ||
                    "needs"))
        );


    loadVehiclesIntoSelect(
        row.vehicle_id || ""
    );


    loadGoalsIntoSelect(
        row.goal_id || ""
    );


    document.getElementById(
        "transactionDate"
    ).value =
        row.transaction_date;


    document.getElementById(
        "description"
    ).value =
        row.description || "";


    document.getElementById(
        "notes"
    ).value =
        row.notes || "";


    document.getElementById(
        "attachment"
    ).value = "";


    setAttachmentError("");


    setExistingAttachment(
        row
    );


    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}


/* =========================================================
   STORAGE
   ========================================================= */

function buildStoragePath(
    transactionId,
    file
) {

    const extension =
        (
            file.name.includes(".")
                ? file.name
                    .split(".")
                    .pop()
                : "bin"
        )
            .toLowerCase()
            .replace(
                /[^a-z0-9]/g,
                ""
            )
            .slice(0, 8) ||
        "bin";


    const token =
        crypto.randomUUID
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random()
                .toString(36)
                .slice(2)}`;


    return `${state.user.id}/${transactionId}/${token}.${extension}`;
}


async function uploadAttachment(
    transactionId,
    file
) {

    const path =
        buildStoragePath(
            transactionId,
            file
        );


    const {
        error
    } = await sb.storage
        .from(
            ATTACHMENT_BUCKET
        )
        .upload(
            path,
            file,
            {
                contentType:
                    file.type ||
                    "application/octet-stream",
                upsert: false
            }
        );


    if (error) throw error;


    return {
        path,
        name: file.name,
        size: file.size,
        type:
            file.type || null
    };
}


async function deleteStorageFile(
    path
) {

    if (!path) return;

    const {
        error
    } = await sb.storage
        .from(
            ATTACHMENT_BUCKET
        )
        .remove([path]);


    if (error)
        console.warn(
            "Attachment cleanup failed:",
            error
        );
}


/* =========================================================
   SAVE TRANSACTION
   ========================================================= */

async function saveTransaction(
    event
) {

    event.preventDefault();


    showFormMessage(
        "success",
        ""
    );


    document
        .getElementById(
            "formError"
        )
        ?.classList.add(
            "hidden"
        );


    setAttachmentError("");


    const type =
        transactionType();


    const amount =
        Number(
            document.getElementById(
                "amount"
            ).value
        );


    const categoryId =
        document.getElementById(
            "category"
        ).value;


    const date =
        document.getElementById(
            "transactionDate"
        ).value;


    const description =
        document.getElementById(
            "description"
        ).value.trim();


    const notes =
        document.getElementById(
            "notes"
        ).value.trim();


    const vehicleId =
        type === "expense"
            ? (
                document.getElementById(
                    "vehicle"
                )?.value || ""
            )
            : "";


    const goalId =
        type === "expense"
            ? (
                document.getElementById(
                    "goal"
                )?.value || ""
            )
            : "";


    const file =
        document.getElementById(
            "attachment"
        )?.files?.[0] ||
        null;


    const attachmentError =
        validateAttachment(
            file
        );


    if (attachmentError) {

        setAttachmentError(
            attachmentError
        );

        return showFormMessage(
            "error",
            attachmentError
        );
    }


    if (
        !Number.isFinite(
            amount
        ) ||
        amount < 1
    ) {
        return showFormMessage(
            "error",
            "Amount must be at least 1."
        );
    }


    if (!categoryId) {

        return showFormMessage(
            "error",
            "Please select a category."
        );
    }


    if (!date) {

        return showFormMessage(
            "error",
            "Please select a date."
        );
    }


    const today =
        localDateInputValue();


    if (date > today) {

        return showFormMessage(
            "error",
            "Future transaction dates are not allowed. Please choose today or an earlier date."
        );
    }


    const category =
        state.categories.find(
            x =>
                String(x.id) ===
                String(categoryId)
        );


    if (
        !category ||
        category.category_type !==
        type ||
        !category.is_active
    ) {

        return showFormMessage(
            "error",
            "Please select a valid active category."
        );
    }


    const vehicle =
        vehicleId
            ? state.vehicles.find(
                v =>
                    String(v.id) ===
                    String(vehicleId)
            )
            : null;


    if (
        vehicleId &&
        !vehicle
    ) {

        return showFormMessage(
            "error",
            "Please select a valid vehicle."
        );
    }


    /* =======================================================
       GOAL MONEY VALIDATION
       ======================================================= */

    if (
        type === "expense" &&
        goalId
    ) {

        const goal =
            state.goals.find(
                g =>
                    String(g.id) ===
                    String(goalId)
            );


        if (!goal) {

            return showFormMessage(
                "error",
                "Please select a valid goal."
            );
        }


        const available =
            Number(
                goal.available || 0
            );


        if (
            available <= 0
        ) {

            return showFormMessage(
                "error",
                "This goal has no available money."
            );
        }


        if (
            amount > available
        ) {

            return showFormMessage(
                "error",
                `Goal expense cannot exceed the available ${formatCurrency(
                    available,
                    state.currency
                )}.`
            );
        }
    }


    const payload = {

        user_id:
            state.user.id,

        transaction_type:
            type,

        amount,

        category_id:
            Number(categoryId),

        budget_type:
            type === "expense"
                ? budgetType()
                : null,

        goal_id:
            type === "expense" &&
                goalId
                ? Number(goalId)
                : null,

        vehicle_id:
            type === "expense" &&
                vehicleId
                ? Number(vehicleId)
                : null,

        transaction_date:
            date,

        description:
            description || null,

        notes:
            notes || null
    };


    const button =
        document.getElementById(
            "saveButton"
        );


    button.disabled =
        true;


    showLoader();


    let createdId =
        null;


    let uploadedPath =
        null;


    try {

        let result;


        if (state.editingId) {

            result =
                await sb
                    .from("transactions")
                    .update(
                        payload
                    )
                    .eq(
                        "id",
                        state.editingId
                    )
                    .eq(
                        "user_id",
                        state.user.id
                    )
                    .select(
                        "id,attachment_path,attachment_name,attachment_size,attachment_type"
                    )
                    .maybeSingle();

        } else {

            result =
                await sb
                    .from("transactions")
                    .insert(
                        payload
                    )
                    .select("id")
                    .maybeSingle();
        }


        if (result.error)
            throw result.error;


        createdId =
            state.editingId ||
            result.data?.id;


        if (!createdId) {

            throw new Error(
                "Transaction was saved but no transaction id was returned."
            );
        }


        const oldPath =
            state.existingAttachment?.path ||
            result.data?.attachment_path ||
            null;


        let metadata =
            null;


        if (file) {

            metadata =
                await uploadAttachment(
                    createdId,
                    file
                );


            uploadedPath =
                metadata.path;


            const {
                error
            } = await sb
                .from("transactions")
                .update({
                    attachment_path:
                        metadata.path,

                    attachment_name:
                        metadata.name,

                    attachment_size:
                        metadata.size,

                    attachment_type:
                        metadata.type
                })
                .eq(
                    "id",
                    createdId
                )
                .eq(
                    "user_id",
                    state.user.id
                );


            if (error)
                throw error;


            if (oldPath)
                await deleteStorageFile(
                    oldPath
                );

        } else if (
            state.editingId &&
            state.removeExistingAttachment &&
            oldPath
        ) {

            const {
                error
            } = await sb
                .from("transactions")
                .update({
                    attachment_path:
                        null,

                    attachment_name:
                        null,

                    attachment_size:
                        null,

                    attachment_type:
                        null
                })
                .eq(
                    "id",
                    createdId
                )
                .eq(
                    "user_id",
                    state.user.id
                );


            if (error)
                throw error;


            await deleteStorageFile(
                oldPath
            );
        }


        showToast(
            state.editingId
                ? "Transaction updated."
                : "Transaction added."
        );


        resetForm();


        await loadTransactions();

    } catch (error) {

        console.error(
            error
        );


        if (
            uploadedPath
        ) {
            await deleteStorageFile(
                uploadedPath
            );
        }


        if (
            !state.editingId &&
            createdId
        ) {

            await sb
                .from("transactions")
                .delete()
                .eq(
                    "id",
                    createdId
                )
                .eq(
                    "user_id",
                    state.user.id
                );
        }


        showFormMessage(
            "error",
            friendlySupabaseError(
                error
            )
        );

    } finally {

        button.disabled =
            false;

        hideLoader();
    }
}


/* =========================================================
   DELETE TRANSACTION
   ========================================================= */

async function deleteTransaction(
    id
) {

    const row =
        state.transactions.find(
            x =>
                String(x.id) ===
                String(id)
        );


    if (!row) return;


    if (
        !window.confirm(
            `Delete this ${row.transaction_type} of ${formatCurrency(
                row.amount,
                state.currency
            )}?`
        )
    ) {
        return;
    }


    showLoader();


    try {

        const {
            error
        } = await sb
            .from("transactions")
            .delete()
            .eq(
                "id",
                id
            )
            .eq(
                "user_id",
                state.user.id
            );


        if (error)
            throw error;


        if (
            row.attachment_path
        ) {
            await deleteStorageFile(
                row.attachment_path
            );
        }


        if (
            String(
                state.editingId
            ) ===
            String(id)
        ) {
            resetForm();
        }


        await loadTransactions();


        showToast(
            "Transaction deleted."
        );

    } catch (error) {

        console.error(
            error
        );


        showToast(
            friendlySupabaseError(
                error
            ),
            "error"
        );

    } finally {

        hideLoader();
    }
}


/* =========================================================
   VIEW ATTACHMENT
   ========================================================= */

async function viewAttachment(
    id
) {

    const row =
        state.transactions.find(
            x =>
                String(x.id) ===
                String(id)
        );


    if (
        !row?.attachment_path
    ) {
        return;
    }


    try {

        const {
            data,
            error
        } = await sb.storage
            .from(
                ATTACHMENT_BUCKET
            )
            .createSignedUrl(
                row.attachment_path,
                60 * 60
            );


        if (error)
            throw error;


        if (
            data?.signedUrl
        ) {

            window.open(
                data.signedUrl,
                "_blank",
                "noopener,noreferrer"
            );

        } else {

            throw new Error(
                "Could not generate a secure attachment link."
            );
        }

    } catch (error) {

        console.error(
            error
        );


        showToast(
            friendlySupabaseError(
                error
            ),
            "error"
        );
    }
}


/* =========================================================
   INITIALIZE
   ========================================================= */

async function init() {

    setupAppMenu();

    setupTheme();

    setupProfileMenu();

    showLoader();


    try {

        const profile =
            await loadProfileUI();


        state.user =
            profile.user;


        state.currency =
            profile.currency;


        await Promise.all([
            loadCategories(),
            loadVehicles(),
            loadGoals()
        ]);

        await loadGoalContributions();


        const transactionDate =
            document.getElementById(
                "transactionDate"
            );


        transactionDate.value =
            localDateInputValue();


        transactionDate.max =
            localDateInputValue();


        const type =
            new URLSearchParams(
                window.location.search
            ).get("type");


        if (
            [
                "expense",
                "income",
                "savings"
            ].includes(type)
        ) {

            document.querySelector(
                `input[name="transactionType"][value="${type}"]`
            ).checked = true;
        }


        updateTypeUI();


        await loadTransactions();

    } catch (error) {

        if (
            String(error?.message) !==
            "AUTH_REQUIRED"
        ) {

            console.error(
                error
            );

            showToast(
                friendlySupabaseError(
                    error
                ),
                "error"
            );
        }

    } finally {

        hideLoader();
    }
}


/* =========================================================
   FORM EVENTS
   ========================================================= */

document
    .querySelectorAll(
        'input[name="transactionType"]'
    )
    .forEach(
        i =>
            i.addEventListener(
                "change",
                updateTypeUI
            )
    );


document
    .getElementById(
        "transactionForm"
    )
    ?.addEventListener(
        "submit",
        saveTransaction
    );


document
    .getElementById(
        "clearButton"
    )
    ?.addEventListener(
        "click",
        resetForm
    );


/* =========================================================
   SEARCH
   ========================================================= */

document
    .getElementById(
        "searchInput"
    )
    ?.addEventListener(
        "input",
        () => {

            /*
             * When search changes,
             * start again from first 10
             * matching transactions.
             */
            state.transactionDisplayLimit =
                10;

            renderTransactions();
        }
    );


/* =========================================================
   FILTER
   ========================================================= */

document
    .getElementById(
        "typeFilter"
    )
    ?.addEventListener(
        "change",
        () => {

            /*
             * When filter changes,
             * start again from first 10
             * matching transactions.
             */
            state.transactionDisplayLimit =
                10;

            renderTransactions();
        }
    );


/* =========================================================
   ATTACHMENT SELECT
   ========================================================= */

document
    .getElementById(
        "attachment"
    )
    ?.addEventListener(
        "change",
        event => {

            const file =
                event.target.files?.[0] ||
                null;


            if (!file) {

                setAttachmentError("");

                return;
            }


            const error =
                validateAttachment(
                    file
                );


            if (error) {

                event.target.value =
                    "";

                setAttachmentError(
                    error
                );

                showToast(
                    error,
                    "warning"
                );

                return;
            }


            state.removeExistingAttachment =
                false;


            showSelectedAttachment(
                file
            );


            setAttachmentError("");
        }
    );


/* =========================================================
   REMOVE ATTACHMENT
   ========================================================= */

document
    .getElementById(
        "attachmentRemove"
    )
    ?.addEventListener(
        "click",
        () => {

            const hasExisting =
                !!state.existingAttachment &&
                state.editingId;


            clearSelectedAttachment();


            if (hasExisting) {

                state.removeExistingAttachment =
                    true;
            }
        }
    );


/* =========================================================
   TRANSACTION TABLE EVENTS
   ========================================================= */

document
    .getElementById(
        "transactionRows"
    )
    ?.addEventListener(
        "click",
        e => {

            const edit =
                e.target.closest(
                    "[data-edit]"
                );


            const del =
                e.target.closest(
                    "[data-delete]"
                );


            const attachment =
                e.target.closest(
                    "[data-attachment]"
                );


            if (edit) {

                loadForEdit(
                    edit.dataset.edit
                );
            }


            if (del) {

                deleteTransaction(
                    del.dataset.delete
                );
            }


            if (attachment) {

                viewAttachment(
                    attachment.dataset.attachment
                );
            }
        }
    );


/* =========================================================
   LOAD MORE BUTTON
   =========================================================

   The button is created dynamically
   by renderTransactions(), so event
   delegation is used here.
   ========================================================= */

document.addEventListener(
    "click",
    event => {

        const button =
            event.target.closest(
                "#loadMoreTransactions"
            );


        if (!button) return;


        loadMoreTransactions();
    }
);


/* =========================================================
   AUTH
   ========================================================= */

sb.auth.onAuthStateChange(
    (
        event,
        session
    ) => {

        if (
            event ===
            "SIGNED_OUT" ||
            !session
        ) {

            window.location.replace(
                appUrl(
                    "index.html"
                )
            );
        }
    }
);


/* =========================================================
   START
   ========================================================= */

init();