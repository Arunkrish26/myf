import { sb } from "../core/supabase-client.js";
import { appUrl, setupTheme, setupAppMenu, setupProfileMenu, loadProfileUI, requireUser, formatCurrency, formatDate, monthBounds, transactionIcon, transactionClass, escapeHtml, showToast, friendlySupabaseError } from "../core/app-shared.js";

const loader = document.getElementById("pageLoader");
const showLoader = () => loader?.classList.remove("hidden");
const hideLoader = () => loader?.classList.add("hidden");

/* =========================================================
   RECENT TRANSACTIONS PAGINATION
   ========================================================= */

const recentState = {
    userId: null,
    currency: "INR",
    rows: [],
    offset: 0,
    pageSize: 10,
    hasMore: true,
    loading: false
};


function monthStartEnd() {
    return monthBounds(new Date());
    // return monthBounds(new Date("2026-10-01"));
}


// function monthStartEnd() {
//     const testDate = new Date(2026, 9, 1);

//     console.log("TEST DATE:", testDate);
//     console.log("MONTH BOUNDS:", monthBounds(testDate));

//     return monthBounds(testDate);
// }

function currentMonthKey() {
    return monthStartEnd().start;
}

function getPreviousMonthKey(monthKey) {

    const [year, month] =
        String(monthKey)
            .split("-")
            .map(Number);

    if (!year || !month) {
        throw new Error(
            "Invalid month key: " + monthKey
        );
    }

    if (month === 1) {
        return `${year - 1}-12-01`;
    }

    return `${year}-${String(month - 1).padStart(2, "0")}-01`;
}

async function calculateMonthClosingBalance(
    userId,
    monthKey,
    visited = new Set()
) {

    // Prevent accidental infinite recursion
    if (visited.has(monthKey)) {
        return 0;
    }

    visited.add(monthKey);


    // ============================================
    // 1. Check whether this month already has
    //    a previous balance
    // ============================================

    const {
        data: budget,
        error: budgetError
    } = await sb
        .from("monthly_budgets")
        .select(
            "previous_balance"
        )
        .eq(
            "user_id",
            userId
        )
        .eq(
            "month",
            monthKey
        )
        .maybeSingle();

    if (budgetError) {
        throw budgetError;
    }


    let previousBalance;


    // ============================================
    // 2. If this month already has a previous
    //    balance, use it.
    // ============================================

    if (budget) {

        previousBalance =
            Math.max(
                0,
                Number(
                    budget.previous_balance || 0
                )
            );

    } else {

        // ========================================
        // 3. No previous balance for this month.
        //    Automatically get previous month's
        //    closing balance.
        // ========================================

        const previousMonth =
            getPreviousMonthKey(
                monthKey
            );

        previousBalance =
            await calculateMonthClosingBalance(
                userId,
                previousMonth,
                visited
            );
    }


    // ============================================
    // 4. Get next month boundary
    // ============================================

    const [year, month] =
        monthKey
            .split("-")
            .map(Number);

    const nextMonthDate =
        month === 12
            ? `${year + 1}-01-01`
            : `${year}-${String(month + 1).padStart(2, "0")}-01`;


    // ============================================
    // 5. Get transactions for this month
    // ============================================

    const {
        data: transactions,
        error: transactionError
    } = await sb
        .from("transactions")
        .select(
            "transaction_type, amount, goal_id"
        )
        .eq(
            "user_id",
            userId
        )
        .gte(
            "transaction_date",
            monthKey
        )
        .lt(
            "transaction_date",
            nextMonthDate
        );

    if (transactionError) {
        throw transactionError;
    }


    // ============================================
    // 6. Income
    // ============================================

    const income =
        (transactions || [])
            .filter(
                row =>
                    row.transaction_type ===
                    "income"
            )
            .reduce(
                (sum, row) =>
                    sum +
                    Number(
                        row.amount || 0
                    ),
                0
            );


    // ============================================
    // 7. Normal expenses
    //
    // Goal-funded expenses are excluded because
    // the money was already deducted when it was
    // contributed to the goal.
    // ============================================

    const expenses =
        (transactions || [])
            .filter(
                row =>
                    row.transaction_type ===
                    "expense" &&
                    !row.goal_id
            )
            .reduce(
                (sum, row) =>
                    sum +
                    Number(
                        row.amount || 0
                    ),
                0
            );


    // ============================================
    // 8. Normal savings transactions
    // ============================================

    const savingsTransactions =
        (transactions || [])
            .filter(
                row =>
                    row.transaction_type ===
                    "savings"
            )
            .reduce(
                (sum, row) =>
                    sum +
                    Number(
                        row.amount || 0
                    ),
                0
            );


    // ============================================
    // 9. Goal contributions
    // ============================================

    const {
        data: goalContributions,
        error: goalError
    } = await sb
        .from("goal_contributions")
        .select(
            "amount"
        )
        .eq(
            "user_id",
            userId
        )
        .gte(
            "contribution_date",
            monthKey
        )
        .lt(
            "contribution_date",
            nextMonthDate
        );

    if (goalError) {
        throw goalError;
    }


    const goalContributionTotal =
        (goalContributions || [])
            .reduce(
                (sum, row) =>
                    sum +
                    Number(
                        row.amount || 0
                    ),
                0
            );


    // ============================================
    // 10. Closing balance
    // ============================================

    const closingBalance =
        previousBalance +
        income -
        expenses -
        savingsTransactions -
        goalContributionTotal;


    return Math.max(
        0,
        closingBalance
    );
}





async function fetchMonthlyBudget(userId) {

    const month =
        currentMonthKey();


    // ============================================
    // Check current month's budget
    // ============================================

    const {
        data,
        error
    } = await sb
        .from("monthly_budgets")
        .select(
            "id,month,previous_balance"
        )
        .eq(
            "user_id",
            userId
        )
        .eq(
            "month",
            month
        )
        .maybeSingle();

    if (error) {
        throw error;
    }


    // ============================================
    // Current month already has a balance.
    // Don't overwrite it.
    // ============================================

    if (data) {

        return data;
    }


    // ============================================
    // NEW MONTH
    //
    // Automatically calculate previous month's
    // closing balance.
    // ============================================

    const previousBalance =
        await calculateMonthClosingBalance(
            userId,
            getPreviousMonthKey(month)
        );


    // ============================================
    // Create current month's budget row
    // ============================================

    const {
        data: created,
        error: createError
    } = await sb
        .from("monthly_budgets")
        .upsert(
            {
                user_id: userId,
                month: month,
                previous_balance:
                    previousBalance
            },
            {
                onConflict:
                    "user_id,month"
            }
        )
        .select(
            "id,month,previous_balance"
        )
        .single();

    if (createError) {
        throw createError;
    }


    return created;
}

async function fetchMonthGoalContributions(userId) {
    const bounds = monthStartEnd();

    const { data, error } = await sb.from("goal_contributions")
        .select("amount, contribution_date")
        .eq("user_id", userId)
        .gte("contribution_date", bounds.start)
        .lt("contribution_date", bounds.endExclusive);

    if (error) throw error;

    return data || [];
}


/* =========================================================
   GOAL SAVINGS
   ========================================================= */

// async function fetchGoalSavings(userId) {
//     const { data: contributions, error: contributionError } = await sb
//         .from("goal_contributions")
//         .select("goal_id, amount")
//         .eq("user_id", userId);

//     if (contributionError) throw contributionError;

//     const { data: goalExpenses, error: expenseError } = await sb
//         .from("transactions")
//         .select("goal_id, amount")
//         .eq("user_id", userId)
//         .eq("transaction_type", "expense")
//         .not("goal_id", "is", null);

//     if (expenseError) throw expenseError;

//     const totalContributions = (contributions || []).reduce((sum, row) => {
//         const amount = Number(row.amount);
//         return sum + (Number.isFinite(amount) ? amount : 0);
//     }, 0);

//     const totalGoalExpenses = (goalExpenses || []).reduce((sum, row) => {
//         const amount = Number(row.amount);
//         return sum + (Number.isFinite(amount) ? amount : 0);
//     }, 0);

//     console.log("GOAL CONTRIBUTIONS:", contributions);
//     console.log("GOAL EXPENSES:", goalExpenses);
//     console.log("TOTAL CONTRIBUTIONS:", totalContributions);
//     console.log("TOTAL GOAL EXPENSES:", totalGoalExpenses);

//     return Math.max(0, totalContributions - totalGoalExpenses);
// }


async function fetchGoalSavings(userId) {
    const { data: contributions, error: contributionError } = await sb
        .from("goal_contributions")
        .select("goal_id, amount")
        .eq("user_id", userId);

    if (contributionError) throw contributionError;

    const { data: goalExpenses, error: expenseError } = await sb
        .from("transactions")
        .select("goal_id, amount")
        .eq("user_id", userId)
        .eq("transaction_type", "expense")
        .not("goal_id", "is", null);

    if (expenseError) throw expenseError;

    const goalTotals = {};

    // Add contributions goal by goal
    (contributions || []).forEach(row => {
        const goalId = String(row.goal_id);

        if (!goalTotals[goalId]) {
            goalTotals[goalId] = {
                contributed: 0,
                spent: 0
            };
        }

        const amount = Number(row.amount);

        if (Number.isFinite(amount)) {
            goalTotals[goalId].contributed += amount;
        }
    });

    // Add goal expenses goal by goal
    (goalExpenses || []).forEach(row => {
        const goalId = String(row.goal_id);

        if (!goalTotals[goalId]) {
            goalTotals[goalId] = {
                contributed: 0,
                spent: 0
            };
        }

        const amount = Number(row.amount);

        if (Number.isFinite(amount)) {
            goalTotals[goalId].spent += amount;
        }
    });

    // Calculate available savings separately for each goal
    const totalGoalSavings = Object.values(goalTotals).reduce(
        (total, goal) => {
            const available = Math.max(
                0,
                goal.contributed - goal.spent
            );

            return total + available;
        },
        0
    );

    console.log("GOAL TOTALS:", goalTotals);
    console.log("FINAL GOAL SAVINGS:", totalGoalSavings);

    return totalGoalSavings;
}


async function fetchMonthTransactions(userId) {
    const bounds = monthStartEnd();

    const { data, error } = await sb.from("transactions")
        .select("id, transaction_type, amount, category_id,goal_id, transaction_date, description, budget_type, categories(name)")
        .eq("user_id", userId)
        .gte("transaction_date", bounds.start)
        .lt("transaction_date", bounds.endExclusive)
        .order("transaction_date", { ascending: false })
        .order("id", { ascending: false });

    if (error) throw error;

    return data || [];
}


/* =========================================================
   RECENT TRANSACTIONS
   10 RECORDS AT A TIME
   ========================================================= */

// async function fetchRecent(userId, offset = 0) {

//     // ============================================
//     // 1. Fetch normal transactions
//     // ============================================
//     const { data: transactions, error: transactionError } = await sb
//         .from("transactions")
//         .select(
//             "id, transaction_type, amount, transaction_date, description, budget_type, categories(name)"
//         )
//         .eq("user_id", userId);

//     if (transactionError) throw transactionError;


//     // ============================================
//     // 2. Fetch goal contributions
//     // ============================================
//     const { data: contributions, error: contributionError } = await sb
//         .from("goal_contributions")
//         .select(
//             "id, goal_id, amount, contribution_date, note"
//         )
//         .eq("user_id", userId);

//     if (contributionError) throw contributionError;


//     // ============================================
//     // 3. Get goal names
//     // ============================================
//     const goalIds = [
//         ...new Set(
//             (contributions || [])
//                 .map(x => x.goal_id)
//                 .filter(Boolean)
//         )
//     ];

//     let goals = [];

//     if (goalIds.length > 0) {

//         const { data: goalData, error: goalError } = await sb
//             .from("goals")
//             .select("id, name")
//             .in("id", goalIds);

//         if (goalError) throw goalError;

//         goals = goalData || [];
//     }


//     // ============================================
//     // 4. Convert normal transactions
//     // ============================================
//     const transactionRows = (transactions || []).map(row => ({
//         ...row,
//         activity_type: "transaction",
//         activity_date: row.transaction_date
//     }));


//     // ============================================
//     // 5. Convert goal contributions
//     // ============================================
//     const contributionRows = (contributions || []).map(row => {

//         const goal = goals.find(
//             g => String(g.id) === String(row.goal_id)
//         );

//         return {
//             ...row,
//             activity_type: "goal_contribution",
//             transaction_type: "goal_contribution",
//             activity_date: row.contribution_date,
//             goal_name: goal?.name || "Unknown Goal",
//             categories: null
//         };
//     });


//     // ============================================
//     // 6. Combine both
//     // ============================================
//     const allRows = [
//         ...transactionRows,
//         ...contributionRows
//     ];


//     // ============================================
//     // 7. Sort newest first
//     // ============================================
//     allRows.sort((a, b) => {

//         const dateA =
//             new Date(a.activity_date).getTime();

//         const dateB =
//             new Date(b.activity_date).getTime();

//         return dateB - dateA;
//     });


//     // ============================================
//     // 8. Pagination
//     // ============================================
//     const result = allRows.slice(
//         offset,
//         offset + recentState.pageSize + 1
//     );


//     const hasMore =
//         result.length > recentState.pageSize;


//     return {
//         rows: result.slice(
//             0,
//             recentState.pageSize
//         ),
//         hasMore
//     };
// }

async function fetchRecent(userId, offset = 0) {

    // ============================================
    // 1. Fetch normal transactions
    // ============================================

    const {
        data: transactions,
        error: transactionError
    } = await sb
        .from("transactions")
        .select(
            "id, transaction_type, amount, transaction_date, created_at, description, budget_type, categories(name)"
        )
        .eq("user_id", userId);

    if (transactionError) throw transactionError;


    // ============================================
    // 2. Fetch goal contributions
    // ============================================

    const {
        data: contributions,
        error: contributionError
    } = await sb
        .from("goal_contributions")
        .select(
            "id, goal_id, amount, contribution_date, created_at, note"
        )
        .eq("user_id", userId);

    if (contributionError) throw contributionError;


    // ============================================
    // 3. Get goal names
    // ============================================

    const goalIds = [
        ...new Set(
            (contributions || [])
                .map(x => x.goal_id)
                .filter(Boolean)
        )
    ];

    let goals = [];

    if (goalIds.length > 0) {

        const {
            data: goalData,
            error: goalError
        } = await sb
            .from("goals")
            .select("id, name")
            .in("id", goalIds);

        if (goalError) throw goalError;

        goals = goalData || [];
    }


    // ============================================
    // 4. Convert normal transactions
    // ============================================

    const transactionRows = (transactions || []).map(row => ({

        ...row,

        activity_type: "transaction",

        // Main sorting value
        activity_date: row.transaction_date,

        // Exact creation time
        activity_created_at:
            row.created_at || row.transaction_date

    }));


    // ============================================
    // 5. Convert goal contributions
    // ============================================

    const contributionRows = (contributions || []).map(row => {

        const goal = goals.find(
            g => String(g.id) === String(row.goal_id)
        );

        return {

            ...row,

            activity_type: "goal_contribution",

            transaction_type: "goal_contribution",

            activity_date: row.contribution_date,

            // Exact creation time
            activity_created_at:
                row.created_at || row.contribution_date,

            goal_name:
                goal?.name || "Unknown Goal",

            categories: null

        };

    });


    // ============================================
    // 6. Combine both
    // ============================================

    const allRows = [
        ...transactionRows,
        ...contributionRows
    ];


    // ============================================
    // 7. SORT NEWEST FIRST
    //
    // First priority:
    //     created_at
    //
    // Second priority:
    //     transaction/contribution date
    //
    // Third priority:
    //     id
    //
    // This keeps the newest activity at the top.
    // ============================================

    allRows.sort((a, b) => {

        const createdA =
            new Date(a.activity_created_at).getTime();

        const createdB =
            new Date(b.activity_created_at).getTime();

        // 1. Exact creation time
        if (
            Number.isFinite(createdA) &&
            Number.isFinite(createdB) &&
            createdA !== createdB
        ) {
            return createdB - createdA;
        }


        // 2. Transaction / contribution date
        const dateA =
            new Date(a.activity_date).getTime();

        const dateB =
            new Date(b.activity_date).getTime();

        if (
            Number.isFinite(dateA) &&
            Number.isFinite(dateB) &&
            dateA !== dateB
        ) {
            return dateB - dateA;
        }


        // 3. Final fallback
        const idA = Number(a.id || 0);
        const idB = Number(b.id || 0);

        return idB - idA;

    });


    // ============================================
    // 8. Pagination
    // ============================================

    const result = allRows.slice(
        offset,
        offset + recentState.pageSize + 1
    );


    const hasMore =
        result.length > recentState.pageSize;


    return {

        rows: result.slice(
            0,
            recentState.pageSize
        ),

        hasMore

    };
}
function amountFor(rows, type) {
    return rows
        .filter(x => x.transaction_type === type)
        .reduce(
            (sum, x) => sum + Number(x.amount || 0),
            0
        );
}


function expenseByBudget(rows, budgetType) {
    return rows
        .filter(
            x =>
                x.transaction_type === "expense" &&
                !x.goal_id &&
                x.budget_type === budgetType
        )
        .reduce(
            (sum, x) => sum + Number(x.amount || 0),
            0
        );
}


function setProgress(id, textId, percent) {
    const safe = Math.max(
        0,
        Math.min(100, Number(percent) || 0)
    );

    document.getElementById(id).style.width =
        `${safe}%`;

    document.getElementById(textId).textContent =
        `${Math.round(Number(percent) || 0)}%`;
}


/* =========================================================
   RENDER RECENT TRANSACTIONS
   ========================================================= */

function renderRecent(rows, currency) {

    const target =
        document.getElementById("recentTransactions");

    if (!target) return;

    if (!rows.length) {
        target.innerHTML = `
      <div class="empty-state">
        <strong>No transactions yet</strong>
        Add your first income or expense to see it here.
      </div>
    `;

        return;
    }

    const transactionHtml = rows
        .map(row => {

            // ============================================
            // GOAL CONTRIBUTION
            // ============================================
            if (row.activity_type === "goal_contribution") {

                return `
                <div class="transaction-row">

                    <div class="tx-icon icon-savings">
                        ↗
                    </div>

                    <div class="tx-main">

                        <strong>
                            Goal Contribution
                        </strong>

                        <span>
                            ${escapeHtml(
                    formatDate(
                        row.contribution_date
                    )
                )}
                            · Goal:
                            ${escapeHtml(
                    row.goal_name ||
                    "Unknown Goal"
                )}

                            ${row.note
                        ? ` · ${escapeHtml(row.note)}`
                        : ""
                    }
                        </span>

                    </div>

                    <div class="tx-amount positive">

                        +
                        ${escapeHtml(
                        formatCurrency(
                            row.amount,
                            currency
                        )
                    )}

                    </div>

                </div>
            `;
            }


            // ============================================
            // NORMAL TRANSACTION
            // ============================================

            const type =
                row.transaction_type;

            const label =
                row.description?.trim() ||
                row.categories?.name ||
                (
                    type === "income"
                        ? "Income"
                        : type === "savings"
                            ? "Savings"
                            : "Expense"
                );

            const prefix =
                type === "income"
                    ? "+"
                    : type === "savings"
                        ? "↗"
                        : "−";

            return `
            <div class="transaction-row">

                <div class="tx-icon icon-${type}">
                    ${transactionIcon(type)}
                </div>

                <div class="tx-main">

                    <strong>
                        ${escapeHtml(label)}
                    </strong>

                    <span>
                        ${escapeHtml(
                formatDate(
                    row.transaction_date
                )
            )}
                        ·
                        ${escapeHtml(
                row.categories?.name ||
                "Uncategorized"
            )}
                    </span>

                </div>

                <div class="tx-amount ${transactionClass(type)}">

                    ${prefix}

                    ${escapeHtml(
                formatCurrency(
                    row.amount,
                    currency
                )
            )}

                </div>

            </div>
        `;
        })
        .join("");


    /*
     * Show Load More only when
     * more records are available.
     */
    let loadMoreHtml = "";

    if (recentState.hasMore) {

        loadMoreHtml = `
      <div class="recent-load-more-wrap">
        <button
          type="button"
          id="loadMoreTransactions"
          class="recent-load-more"
          style="font-size:10px;float:right"
         
        >
          Load More
        </button>
      </div>
    `;
    }


    target.innerHTML =
        transactionHtml +
        loadMoreHtml;
}


/* =========================================================
   LOAD MORE RECENT TRANSACTIONS
   ========================================================= */

async function loadMoreRecentTransactions() {

    if (
        recentState.loading ||
        !recentState.hasMore ||
        !recentState.userId
    ) {
        return;
    }

    const button =
        document.getElementById(
            "loadMoreTransactions"
        );

    recentState.loading = true;

    if (button) {
        button.disabled = true;
        button.textContent = "Loading...";
    }

    try {

        const nextPage =
            await fetchRecent(
                recentState.userId,
                recentState.offset
            );


        if (nextPage.rows.length > 0) {

            recentState.rows.push(
                ...nextPage.rows
            );

            recentState.offset +=
                nextPage.rows.length;
        }


        recentState.hasMore =
            nextPage.hasMore;


        renderRecent(
            recentState.rows,
            recentState.currency
        );

    } catch (error) {

        console.error(
            "Failed to load more transactions:",
            error
        );

        showToast(
            friendlySupabaseError(error),
            "error"
        );


        /*
         * Keep the already loaded
         * transactions visible if
         * Load More fails.
         */
        renderRecent(
            recentState.rows,
            recentState.currency
        );

    } finally {

        recentState.loading = false;
    }
}


/* =========================================================
   DASHBOARD
   ========================================================= */

async function loadDashboard() {

    showLoader();

    try {

        const {
            user,
            currency
        } = await loadProfileUI();


        /* -----------------------------------------
           Reset Recent Transactions Pagination
           ----------------------------------------- */

        recentState.userId =
            user.id;

        recentState.currency =
            currency;

        recentState.rows = [];

        recentState.offset = 0;

        recentState.hasMore = true;

        recentState.loading = false;


        const [
            monthRows,
            recentPage,
            monthlyBudget,
            goalContributions,
            goalSavings
        ] = await Promise.all([

            fetchMonthTransactions(user.id),

            fetchRecent(
                user.id,
                0
            ),

            fetchMonthlyBudget(
                user.id
            ),

            fetchMonthGoalContributions(
                user.id
            ),

            fetchGoalSavings(
                user.id
            )
        ]);


        /* -----------------------------------------
           Store first 10 recent transactions
           ----------------------------------------- */

        recentState.rows =
            recentPage.rows;

        recentState.offset =
            recentPage.rows.length;

        recentState.hasMore =
            recentPage.hasMore;


        const income =
            amountFor(
                monthRows,
                "income"
            );


        // const expenses = amountFor(monthRows, "expense");

        const expenses =
            monthRows
                .filter(
                    x =>
                        x.transaction_type === "expense" &&
                        !x.goal_id
                )
                .reduce(
                    (sum, x) =>
                        sum + Number(x.amount || 0),
                    0
                );


        console.log(
            "MONTH ROWS:",
            monthRows
        );

        console.log(
            "GOAL EXPENSES:",
            monthRows.filter(
                x =>
                    x.transaction_type === "expense" &&
                    x.goal_id
            )
        );


        const savingsTransactions =
            amountFor(
                monthRows,
                "savings"
            );


        const goalContributionTotal =
            goalContributions.reduce(
                (sum, row) =>
                    sum + Number(row.amount || 0),
                0
            );


        const savings =
            income - expenses;


        const previousBalance =
            Math.max(
                0,
                Number(
                    monthlyBudget?.previous_balance || 0
                )
            );


        const balance =
            previousBalance +
            savings -
            savingsTransactions -
            goalContributionTotal;


        /* -----------------------------------------
           Total Balance
           ----------------------------------------- */

        document.getElementById(
            "totalBalance"
        ).textContent =
            formatCurrency(
                balance,
                currency
            );


        const balanceNote =
            document.getElementById(
                "balanceNote"
            );


        if (balanceNote) {

            const balanceParts = [];

            if (previousBalance > 0) {
                balanceParts.push(
                    `previous balance ${formatCurrency(
                        previousBalance,
                        currency
                    )}`
                );
            }


            balanceNote.textContent =
                balanceParts.length
                    ? ` ${balanceParts.join(" · ")}.`
                    : "No previous balance adjustments for this month.";
        }


        /* -----------------------------------------
           Monthly Metrics
           ----------------------------------------- */

        document.getElementById(
            "monthlyIncome"
        ).textContent =
            formatCurrency(
                income,
                currency
            );


        document.getElementById(
            "monthlyExpenses"
        ).textContent =
            formatCurrency(
                expenses,
                currency
            );


        document.getElementById(
            "monthlySavings"
        ).textContent =
            formatCurrency(
                savings,
                currency
            );


        /* -----------------------------------------
           Goal Savings
           ----------------------------------------- */

        console.log(
            "FINAL GOAL SAVINGS:",
            goalSavings
        );

        console.log(
            "CURRENCY:",
            currency
        );


        document.getElementById(
            "goalSavings"
        ).textContent =
            formatCurrency(
                goalSavings,
                currency
            );


        document.getElementById(
            "budgetIncomeLabel"
        ).textContent =
            `Income: ${formatCurrency(
                income,
                currency
            )}`;


        /* -----------------------------------------
           50 / 30 / 20
           ----------------------------------------- */

        const needs =
            expenseByBudget(
                monthRows,
                "needs"
            );


        const wants =
            expenseByBudget(
                monthRows,
                "wants"
            );


        const needTarget =
            income * 0.50;


        const wantTarget =
            income * 0.30;


        const savingTarget =
            income * 0.20;


        setProgress(
            "needsProgress",
            "needsProgressText",
            needTarget
                ? (needs / needTarget) * 100
                : 0
        );


        setProgress(
            "wantsProgress",
            "wantsProgressText",
            wantTarget
                ? (wants / wantTarget) * 100
                : 0
        );


        setProgress(
            "savingsProgress",
            "savingsProgressText",
            savingTarget
                ? (savings / savingTarget) * 100
                : 0
        );


        document.getElementById(
            "budgetHelp"
        ).textContent =
            income > 0
                ? `Needs: ${formatCurrency(
                    needs,
                    currency
                )} ---- Wants: ${formatCurrency(
                    wants,
                    currency
                )} --- Savings: ${formatCurrency(
                    savings,
                    currency
                )}.       Use this as a guide, not a strict limit.`
                : "Add income for this month to calculate your 50/30/20 guide.";


        /* -----------------------------------------
           Recent Transactions
           ----------------------------------------- */

        renderRecent(
            recentState.rows,
            currency
        );

    } catch (error) {

        if (
            String(error?.message) ===
            "AUTH_REQUIRED"
        ) {
            return;
        }

        console.error(error);

        showToast(
            friendlySupabaseError(error),
            "error"
        );

    } finally {

        hideLoader();
    }
}


/* =========================================================
   PREVIOUS BALANCE
   ========================================================= */

async function openPreviousBalanceModal() {

    const modal =
        document.getElementById(
            "previousBalanceModal"
        );

    if (!modal) return;

    try {

        showLoader();

        const { user } =
            await loadProfileUI();


        const monthlyBudget =
            await fetchMonthlyBudget(
                user.id
            );


        document.getElementById(
            "previousBalanceInput"
        ).value =
            Number(
                monthlyBudget.previous_balance || 0
            ) || "";


        modal.classList.remove(
            "hidden"
        );


        setTimeout(
            () =>
                document
                    .getElementById(
                        "previousBalanceInput"
                    )
                    ?.focus(),
            50
        );

    } catch (error) {

        console.error(error);

        showToast(
            friendlySupabaseError(error),
            "error"
        );

    } finally {

        hideLoader();
    }
}


function closePreviousBalanceModal() {

    document
        .getElementById(
            "previousBalanceModal"
        )
        ?.classList.add(
            "hidden"
        );
}


async function savePreviousBalance() {

    const input =
        document.getElementById(
            "previousBalanceInput"
        );


    const amount =
        input?.value === ""
            ? 0
            : Number(input?.value);


    if (
        !Number.isFinite(amount) ||
        amount < 0
    ) {

        showToast(
            "Previous balance must be 0 or more.",
            "warning"
        );

        input?.focus();

        return;
    }


    const button =
        document.getElementById(
            "previousBalanceSave"
        );


    button.disabled = true;


    try {

        const { user } =
            await loadProfileUI();


        showLoader();


        const payload = {
            user_id: user.id,
            month: currentMonthKey(),
            previous_balance: amount
        };


        const { error } =
            await sb
                .from("monthly_budgets")
                .upsert(
                    payload,
                    {
                        onConflict:
                            "user_id,month"
                    }
                );


        if (error) throw error;


        closePreviousBalanceModal();


        showToast(
            amount > 0
                ? "Previous balance saved."
                : "Previous balance cleared.",
            amount > 0
                ? "success"
                : "info"
        );


        await loadDashboard();

    } catch (error) {

        console.error(error);

        showToast(
            friendlySupabaseError(error),
            "error"
        );

    } finally {

        button.disabled = false;

        hideLoader();
    }
}


/* =========================================================
   APP SETUP
   ========================================================= */

setupAppMenu();

setupTheme();

setupProfileMenu();


document
    .getElementById(
        "floatingDashboardAdd"
    )
    ?.addEventListener(
        "click",
        () => {
            window.location.href =
                appUrl(
                    "transactions.html"
                );
        }
    );


/* =========================================================
   LOAD MORE BUTTON
   =========================================================

   Event delegation is used because the
   Load More button is created dynamically
   inside renderRecent().
   ========================================================= */

document
    .getElementById(
        "recentTransactions"
    )
    ?.addEventListener(
        "click",
        event => {

            if (
                event.target.closest(
                    "#loadMoreTransactions"
                )
            ) {
                loadMoreRecentTransactions();
            }
        }
    );


/* =========================================================
   PREVIOUS BALANCE EVENTS
   ========================================================= */

document
    .getElementById(
        "previousBalanceButton"
    )
    ?.addEventListener(
        "click",
        openPreviousBalanceModal
    );


document
    .getElementById(
        "previousBalanceClose"
    )
    ?.addEventListener(
        "click",
        closePreviousBalanceModal
    );


document
    .getElementById(
        "previousBalanceClear"
    )
    ?.addEventListener(
        "click",
        () => {

            const input =
                document.getElementById(
                    "previousBalanceInput"
                );

            if (input) {
                input.value = "";
            }

            input?.focus();
        }
    );


document
    .getElementById(
        "previousBalanceSave"
    )
    ?.addEventListener(
        "click",
        savePreviousBalance
    );


document
    .getElementById(
        "previousBalanceModal"
    )
    ?.addEventListener(
        "click",
        event => {

            if (
                event.target.id ===
                "previousBalanceModal"
            ) {
                closePreviousBalanceModal();
            }
        }
    );


/* =========================================================
   AUTH
   ========================================================= */

sb.auth.onAuthStateChange(
    (event, session) => {

        if (
            event === "SIGNED_OUT" ||
            !session
        ) {
            window.location.replace(
                appUrl("index.html")
            );
        }
    }
);


/* =========================================================
   INITIAL LOAD
   ========================================================= */

loadDashboard();
