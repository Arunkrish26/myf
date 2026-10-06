// import { sb } from "../core/supabase-client.js";
// import {
//     appUrl, setupTheme, setupAppMenu, setupProfileMenu,
//     formatCurrency, formatDate, localDateInputValue,
//     monthBounds, startOfThisWeek, transactionClass,
//     escapeHtml, showToast, friendlySupabaseError, loadProfileUI
// } from "../core/app-shared.js";

// const loader = document.getElementById("pageLoader");

// const state = {
//     user: null,
//     currency: "INR",
//     range: "this-month",
//     from: null,
//     to: null,
//     rows: [],
//     goalContributions: []
// };

// const showLoader = () => loader?.classList.remove("hidden");
// const hideLoader = () => loader?.classList.add("hidden");

// const showReportContent = () => {
//     document
//         .getElementById("reportDataContent")
//         ?.classList.remove("hidden");
// };

// const hideReportContent = () => {
//     document
//         .getElementById("reportDataContent")
//         ?.classList.add("hidden");
// };

// function addDays(date, days) {
//     const d = new Date(
//         date.getFullYear(),
//         date.getMonth(),
//         date.getDate()
//     );

//     d.setDate(d.getDate() + days);

//     return d;
// }

// function rangeDates(key) {
//     const now = new Date();

//     now.setHours(0, 0, 0, 0);

//     if (key === "today") {
//         const from = localDateInputValue(now);

//         return {
//             from,
//             to: localDateInputValue(addDays(now, 1)),
//             label: "Today"
//         };
//     }

//     if (key === "last-7") {
//         const from = addDays(now, -6);

//         return {
//             from: localDateInputValue(from),
//             to: localDateInputValue(addDays(now, 1)),
//             label: "Last 7 Days"
//         };
//     }

//     if (key === "last-30") {
//         const from = addDays(now, -29);

//         return {
//             from: localDateInputValue(from),
//             to: localDateInputValue(addDays(now, 1)),
//             label: "Last 30 Days"
//         };
//     }

//     if (key === "this-week") {
//         return {
//             from: startOfThisWeek(now),
//             to: localDateInputValue(addDays(now, 1)),
//             label: "This Week"
//         };
//     }

//     if (key === "this-month") {
//         return (
//             monthBounds(now) && {
//                 from: monthBounds(now).start,
//                 to: monthBounds(now).endExclusive,
//                 label: monthBounds(now).label
//             }
//         );
//     }

//     if (key === "last-month") {
//         const first = new Date(
//             now.getFullYear(),
//             now.getMonth() - 1,
//             1
//         );

//         const next = new Date(
//             now.getFullYear(),
//             now.getMonth(),
//             1
//         );

//         return {
//             from: localDateInputValue(first),
//             to: localDateInputValue(next),
//             label: new Intl.DateTimeFormat("en-IN", {
//                 month: "long",
//                 year: "numeric"
//             }).format(first)
//         };
//     }

//     if (key === "this-year") {
//         const first = new Date(
//             now.getFullYear(),
//             0,
//             1
//         );

//         const next = new Date(
//             now.getFullYear() + 1,
//             0,
//             1
//         );

//         return {
//             from: localDateInputValue(first),
//             to: localDateInputValue(next),
//             label: String(now.getFullYear())
//         };
//     }

//     return {
//         from: null,
//         to: null,
//         label: "Custom range"
//     };
// }

// function percent(value, total) {
//     return total > 0
//         ? (Number(value) / total) * 100
//         : 0;
// }

// function amount(rows, type) {
//     return rows
//         .filter(r => r.transaction_type === type)
//         .reduce(
//             (sum, r) => sum + Number(r.amount || 0),
//             0
//         );
// }

// function amountBudget(rows, budget) {
//     return rows
//         .filter(
//             r =>
//                 r.transaction_type === "expense" &&
//                 !r.goal_id &&
//                 r.budget_type === budget
//         )
//         .reduce(
//             (sum, r) => sum + Number(r.amount || 0),
//             0
//         );
// }

// function setBar(id, pct) {
//     const element = document.getElementById(id);

//     if (element) {
//         element.style.width =
//             `${Math.max(0, Math.min(100, pct))}%`;
//     }
// }

// function setHidden(id, hidden) {
//     document
//         .getElementById(id)
//         ?.classList
//         .toggle("hidden", hidden);
// }

// function applyRange(key, shouldLoad = true) {
//     state.range = key;

//     const d = rangeDates(key);

//     state.from = d.from;
//     state.to = d.to;

//     const select =
//         document.getElementById("rangeSelect");

//     if (select) {
//         select.value = key;
//     }

//     document
//         .getElementById("customRange")
//         ?.classList
//         .toggle("hidden", key !== "custom");

//     if (shouldLoad && key !== "custom") {
//         loadReport();
//     }
// }


// /* ============================================================
//    SUMMARY
//    ============================================================ */

// function renderSummary(rows) {
//     const income = amount(rows, "income");

//     /*
//      * NORMAL EXPENSES
//      *
//      * These are regular expenses that reduce the
//      * current period spending.
//      */
//     const normalExpenses = rows
//         .filter(
//             r =>
//                 r.transaction_type === "expense" &&
//                 !r.goal_id
//         )
//         .reduce(
//             (sum, r) =>
//                 sum + Number(r.amount || 0),
//             0
//         );

//     /*
//      * GOAL-FUNDED EXPENSES
//      *
//      * These are real expenses and should appear
//      * in the Report.
//      *
//      * However, they are excluded from 50/30/20
//      * because the money was already allocated
//      * to the goal when the contribution was made.
//      */
//     const goalFundedExpenses = rows
//         .filter(
//             r =>
//                 r.transaction_type === "expense" &&
//                 !!r.goal_id
//         )
//         .reduce(
//             (sum, r) =>
//                 sum + Number(r.amount || 0),
//             0
//         );

//     /*
//      * REPORT TOTAL EXPENSES
//      *
//      * Normal Expenses + Goal-Funded Expenses
//      */
//     const expenses =
//         normalExpenses +
//         goalFundedExpenses;

//     /*
//      * Regular savings transactions.
//      */
//     const savingsTransactions =
//         amount(rows, "savings");

//     /*
//      * Goal contributions are also savings.
//      */
//     const goalContrib =
//         state.goalContributions.reduce(
//             (sum, row) =>
//                 sum + Number(row.amount || 0),
//             0
//         );

//     /*
//      * Total savings allocation.
//      */
//     const totalSavingsAllocation =
//         savingsTransactions +
//         goalContrib;

//     /*
//      * Goal-funded expenses must NOT be
//      * deducted again here.
//      *
//      * The money was already allocated when
//      * the goal contribution happened.
//      */
//     const net =
//         income -
//         normalExpenses -
//         savingsTransactions -
//         goalContrib;

//     document.getElementById(
//         "reportIncome"
//     ).textContent =
//         formatCurrency(
//             income,
//             state.currency
//         );

//     document.getElementById(
//         "reportExpenses"
//     ).textContent =
//         formatCurrency(
//             expenses,
//             state.currency
//         );

//     document.getElementById(
//         "reportSavings"
//     ).textContent =
//         formatCurrency(
//             totalSavingsAllocation,
//             state.currency
//         );

//     document.getElementById(
//         "reportNet"
//     ).textContent =
//         formatCurrency(
//             net,
//             state.currency
//         );

//     const needs =
//         amountBudget(rows, "needs");

//     const wants =
//         amountBudget(rows, "wants");

//     document.getElementById(
//         "needsAmount"
//     ).textContent =
//         formatCurrency(
//             needs,
//             state.currency
//         );

//     document.getElementById(
//         "wantsAmount"
//     ).textContent =
//         formatCurrency(
//             wants,
//             state.currency
//         );

//     document.getElementById(
//         "allocatedSavings"
//     ).textContent =
//         formatCurrency(
//             totalSavingsAllocation,
//             state.currency
//         );

//     document.getElementById(
//         "goalContributionAmount"
//     ).textContent =
//         formatCurrency(
//             goalContrib,
//             state.currency
//         );

//     const base = income;

//     const nPct =
//         percent(needs, base);

//     const wPct =
//         percent(wants, base);

//     const sPct =
//         percent(
//             totalSavingsAllocation,
//             base
//         );

//     setBar("needsBar", nPct);
//     setBar("wantsBar", wPct);
//     setBar("savingsBar", sPct);

//     document.getElementById(
//         "needsPct"
//     ).textContent =
//         `${nPct.toFixed(1)}% of income`;

//     document.getElementById(
//         "wantsPct"
//     ).textContent =
//         `${wPct.toFixed(1)}% of income`;

//     document.getElementById(
//         "savingsPct"
//     ).textContent =
//         `${sPct.toFixed(1)}% of income`;
// }


// /* ============================================================
//    CATEGORY REPORT
//    ============================================================ */

// function renderCategories(
//     rows,
//     type,
//     targetId,
//     emptyId
// ) {
//     const map = {};

//     rows
//         .filter(
//             r => r.transaction_type === type
//         )
//         .forEach(row => {
//             const name =
//                 row.category_name ||
//                 "Uncategorized";

//             map[name] =
//                 (map[name] || 0) +
//                 Number(row.amount || 0);
//         });

//     const items =
//         Object.entries(map)
//             .sort(
//                 (a, b) => b[1] - a[1]
//             );

//     const total =
//         items.reduce(
//             (sum, item) =>
//                 sum + item[1],
//             0
//         );

//     setHidden(
//         emptyId,
//         items.length > 0
//     );

//     const target =
//         document.getElementById(
//             targetId
//         );

//     if (!target) return;

//     target.innerHTML =
//         items
//             .map(([name, value]) => {
//                 const pct =
//                     percent(value, total);

//                 return `
//           <div class="category-report-row">
//             <div class="category-report-head">
//               <strong>
//                 ${escapeHtml(name)}
//               </strong>

//               <span>
//                 ${escapeHtml(
//                     formatCurrency(
//                         value,
//                         state.currency
//                     )
//                 )}
//               </span>
//             </div>

//             <div class="category-report-track">
//               <span
//                 style="width:${Math.min(
//                     100,
//                     pct
//                 )}%"
//               ></span>
//             </div>
//           </div>
//         `;
//             })
//             .join("");
// }


// /* ============================================================
//    VEHICLES
//    ============================================================ */

// function renderVehicles(rows) {
//     const items =
//         rows.filter(
//             r =>
//                 r.transaction_type ===
//                 "expense" &&
//                 r.vehicle_id
//         );

//     const total =
//         items.reduce(
//             (sum, row) =>
//                 sum + Number(row.amount || 0),
//             0
//         );

//     document.getElementById(
//         "vehicleTotal"
//     ).textContent =
//         formatCurrency(
//             total,
//             state.currency
//         );

//     setHidden(
//         "emptyVehicleExpenses",
//         items.length > 0
//     );

//     document.getElementById(
//         "vehicleRows"
//     ).innerHTML =
//         items
//             .map(
//                 row => `
//           <tr>
//             <td>
//               ${escapeHtml(
//                     row.vehicle_name ||
//                     "Vehicle"
//                 )}
//             </td>

//             <td>
//               ${escapeHtml(
//                     row.category_name ||
//                     "Other Expense"
//                 )}
//             </td>

//             <td>
//               ${escapeHtml(
//                     formatDate(
//                         row.transaction_date
//                     )
//                 )}
//             </td>

//             <td>
//               ${escapeHtml(
//                     row.budget_type ===
//                         "needs"
//                         ? "Need"
//                         : row.budget_type ===
//                             "wants"
//                             ? "Want"
//                             : "—"
//                 )}
//             </td>

//             <td class="expense">
//               −${escapeHtml(
//                     formatCurrency(
//                         row.amount,
//                         state.currency
//                     )
//                 )}
//             </td>
//           </tr>
//         `
//             )
//             .join("");
// }


// /* ============================================================
//    DETAILS
//    ============================================================ */

// function renderDetails(rows) {
//     const count = rows.length;

//     document.getElementById(
//         "transactionCount"
//     ).textContent =
//         `${count} transaction${count === 1 ? "" : "s"
//         }`;

//     setHidden(
//         "emptyReportTransactions",
//         count > 0
//     );

//     document.getElementById(
//         "reportTransactionRows"
//     ).innerHTML =
//         rows
//             .map((row, index) => {
//                 const prefix =
//                     row.transaction_type ===
//                         "income"
//                         ? "+"
//                         : row.transaction_type ===
//                             "savings"
//                             ? "↗"
//                             : "−";

//                 return `
//           <tr>
//             <td class="report-row-number">
//               ${index + 1}
//             </td>

//             <td>
//               ${escapeHtml(
//                     formatDate(
//                         row.transaction_date
//                     )
//                 )}
//             </td>

//             <td>
//               ${escapeHtml(
//                     row.transaction_type
//                 )}
//             </td>

//             <td>
//               ${escapeHtml(
//                     row.category_name ||
//                     "Uncategorized"
//                 )}
//             </td>

//             <td>
//               ${escapeHtml(
//                     row.budget_type ===
//                         "needs"
//                         ? "Need"
//                         : row.budget_type ===
//                             "wants"
//                             ? "Want"
//                             : "—"
//                 )}
//             </td>

//             <td>
//               ${escapeHtml(
//                     row.vehicle_name ||
//                     "—"
//                 )}
//             </td>

//             <td>
//               ${escapeHtml(
//                     row.description ||
//                     row.notes ||
//                     "—"
//                 )}
//             </td>

//             <td class="${transactionClass(
//                     row.transaction_type
//                 )}">
//               ${prefix}${escapeHtml(
//                     formatCurrency(
//                         row.amount,
//                         state.currency
//                     )
//                 )}
//             </td>
//           </tr>
//         `;
//             })
//             .join("");
// }


// /* ============================================================
//    FETCH TRANSACTIONS
//    ============================================================ */

// async function fetchRows() {
//     const { data, error } =
//         await sb
//             .from("transactions")
//             .select(
//                 "id,transaction_type,amount,category_id,budget_type,vehicle_id,goal_id,transaction_date,description,notes"
//             )
//             .eq(
//                 "user_id",
//                 state.user.id
//             )
//             .gte(
//                 "transaction_date",
//                 state.from
//             )
//             .lt(
//                 "transaction_date",
//                 state.to
//             )
//             .order(
//                 "transaction_date",
//                 {
//                     ascending: false
//                 }
//             )
//             .order(
//                 "id",
//                 {
//                     ascending: false
//                 }
//             );

//     if (error) {
//         throw error;
//     }

//     const rows = data || [];

//     const categoryIds =
//         [
//             ...new Set(
//                 rows
//                     .map(r => r.category_id)
//                     .filter(Boolean)
//             )
//         ];

//     const vehicleIds =
//         [
//             ...new Set(
//                 rows
//                     .map(r => r.vehicle_id)
//                     .filter(Boolean)
//             )
//         ];

//     const [
//         categoryResult,
//         vehicleResult
//     ] =
//         await Promise.all([
//             categoryIds.length
//                 ? sb
//                     .from("categories")
//                     .select("id,name")
//                     .in(
//                         "id",
//                         categoryIds
//                     )
//                 : Promise.resolve({
//                     data: [],
//                     error: null
//                 }),

//             vehicleIds.length
//                 ? sb
//                     .from("vehicles")
//                     .select("id,name")
//                     .in(
//                         "id",
//                         vehicleIds
//                     )
//                     .eq(
//                         "user_id",
//                         state.user.id
//                     )
//                 : Promise.resolve({
//                     data: [],
//                     error: null
//                 })
//         ]);

//     if (categoryResult.error) {
//         throw categoryResult.error;
//     }

//     if (vehicleResult.error) {
//         throw vehicleResult.error;
//     }

//     const categories =
//         new Map(
//             (categoryResult.data || [])
//                 .map(
//                     c => [c.id, c.name]
//                 )
//         );

//     const vehicles =
//         new Map(
//             (vehicleResult.data || [])
//                 .map(
//                     v => [v.id, v.name]
//                 )
//         );

//     return rows.map(row => ({
//         ...row,

//         category_name:
//             categories.get(
//                 row.category_id
//             ) ||
//             "Uncategorized",

//         vehicle_name:
//             vehicles.get(
//                 row.vehicle_id
//             ) ||
//             null
//     }));
// }


// /* ============================================================
//    FETCH GOAL CONTRIBUTIONS
//    ============================================================ */

// async function fetchGoalContributions() {
//     const { data, error } =
//         await sb
//             .from("goal_contributions")
//             .select(
//                 "id,goal_id,amount,contribution_date,note"
//             )
//             .eq(
//                 "user_id",
//                 state.user.id
//             )
//             .gte(
//                 "contribution_date",
//                 state.from
//             )
//             .lt(
//                 "contribution_date",
//                 state.to
//             )
//             .order(
//                 "contribution_date",
//                 {
//                     ascending: false
//                 }
//             )
//             .order(
//                 "id",
//                 {
//                     ascending: false
//                 }
//             );

//     if (error) {
//         throw error;
//     }

//     const rows = data || [];

//     const goalIds =
//         [
//             ...new Set(
//                 rows
//                     .map(row => row.goal_id)
//                     .filter(Boolean)
//             )
//         ];

//     if (!goalIds.length) {
//         return rows;
//     }

//     const {
//         data: goals,
//         error: goalError
//     } =
//         await sb
//             .from("goals")
//             .select("id,name")
//             .eq(
//                 "user_id",
//                 state.user.id
//             )
//             .in(
//                 "id",
//                 goalIds
//             );

//     if (goalError) {
//         throw goalError;
//     }

//     const goalMap =
//         new Map(
//             (goals || [])
//                 .map(
//                     goal => [
//                         goal.id,
//                         goal.name
//                     ]
//                 )
//         );

//     return rows.map(row => ({
//         ...row,

//         goal_name:
//             goalMap.get(
//                 row.goal_id
//             ) ||
//             "Goal"
//     }));
// }


// /* ============================================================
//    LOAD REPORT
//    ============================================================ */

// async function loadReport() {

    
//     if (!state.user) {
//         return;
//     }
//     hideReportContent();

//     showLoader();

//     try {
//         const label =
//             state.range === "custom"
//                 ? `Custom: ${state.from} to ${localDateInputValue(
//                     addDays(
//                         new Date(
//                             `${state.to}T00:00:00`
//                         ),
//                         -1
//                     )
//                 )}`
//                 : rangeDates(
//                     state.range
//                 ).label;

//         document.getElementById(
//             "periodLabel"
//         ).textContent = label;

//         const results =
//             await Promise.allSettled([
//                 fetchRows(),
//                 fetchGoalContributions()
//             ]);

//         if (
//             results[0].status ===
//             "rejected"
//         ) {
//             throw results[0].reason;
//         }

//         state.rows =
//             results[0].value || [];

//         if (
//             results[1].status ===
//             "fulfilled"
//         ) {
//             state.goalContributions =
//                 results[1].value || [];
//         } else {
//             console.warn(
//                 "Goal contributions could not be loaded",
//                 results[1].reason
//             );

//             state.goalContributions =
//                 [];
//         }

//         renderSummary(
//             state.rows
//         );

//         renderCategories(
//             state.rows,
//             "expense",
//             "expenseCategories",
//             "emptyExpenseCategories"
//         );

//         renderCategories(
//             state.rows,
//             "income",
//             "incomeCategories",
//             "emptyIncomeCategories"
//         );

//         renderVehicles(
//             state.rows
//         );

//         renderDetails(
//             state.rows
//         );
//         showReportContent();
//     } catch (error) {
//         console.error(
//             "Report load failed:",
//             error
//         );

//         showToast(
//             friendlySupabaseError(
//                 error
//             ),
//             "error"
//         );
//     } finally {
//         hideLoader();
//     }
// }


// /* ============================================================
//    PDF HELPERS
//    ============================================================ */

// function money(value) {
//     const number =
//         Number(value || 0);

//     return `${state.currency === "INR"
//         ? "Rs."
//         : state.currency
//         } ${number.toLocaleString(
//             "en-IN",
//             {
//                 minimumFractionDigits: 2,
//                 maximumFractionDigits: 2
//             }
//         )}`;
// }


// /*
//  * PDF date format:
//  *
//  * yyyy-mm-dd
//  *      ↓
//  * dd/mm/yy
//  */
// function pdfDate(value) {
//     if (!value) {
//         return "—";
//     }

//     const raw =
//         String(value).slice(
//             0,
//             10
//         );

//     const parts =
//         raw.split("-");

//     if (parts.length === 3) {
//         return `${parts[2]}/${parts[1]}/${parts[0].slice(-2)}`;
//     }

//     return String(value);
// }


// function currentPeriodLabel() {
//     if (state.range === "custom") {
//         return `Custom: ${state.from} to ${localDateInputValue(
//             addDays(
//                 new Date(
//                     `${state.to}T00:00:00`
//                 ),
//                 -1
//             )
//         )}`;
//     }

//     return rangeDates(
//         state.range
//     ).label;
// }


// function aggregate(rows, type) {
//     const map = {};

//     rows
//         .filter(
//             row =>
//                 row.transaction_type ===
//                 type
//         )
//         .forEach(row => {
//             const name =
//                 row.category_name ||
//                 "Uncategorized";

//             map[name] =
//                 (map[name] || 0) +
//                 Number(
//                     row.amount || 0
//                 );
//         });

//     return Object.entries(map)
//         .sort(
//             (a, b) =>
//                 b[1] - a[1]
//         );
// }


// /* ============================================================
//    PDF
//    ============================================================ */

// function buildReportPdf() {
//     if (!window.pdfMake) {
//         showToast(
//             "PDF generator is still loading. Please try again.",
//             "warning"
//         );

//         return;
//     }

//     const rows =
//         state.rows || [];

//     const income =
//         amount(
//             rows,
//             "income"
//         );


//     /*
//      * NORMAL EXPENSES
//      */
//     const normalExpenses =
//         rows
//             .filter(
//                 row =>
//                     row.transaction_type ===
//                     "expense" &&
//                     !row.goal_id
//             )
//             .reduce(
//                 (sum, row) =>
//                     sum +
//                     Number(
//                         row.amount || 0
//                     ),
//                 0
//             );


//     /*
//      * GOAL-FUNDED EXPENSES
//      *
//      * These MUST appear in the Report.
//      */
//     const goalFundedExpenses =
//         rows
//             .filter(
//                 row =>
//                     row.transaction_type ===
//                     "expense" &&
//                     !!row.goal_id
//             )
//             .reduce(
//                 (sum, row) =>
//                     sum +
//                     Number(
//                         row.amount || 0
//                     ),
//                 0
//             );


//     /*
//      * REPORT TOTAL EXPENSES
//      *
//      * Normal + Goal-Funded
//      */
//     const expenses =
//         normalExpenses +
//         goalFundedExpenses;


//     const savingsTransactions =
//         amount(
//             rows,
//             "savings"
//         );

//     const goalContrib =
//         state.goalContributions
//             .reduce(
//                 (sum, row) =>
//                     sum +
//                     Number(
//                         row.amount || 0
//                     ),
//                 0
//             );


//     /*
//      * Goal contributions are
//      * part of Savings.
//      */
//     const totalSavingsAllocation =
//         savingsTransactions +
//         goalContrib;

//     const savings =
//         totalSavingsAllocation;


//     /*
//      * IMPORTANT:
//      *
//      * Goal-funded expenses are NOT
//      * deducted again here.
//      */
//     const net =
//         income -
//         normalExpenses -
//         savingsTransactions -
//         goalContrib;


//     /*
//      * 50 / 30 / 20
//      *
//      * Goal-funded expenses remain
//      * excluded here.
//      */
//     const needs =
//         amountBudget(
//             rows,
//             "needs"
//         );

//     const wants =
//         amountBudget(
//             rows,
//             "wants"
//         );


//     /*
//      * Expense breakdown includes
//      * ALL expenses, including
//      * goal-funded expenses.
//      */
//     const expenseItems =
//         aggregate(
//             rows,
//             "expense"
//         );

//     const incomeItems =
//         aggregate(
//             rows,
//             "income"
//         );

//     const vehicleItems =
//         rows.filter(
//             row =>
//                 row.transaction_type ===
//                 "expense" &&
//                 row.vehicle_id
//         );


//     const header =
//         labels =>
//             labels.map(
//                 text => ({
//                     text,
//                     style:
//                         "tableHeader"
//                 })
//             );


//     const categoryBody =
//         (
//             items,
//             total
//         ) => [
//                 header([
//                     "Category",
//                     "Amount",
//                     "Share"
//                 ]),

//                 ...(items.length
//                     ? items.map(
//                         ([
//                             name,
//                             value
//                         ]) => [
//                                 {
//                                     text: name
//                                 },

//                                 {
//                                     text:
//                                         money(
//                                             value
//                                         ),
//                                     alignment:
//                                         "right"
//                                 },

//                                 {
//                                     text:
//                                         `${percent(
//                                             value,
//                                             total
//                                         ).toFixed(
//                                             1
//                                         )}%`,

//                                     alignment:
//                                         "right"
//                                 }
//                             ]
//                     )

//                     : [
//                         [
//                             {
//                                 text:
//                                     "No data",
//                                 colSpan: 3,
//                                 color:
//                                     "#6b7280"
//                             },
//                             {},
//                             {}
//                         ]
//                     ])
//             ];


//     /*
//      * 50 / 30 / 20 table
//      */
//     const budgetBody = [
//         header([
//             "Allocation",
//             "Amount",
//             "% of income"
//         ]),

//         [
//             {
//                 text: "Needs"
//             },

//             {
//                 text:
//                     money(needs),
//                 alignment:
//                     "right"
//             },

//             {
//                 text:
//                     `${percent(
//                         needs,
//                         income
//                     ).toFixed(
//                         1
//                     )}%`,

//                 alignment:
//                     "right"
//             }
//         ],

//         [
//             {
//                 text: "Wants"
//             },

//             {
//                 text:
//                     money(wants),
//                 alignment:
//                     "right"
//             },

//             {
//                 text:
//                     `${percent(
//                         wants,
//                         income
//                     ).toFixed(
//                         1
//                     )}%`,

//                 alignment:
//                     "right"
//             }
//         ],

//         [
//             {
//                 text: "Savings"
//             },

//             {
//                 text:
//                     money(
//                         totalSavingsAllocation
//                     ),

//                 alignment:
//                     "right"
//             },

//             {
//                 text:
//                     `${percent(
//                         totalSavingsAllocation,
//                         income
//                     ).toFixed(
//                         1
//                     )}%`,

//                 alignment:
//                     "right"
//             }
//         ],

//         [
//             {
//                 text: "Goal Contributions"
                   
//             },

//             {
//                 text: money(goalContrib),
                    
//                 alignment: "right"

//             },

//             {
//                 text:
//                     `${percent(
//                         goalContrib,
//                         income
//                     ).toFixed(
//                         1
//                     )}%`,

//                 alignment:
//                     "right"
//             }
//         ]
//     ];


//     /*
//      * Goal contributions
//      */
//     const goalBody = [
//         header([
//             "Goal",
//             "Date",
//             "Amount"
//         ]),

//         ...(state.goalContributions.length
//             ? state.goalContributions.map(
//                 row => [
//                     {
//                         text:
//                             row.goal_name ||
//                             "Goal"
//                     },

//                     {
//                         text:
//                             pdfDate(
//                                 row.contribution_date
//                             )
//                     },

//                     {
//                         text:
//                             money(
//                                 row.amount
//                             ),
//                         alignment:
//                             "right"
//                     }
//                 ]
//             )

//             : [
//                 [
//                     {
//                         text:
//                             "No goal contributions",
//                         colSpan: 3,
//                         color:
//                             "#6b7280"
//                     },
//                     {},
//                     {}
//                 ]
//             ])
//     ];


//     /*
//      * Vehicle expenses
//      */
//     const vehicleBody = [
//         header([
//             "Vehicle",
//             "Category",
//             "Date",
//             "Amount"
//         ]),

//         ...(vehicleItems.length
//             ? vehicleItems.map(
//                 row => [
//                     {
//                         text:
//                             row.vehicle_name ||
//                             "Vehicle"
//                     },

//                     {
//                         text:
//                             row.category_name ||
//                             "Other Expense"
//                     },

//                     {
//                         text:
//                             pdfDate(
//                                 row.transaction_date
//                             )
//                     },

//                     {
//                         text:
//                             money(
//                                 row.amount
//                             ),

//                         alignment:
//                             "right"
//                     }
//                 ]
//             )

//             : [
//                 [
//                     {
//                         text:
//                             "No vehicle expenses",
//                         colSpan: 4,
//                         color:
//                             "#6b7280"
//                     },
//                     {},
//                     {},
//                     {}
//                 ]
//             ])
//     ];


//     /*
//      * Detailed transactions
//      */
//     const detailBody = [
//         header([
//             "#",
//             "Date",
//             "Type",
//             "Category",
//             "Budget",
//             "Vehicle",
//             "Description",
//             "Amount"
//         ]),

//         ...(rows.length
//             ? rows.map(
//                 (row, index) => [
//                     {
//                         text:
//                             String(
//                                 index + 1
//                             ),
//                         alignment:
//                             "center"
//                     },

//                     {
//                         text:
//                             pdfDate(
//                                 row.transaction_date
//                             )
//                     },

//                     {
//                         text:
//                             row.transaction_type
//                     },

//                     {
//                         text:
//                             row.category_name ||
//                             "Uncategorized"
//                     },

//                     {
//                         text:
//                             row.budget_type ===
//                                 "needs"
//                                 ? "Need"
//                                 : row.budget_type ===
//                                     "wants"
//                                     ? "Want"
//                                     : "—"
//                     },

//                     {
//                         text:
//                             row.vehicle_name ||
//                             "—"
//                     },

//                     {
//                         text: pdfWrapText(
//                             row.description ||
//                             row.notes ||
//                             "—"
//                         )
//                     }, 

//                     {
//                         text:
//                             money(
//                                 row.amount
//                             ),

//                         alignment:
//                             "right"
//                     }
//                 ]
//             )

//             : [
//                 [
//                     {
//                         text:
//                             "No transactions",
//                         colSpan: 8,
//                         color:
//                             "#6b7280"
//                     },
//                     {},
//                     {},
//                     {},
//                     {},
//                     {},
//                     {},
//                     {}
//                 ]
//             ])
//     ];


//     /*
//      * CUSTOM TABLE LAYOUT
//      *
//      * Gives every PDF table:
//      * - clean borders
//      * - horizontal padding
//      * - vertical padding
//      */
//     const reportTableLayout = {
//         hLineWidth:
//             function () {
//                 return 0.6;
//             },

//         vLineWidth:
//             function () {
//                 return 0.4;
//             },

//         hLineColor:
//             function () {
//                 return "#d9dee7";
//             },

//         vLineColor:
//             function () {
//                 return "#e4e7ec";
//             },

//         paddingLeft:
//             function () {
//                 return 7;
//             },

//         paddingRight:
//             function () {
//                 return 7;
//             },

//         paddingTop:
//             function () {
//                 return 6;
//             },

//         paddingBottom:
//             function () {
//                 return 6;
//             }
//     };


//     const docDefinition = {
//         pageSize: "A4",

//         pageMargins: [
//             34,
//             34,
//             34,
//             42
//         ],

//         defaultStyle: {
//             font: "Roboto",
//             fontSize: 9,
//             color: "#182230"
//         },


//         /*
//          * PDF FOOTER
//          */
//         footer:
//             (
//                 page,
//                 pageCount
//             ) => ({
//                 columns: [
//                     {
//                         text:
//                             `MyFinance · ${currentPeriodLabel()}`,

//                         fontSize: 8,

//                         color:
//                             "#6b7280"
//                     },

//                     {
//                         text:
//                             `Page ${page} of ${pageCount}`,

//                         alignment:
//                             "right",

//                         fontSize: 8,

//                         color:
//                             "#6b7280"
//                     }
//                 ],

//                 margin: [
//                     34,
//                     0,
//                     34,
//                     18
//                 ]
//             }),


//         content: [

//             /*
//              * HEADER
//              */
//             {
//                 text: "MyFinance",
//                 style: "brand",
//                 alignment: "center",
//                 fontSize: 18

//             },

//             {
//                 text:
//                     "Financial Report",
//                 style: "title",
//                 fontSize: 14
//             },

//             {
//                 text:
//                     currentPeriodLabel(),
//                 style: "period"
//             },

//             {
//                 text:
//                     `${rows.length} transaction${rows.length === 1
//                         ? ""
//                         : "s"
//                     }`,

//                 style:
//                     "periodCount",

//                 margin: [
//                     0,
//                     2,
//                     0,
//                     12
//                 ]
//             },


//             /*
//              * TOP SUMMARY CARDS
//              *
//              * Each card now has:
//              * - border
//              * - light background
//              * - colored value
//              */
//             {
//                 table: {
//                     widths: [
//                         "*",
//                         "*",
//                         "*",
//                         "*"
//                     ],

//                     body: [
//                         [
//                             {
//                                 stack: [
//                                     {
//                                         text:
//                                             "Income",
//                                         style:
//                                             "cardLabel"
//                                     },

//                                     {
//                                         text:
//                                             money(
//                                                 income
//                                             ),
//                                         style:
//                                             "incomeValue"
//                                     }
//                                 ],

//                                 fillColor:
//                                     "#eaf8f1",

//                                 margin: [
//                                     10,
//                                     10,
//                                     10,
//                                     10
//                                 ]
//                             },

//                             {
//                                 stack: [
//                                     {
//                                         text:
//                                             "Expenses",
//                                         style:
//                                             "cardLabel"
//                                     },

//                                     {
//                                         text:
//                                             money(
//                                                 expenses
//                                             ),
//                                         style:
//                                             "expenseValue"
//                                     }
//                                 ],

//                                 fillColor:
//                                     "#fff0f1",

//                                 margin: [
//                                     10,
//                                     10,
//                                     10,
//                                     10
//                                 ]
//                             },

//                             {
//                                 stack: [
//                                     {
//                                         text:
//                                             "Savings",
//                                         style:
//                                             "cardLabel"
//                                     },

//                                     {
//                                         text:
//                                             money(
//                                                 savings
//                                             ),
//                                         style:
//                                             "savingsValue"
//                                     }
//                                 ],

//                                 fillColor:
//                                     "#fff6e8",

//                                 margin: [
//                                     10,
//                                     10,
//                                     10,
//                                     10
//                                 ]
//                             },

//                             {
//                                 stack: [
//                                     {
//                                         text:
//                                             "Net After Allocations",
//                                         style:
//                                             "cardLabel"
//                                     },

//                                     {
//                                         text:
//                                             money(
//                                                 net
//                                             ),
//                                         style:
//                                             "netValue"
//                                     }
//                                 ],

//                                 fillColor:
//                                     "#edf5ff",

//                                 margin: [
//                                     10,
//                                     10,
//                                     10,
//                                     10
//                                 ]
//                             }
//                         ]
//                     ]
//                 },

//                 layout: {
//                     hLineWidth:
//                         function () {
//                             return 1;
//                         },

//                     vLineWidth:
//                         function () {
//                             return 1;
//                         },

//                     hLineColor:
//                         function () {
//                             return "#d0d5dd";
//                         },

//                     vLineColor:
//                         function () {
//                             return "#d0d5dd";
//                         }
//                 },

//                 margin: [
//                     0,
//                     0,
//                     0,
//                     16
//                 ]
//             },


//             /*
//              * EXPENSE COMPOSITION
//              *
//              * Clearly explains:
//              *
//              * Total Expenses =
//              * Normal Expenses +
//              * Goal-Funded Expenses
//              */
//             {
//                 text:
//                     "Expense Composition",

//                 style:
//                     "sectionTitle",

//                 margin: [
//                     0,
//                     4,
//                     0,
//                     6
//                 ]
//             },

//             {
//                 table: {
//                     widths: [
//                         "*",
//                         "auto"
//                     ],

//                     body: [
//                         header([
//                             "Expense Type",
//                             "Amount"
//                         ]),

//                         [
//                             {
//                                 text:
//                                     "Normal Expenses"
//                             },

//                             {
//                                 text:
//                                     money(
//                                         normalExpenses
//                                     ),

//                                 alignment:
//                                     "right"
//                             }
//                         ],

//                         [
//                             {
//                                 text:
//                                     "Goal-Funded Expenses"
//                             },

//                             {
//                                 text:
//                                     money(
//                                         goalFundedExpenses
//                                     ),

//                                 alignment:
//                                     "right"
//                             }
//                         ],

//                         [
//                             {
//                                 text:
//                                     "Total Expenses = Normal + Goal-Funded",
//                                 bold:
//                                     true
//                             },

//                             {
//                                 text:
//                                     money(
//                                         expenses
//                                     ),

//                                 alignment:
//                                     "right",

//                                 bold:
//                                     true
//                             }
//                         ]
//                     ],

//                     headerRows: 1
//                 },

//                 layout:
//                     reportTableLayout,

//                 margin: [
//                     0,
//                     0,
//                     0,
//                     16
//                 ]
//             },


//             /*
//              * EXPENSE + INCOME BREAKDOWN
//              */
//             {
//                 columns: [

//                     {
//                         stack: [

//                             {
//                                 text:
//                                     "Expense Breakdown",

//                                 style:
//                                     "sectionTitle"
//                             },

//                             {
//                                 table: {
//                                     widths: [
//                                         "*",
//                                         "auto",
//                                         "auto"
//                                     ],

//                                     body:
//                                         categoryBody(
//                                             expenseItems,
//                                             expenses
//                                         ),

//                                     headerRows:
//                                         1
//                                 },

//                                 layout:
//                                     reportTableLayout
//                             }
//                         ]
//                     },

//                     {
//                         stack: [

//                             {
//                                 text:
//                                     "Income Breakdown",

//                                 style:
//                                     "sectionTitle"
//                             },

//                             {
//                                 table: {
//                                     widths: [
//                                         "*",
//                                         "auto",
//                                         "auto"
//                                     ],

//                                     body:
//                                         categoryBody(
//                                             incomeItems,
//                                             income
//                                         ),

//                                     headerRows:
//                                         1
//                                 },

//                                 layout:
//                                     reportTableLayout
//                             }
//                         ]
//                     }
//                 ],

//                 columnGap:
//                     18
//             },


//             /*
//              * 50 / 30 / 20
//              */
//             {
//                 text:
//                     "Needs / Wants / Savings",

//                 style:
//                     "sectionTitle",

//                 margin: [
//                     0,
//                     18,
//                     0,
//                     6
//                 ]
//             },

//             {
//                 table: {
//                     widths: [
//                         "*",
//                         "auto",
//                         "auto"
//                     ],

//                     body:
//                         budgetBody,

//                     headerRows:
//                         1
//                 },

//                 layout:
//                     reportTableLayout
//             },


//             /*
//              * GOAL CONTRIBUTIONS
//              */
//             {
//                 text:
//                     "Goal Contributions",

//                 style:
//                     "sectionTitle",

//                 margin: [
//                     0,
//                     18,
//                     0,
//                     6
//                 ]
//             },

//             {
//                 table: {
//                     widths: [
//                         "*",
//                         "auto",
//                         "auto"
//                     ],

//                     body:
//                         goalBody,

//                     headerRows:
//                         1
//                 },

//                 layout:
//                     reportTableLayout
//             },
//             {
//                 unbreakable: true,

//                 stack: [

//                     {
//                         text: "Goal Contributions",
//                         style: "sectionTitle",
//                         margin: [
//                             0,
//                             18,
//                             0,
//                             6
//                         ]
//                     },

//                     {
//                         table: {
//                             widths: [
//                                 "*",
//                                 "auto",
//                                 "auto"
//                             ],

//                             body: goalBody,

//                             headerRows: 1,

//                             keepWithHeaderRows: 1
//                         },

//                         layout:
//                             reportTableLayout
//                     }

//                 ]
//             },

//             /*
//              * VEHICLE EXPENSES
//              */
//             {
//                 text:
//                     "Vehicle Expenses",

//                 style:
//                     "sectionTitle",

//                 margin: [
//                     0,
//                     18,
//                     0,
//                     6
//                 ]
//             },

//             {
//                 table: {
//                     widths: [
//                         "*",
//                         "*",
//                         "auto",
//                         "auto"
//                     ],

//                     body:
//                         vehicleBody,

//                     headerRows:
//                         1
//                 },

//                 layout:
//                     reportTableLayout
//             },


//             /*
//              * DETAILED TRANSACTIONS
//              */
//             {
//                 text:
//                     "Detailed Transactions",

//                 style:
//                     "sectionTitle",

//                 margin: [
//                     0,
//                     18,
//                     0,
//                     6
//                 ]
//             },

//             {
//                 table: {
//                     widths: [
//                         20,
//                         42,
//                         38,
//                         80,
//                         40,
//                         45,
//                         "*",
//                         100,
//                         64
//                     ],

//                     body:
//                         detailBody,

//                     headerRows:
//                         1
//                 },

//                 layout:
//                     reportTableLayout
//             }
//         ],


//         /*
//          * PDF STYLES
//          */
//         styles: {

//             brand: {
//                 fontSize: 15,
//                 bold: true,
//                 color: "#08a67a",
//                 margin: [
//                     0,
//                     0,
//                     0,
//                     4
//                 ]
//             },

//             title: {
//                 fontSize: 22,
//                 bold: true,
//                 color: "#14202d"
//             },

//             period: {
//                 fontSize: 10,
//                 color: "#6b7280",
//                 margin: [
//                     0,
//                     2,
//                     0,
//                     0
//                 ]
//             },

//             periodCount: {
//                 fontSize: 9,
//                 bold: true,
//                 color: "#475467"
//             },

//             /*
//              * Top card labels
//              */
//             cardLabel: {
//                 fontSize: 8,
//                 bold: true,
//                 color: "#475467"
//             },

//             /*
//              * Income
//              */
//             incomeValue: {
//                 fontSize: 15,
//                 bold: true,
//                 color: "#087443",
//                 margin: [
//                     0,
//                     4,
//                     0,
//                     0
//                 ]
//             },

//             /*
//              * Expense
//              */
//             expenseValue: {
//                 fontSize: 15,
//                 bold: true,
//                 color: "#b42318",
//                 margin: [
//                     0,
//                     4,
//                     0,
//                     0
//                 ]
//             },

//             /*
//              * Savings
//              */
//             savingsValue: {
//                 fontSize: 15,
//                 bold: true,
//                 color: "#b54708",
//                 margin: [
//                     0,
//                     4,
//                     0,
//                     0
//                 ]
//             },

//             /*
//              * Net
//              */
//             netValue: {
//                 fontSize: 15,
//                 bold: true,
//                 color: "#175cd3",
//                 margin: [
//                     0,
//                     4,
//                     0,
//                     0
//                 ]
//             },

//             /*
//              * Section headings
//              */
//             sectionTitle: {
//                 fontSize: 12,
//                 bold: true,
//                 color: "#175cd3",
//                 margin: [
//                     0,
//                     0,
//                     0,
//                     6
//                 ]
//             },

//             /*
//              * Table headers
//              *
//              * Extra padding
//              */
//             tableHeader: {
//                 fontSize: 8,
//                 bold: true,
//                 color: "#243b53",
//                 fillColor: "#eaf2ff",
//                 margin: [
//                     7,
//                     7,
//                     7,
//                     7
//                 ]
//             }
//         }
//     };


//     /*
//      * File name
//      */
//     const baseDate =
//         state.from
//             ? new Date(
//                 `${state.from}T00:00:00`
//             )
//             : new Date();

//     const dynamicLabel =
//         state.range === "custom"

//             ? `MyFinance ${state.from} - ${localDateInputValue(
//                 addDays(
//                     new Date(
//                         `${state.to}T00:00:00`
//                     ),
//                     -1
//                 )
//             )}`

//             : `MyFinance ${new Intl.DateTimeFormat(
//                 "en-IN",
//                 {
//                     month: "short",
//                     year: "numeric"
//                 }
//             ).format(baseDate)}`;

//     window.pdfMake
//         .createPdf(
//             docDefinition
//         )
//         .download(
//             `${dynamicLabel}.pdf`
//         );
// }


// /* ============================================================
//    INIT SHARED UI
//    ============================================================ */

// setupAppMenu();

// setupTheme();

// setupProfileMenu();


// /* ============================================================
//    RANGE SELECT
//    ============================================================ */

// document
//     .getElementById(
//         "rangeSelect"
//     )
//     ?.addEventListener(
//         "change",
//         event =>
//             applyRange(
//                 event.target.value
//             )
//     );


// /* ============================================================
//    CUSTOM RANGE
//    ============================================================ */

// document
//     .getElementById(
//         "applyCustomRange"
//     )
//     ?.addEventListener(
//         "click",
//         async () => {

//             const from =
//                 document.getElementById(
//                     "fromDate"
//                 ).value;

//             const to =
//                 document.getElementById(
//                     "toDate"
//                 ).value;

//             const today =
//                 localDateInputValue(
//                     new Date()
//                 );


//             if (
//                 !from ||
//                 !to ||
//                 from > to
//             ) {
//                 showToast(
//                     "Please select a valid custom date range.",
//                     "warning"
//                 );

//                 return;
//             }


//             if (to > today) {
//                 showToast(
//                     "Report end date cannot be in the future.",
//                     "warning"
//                 );

//                 return;
//             }


//             state.range =
//                 "custom";

//             state.from =
//                 from;

//             state.to =
//                 localDateInputValue(
//                     addDays(
//                         new Date(
//                             `${to}T00:00:00`
//                         ),
//                         1
//                     )
//                 );


//             document.getElementById(
//                 "rangeSelect"
//             ).value =
//                 "custom";


//             document
//                 .getElementById(
//                     "customRange"
//                 )
//                 ?.classList
//                 .remove("hidden");


//             await loadReport();
//         }
//     );


// /* ============================================================
//    PDF BUTTON
//    ============================================================ */

// document
//     .getElementById(
//         "printReport"
//     )
//     ?.addEventListener(
//         "click",
//         buildReportPdf
//     );


// /* ============================================================
//    AUTH STATE
//    ============================================================ */

// sb.auth.onAuthStateChange(
//     (
//         event,
//         session
//     ) => {

//         if (
//             event ===
//             "SIGNED_OUT" ||
//             !session
//         ) {
//             window.location.replace(
//                 appUrl(
//                     "index.html"
//                 )
//             );
//         }
//     }
// );


// /* ============================================================
//    INITIAL LOAD
//    ============================================================ */

// (async () => {

//     try {

//         const profile =
//             await loadProfileUI();

//         state.user =
//             profile.user;

//         state.currency =
//             profile.currency || "INR";


//         applyRange(
//             "this-month",
//             false
//         );


//         document.getElementById(
//             "rangeSelect"
//         ).value =
//             "this-month";


//         document.getElementById(
//             "fromDate"
//         ).value =
//             state.from;


//         document.getElementById(
//             "toDate"
//         ).value =
//             localDateInputValue(
//                 new Date()
//             );


//         await loadReport();

//     } catch (error) {

//         console.error(
//             "Report initialization failed:",
//             error
//         );

//         showToast(
//             friendlySupabaseError(error),
//             "error"
//         );

//         hideLoader();
//     }

// })();



// function pdfWrapText(value, chunkSize = 18) {
//     if (!value) {
//         return "—";
//     }

//     const text = String(value);

//     return text
//         .split(/\s+/)
//         .map(word => {
//             if (word.length <= chunkSize) {
//                 return word;
//             }

//             const chunks = [];

//             for (let i = 0; i < word.length; i += chunkSize) {
//                 chunks.push(
//                     word.slice(i, i + chunkSize)
//                 );
//             }

//             return chunks.join("\u200B");
//         })
//         .join(" ");
// }

import { sb } from "../core/supabase-client.js";
import { createReportPdf } from "./report-pdf.js";
import {
    appUrl, setupTheme, setupAppMenu, setupProfileMenu,
    formatCurrency, formatDate, localDateInputValue,
    monthBounds, startOfThisWeek, transactionClass,
    escapeHtml, showToast, friendlySupabaseError, loadProfileUI
} from "../core/app-shared.js";

const loader = document.getElementById("pageLoader");

const state = {
    user: null,
    currency: "INR",
    range: "this-month",
    from: null,
    to: null,
    rows: [],
    goalContributions: []
};

const showLoader = () => loader?.classList.remove("hidden");
const hideLoader = () => loader?.classList.add("hidden");

const showReportContent = () => {
    document
        .getElementById("reportDataContent")
        ?.classList.remove("hidden");
};

const hideReportContent = () => {
    document
        .getElementById("reportDataContent")
        ?.classList.add("hidden");
};

function addDays(date, days) {
    const d = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
    );

    d.setDate(d.getDate() + days);

    return d;
}

function rangeDates(key) {
    const now = new Date();

    now.setHours(0, 0, 0, 0);

    if (key === "today") {
        const from = localDateInputValue(now);

        return {
            from,
            to: localDateInputValue(addDays(now, 1)),
            label: "Today"
        };
    }

    if (key === "last-7") {
        const from = addDays(now, -6);

        return {
            from: localDateInputValue(from),
            to: localDateInputValue(addDays(now, 1)),
            label: "Last 7 Days"
        };
    }

    if (key === "last-30") {
        const from = addDays(now, -29);

        return {
            from: localDateInputValue(from),
            to: localDateInputValue(addDays(now, 1)),
            label: "Last 30 Days"
        };
    }

    if (key === "this-week") {
        return {
            from: startOfThisWeek(now),
            to: localDateInputValue(addDays(now, 1)),
            label: "This Week"
        };
    }

    if (key === "this-month") {
        return (
            monthBounds(now) && {
                from: monthBounds(now).start,
                to: monthBounds(now).endExclusive,
                label: monthBounds(now).label
            }
        );
    }

    if (key === "last-month") {
        const first = new Date(
            now.getFullYear(),
            now.getMonth() - 1,
            1
        );

        const next = new Date(
            now.getFullYear(),
            now.getMonth(),
            1
        );

        return {
            from: localDateInputValue(first),
            to: localDateInputValue(next),
            label: new Intl.DateTimeFormat("en-IN", {
                month: "long",
                year: "numeric"
            }).format(first)
        };
    }

    if (key === "this-year") {
        const first = new Date(
            now.getFullYear(),
            0,
            1
        );

        const next = new Date(
            now.getFullYear() + 1,
            0,
            1
        );

        return {
            from: localDateInputValue(first),
            to: localDateInputValue(next),
            label: String(now.getFullYear())
        };
    }

    return {
        from: null,
        to: null,
        label: "Custom range"
    };
}

function percent(value, total) {
    return total > 0
        ? (Number(value) / total) * 100
        : 0;
}

function amount(rows, type) {
    return rows
        .filter(r => r.transaction_type === type)
        .reduce(
            (sum, r) => sum + Number(r.amount || 0),
            0
        );
}

function amountBudget(rows, budget) {
    return rows
        .filter(
            r =>
                r.transaction_type === "expense" &&
                !r.goal_id &&
                r.budget_type === budget
        )
        .reduce(
            (sum, r) => sum + Number(r.amount || 0),
            0
        );
}

function setBar(id, pct) {
    const element = document.getElementById(id);

    if (element) {
        element.style.width =
            `${Math.max(0, Math.min(100, pct))}%`;
    }
}

function setHidden(id, hidden) {
    document
        .getElementById(id)
        ?.classList
        .toggle("hidden", hidden);
}

function applyRange(key, shouldLoad = true) {
    state.range = key;

    const d = rangeDates(key);

    state.from = d.from;
    state.to = d.to;

    const select =
        document.getElementById("rangeSelect");

    if (select) {
        select.value = key;
    }

    document
        .getElementById("customRange")
        ?.classList
        .toggle("hidden", key !== "custom");

    if (shouldLoad && key !== "custom") {
        loadReport();
    }
}


/* ============================================================
   SUMMARY
   ============================================================ */

function renderSummary(rows) {
    const income = amount(rows, "income");

    /*
     * NORMAL EXPENSES
     *
     * These are regular expenses that reduce the
     * current period spending.
     */
    const normalExpenses = rows
        .filter(
            r =>
                r.transaction_type === "expense" &&
                !r.goal_id
        )
        .reduce(
            (sum, r) =>
                sum + Number(r.amount || 0),
            0
        );

    /*
     * GOAL-FUNDED EXPENSES
     *
     * These are real expenses and should appear
     * in the Report.
     *
     * However, they are excluded from 50/30/20
     * because the money was already allocated
     * to the goal when the contribution was made.
     */
    const goalFundedExpenses = rows
        .filter(
            r =>
                r.transaction_type === "expense" &&
                !!r.goal_id
        )
        .reduce(
            (sum, r) =>
                sum + Number(r.amount || 0),
            0
        );

    /*
     * REPORT TOTAL EXPENSES
     *
     * Normal Expenses + Goal-Funded Expenses
     */
    const expenses =
        normalExpenses +
        goalFundedExpenses;

    /*
     * Regular savings transactions.
     */
    const savingsTransactions =
        amount(rows, "savings");

    /*
     * Goal contributions are also savings.
     */
    const goalContrib =
        state.goalContributions.reduce(
            (sum, row) =>
                sum + Number(row.amount || 0),
            0
        );

    /*
     * Total savings allocation.
     */
    const totalSavingsAllocation =
        savingsTransactions +
        goalContrib;

    /*
     * Goal-funded expenses must NOT be
     * deducted again here.
     *
     * The money was already allocated when
     * the goal contribution happened.
     */
    const net =
        income -
        normalExpenses -
        savingsTransactions -
        goalContrib;

    document.getElementById(
        "reportIncome"
    ).textContent =
        formatCurrency(
            income,
            state.currency
        );

    document.getElementById(
        "reportExpenses"
    ).textContent =
        formatCurrency(
            expenses,
            state.currency
        );

    document.getElementById(
        "reportSavings"
    ).textContent =
        formatCurrency(
            totalSavingsAllocation,
            state.currency
        );

    document.getElementById(
        "reportNet"
    ).textContent =
        formatCurrency(
            net,
            state.currency
        );

    const needs =
        amountBudget(rows, "needs");

    const wants =
        amountBudget(rows, "wants");

    document.getElementById(
        "needsAmount"
    ).textContent =
        formatCurrency(
            needs,
            state.currency
        );

    document.getElementById(
        "wantsAmount"
    ).textContent =
        formatCurrency(
            wants,
            state.currency
        );

    document.getElementById(
        "allocatedSavings"
    ).textContent =
        formatCurrency(
            totalSavingsAllocation,
            state.currency
        );

    document.getElementById(
        "goalContributionAmount"
    ).textContent =
        formatCurrency(
            goalContrib,
            state.currency
        );

    const base = income;

    const nPct =
        percent(needs, base);

    const wPct =
        percent(wants, base);

    const sPct =
        percent(
            totalSavingsAllocation,
            base
        );

    setBar("needsBar", nPct);
    setBar("wantsBar", wPct);
    setBar("savingsBar", sPct);

    document.getElementById(
        "needsPct"
    ).textContent =
        `${nPct.toFixed(1)}% of income`;

    document.getElementById(
        "wantsPct"
    ).textContent =
        `${wPct.toFixed(1)}% of income`;

    document.getElementById(
        "savingsPct"
    ).textContent =
        `${sPct.toFixed(1)}% of income`;
}


/* ============================================================
   CATEGORY REPORT
   ============================================================ */

function renderCategories(
    rows,
    type,
    targetId,
    emptyId
) {
    const map = {};

    rows
        .filter(
            r => r.transaction_type === type
        )
        .forEach(row => {
            const name =
                row.category_name ||
                "Uncategorized";

            map[name] =
                (map[name] || 0) +
                Number(row.amount || 0);
        });

    const items =
        Object.entries(map)
            .sort(
                (a, b) => b[1] - a[1]
            );

    const total =
        items.reduce(
            (sum, item) =>
                sum + item[1],
            0
        );

    setHidden(
        emptyId,
        items.length > 0
    );

    const target =
        document.getElementById(
            targetId
        );

    if (!target) return;

    target.innerHTML =
        items
            .map(([name, value]) => {
                const pct =
                    percent(value, total);

                return `
          <div class="category-report-row">
            <div class="category-report-head">
              <strong>
                ${escapeHtml(name)}
              </strong>

              <span>
                ${escapeHtml(
                    formatCurrency(
                        value,
                        state.currency
                    )
                )}
              </span>
            </div>

            <div class="category-report-track">
              <span
                style="width:${Math.min(
                    100,
                    pct
                )}%"
              ></span>
            </div>
          </div>
        `;
            })
            .join("");
}


/* ============================================================
   VEHICLES
   ============================================================ */

function renderVehicles(rows) {
    const items =
        rows.filter(
            r =>
                r.transaction_type ===
                "expense" &&
                r.vehicle_id
        );

    const total =
        items.reduce(
            (sum, row) =>
                sum + Number(row.amount || 0),
            0
        );

    document.getElementById(
        "vehicleTotal"
    ).textContent =
        formatCurrency(
            total,
            state.currency
        );

    setHidden(
        "emptyVehicleExpenses",
        items.length > 0
    );

    document.getElementById(
        "vehicleRows"
    ).innerHTML =
        items
            .map(
                row => `
          <tr>
            <td>
              ${escapeHtml(
                    row.vehicle_name ||
                    "Vehicle"
                )}
            </td>

            <td>
              ${escapeHtml(
                    row.category_name ||
                    "Other Expense"
                )}
            </td>

            <td>
              ${escapeHtml(
                    formatDate(
                        row.transaction_date
                    )
                )}
            </td>

            <td>
              ${escapeHtml(
                    row.budget_type ===
                        "needs"
                        ? "Need"
                        : row.budget_type ===
                            "wants"
                            ? "Want"
                            : "—"
                )}
            </td>

            <td class="expense">
              −${escapeHtml(
                    formatCurrency(
                        row.amount,
                        state.currency
                    )
                )}
            </td>
          </tr>
        `
            )
            .join("");
}


/* ============================================================
   DETAILS
   ============================================================ */

function renderDetails(rows) {
    const count = rows.length;

    document.getElementById(
        "transactionCount"
    ).textContent =
        `${count} transaction${count === 1 ? "" : "s"
        }`;

    setHidden(
        "emptyReportTransactions",
        count > 0
    );

    document.getElementById(
        "reportTransactionRows"
    ).innerHTML =
        rows
            .map((row, index) => {
                const prefix =
                    row.transaction_type ===
                        "income"
                        ? "+"
                        : row.transaction_type ===
                            "savings"
                            ? "↗"
                            : "−";

                return `
          <tr>
            <td class="report-row-number">
              ${index + 1}
            </td>

            <td>
              ${escapeHtml(
                    formatDate(
                        row.transaction_date
                    )
                )}
            </td>

            <td>
              ${escapeHtml(
                    row.transaction_type
                )}
            </td>

            <td>
              ${escapeHtml(
                    row.category_name ||
                    "Uncategorized"
                )}
            </td>

            <td>
              ${escapeHtml(
                    row.budget_type ===
                        "needs"
                        ? "Need"
                        : row.budget_type ===
                            "wants"
                            ? "Want"
                            : "—"
                )}
            </td>

            <td>
              ${escapeHtml(
                    row.vehicle_name ||
                    "—"
                )}
            </td>

            <td>
              ${escapeHtml(
                    row.description ||
                    row.notes ||
                    "—"
                )}
            </td>

            <td class="${transactionClass(
                    row.transaction_type
                )}">
              ${prefix}${escapeHtml(
                    formatCurrency(
                        row.amount,
                        state.currency
                    )
                )}
            </td>
          </tr>
        `;
            })
            .join("");
}


/* ============================================================
   FETCH TRANSACTIONS
   ============================================================ */

async function fetchRows() {
    const { data, error } =
        await sb
            .from("transactions")
            .select(
                "id,transaction_type,amount,category_id,budget_type,vehicle_id,goal_id,transaction_date,description,notes"
            )
            .eq(
                "user_id",
                state.user.id
            )
            .gte(
                "transaction_date",
                state.from
            )
            .lt(
                "transaction_date",
                state.to
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

    if (error) {
        throw error;
    }

    const rows = data || [];

    const categoryIds =
        [
            ...new Set(
                rows
                    .map(r => r.category_id)
                    .filter(Boolean)
            )
        ];

    const vehicleIds =
        [
            ...new Set(
                rows
                    .map(r => r.vehicle_id)
                    .filter(Boolean)
            )
        ];

    const [
        categoryResult,
        vehicleResult
    ] =
        await Promise.all([
            categoryIds.length
                ? sb
                    .from("categories")
                    .select("id,name")
                    .in(
                        "id",
                        categoryIds
                    )
                : Promise.resolve({
                    data: [],
                    error: null
                }),

            vehicleIds.length
                ? sb
                    .from("vehicles")
                    .select("id,name")
                    .in(
                        "id",
                        vehicleIds
                    )
                    .eq(
                        "user_id",
                        state.user.id
                    )
                : Promise.resolve({
                    data: [],
                    error: null
                })
        ]);

    if (categoryResult.error) {
        throw categoryResult.error;
    }

    if (vehicleResult.error) {
        throw vehicleResult.error;
    }

    const categories =
        new Map(
            (categoryResult.data || [])
                .map(
                    c => [c.id, c.name]
                )
        );

    const vehicles =
        new Map(
            (vehicleResult.data || [])
                .map(
                    v => [v.id, v.name]
                )
        );

    return rows.map(row => ({
        ...row,

        category_name:
            categories.get(
                row.category_id
            ) ||
            "Uncategorized",

        vehicle_name:
            vehicles.get(
                row.vehicle_id
            ) ||
            null
    }));
}


/* ============================================================
   FETCH GOAL CONTRIBUTIONS
   ============================================================ */

async function fetchGoalContributions() {
    const { data, error } =
        await sb
            .from("goal_contributions")
            .select(
                "id,goal_id,amount,contribution_date,note"
            )
            .eq(
                "user_id",
                state.user.id
            )
            .gte(
                "contribution_date",
                state.from
            )
            .lt(
                "contribution_date",
                state.to
            )
            .order(
                "contribution_date",
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

    if (error) {
        throw error;
    }

    const rows = data || [];

    const goalIds =
        [
            ...new Set(
                rows
                    .map(row => row.goal_id)
                    .filter(Boolean)
            )
        ];

    if (!goalIds.length) {
        return rows;
    }

    const {
        data: goals,
        error: goalError
    } =
        await sb
            .from("goals")
            .select("id,name")
            .eq(
                "user_id",
                state.user.id
            )
            .in(
                "id",
                goalIds
            );

    if (goalError) {
        throw goalError;
    }

    const goalMap =
        new Map(
            (goals || [])
                .map(
                    goal => [
                        goal.id,
                        goal.name
                    ]
                )
        );

    return rows.map(row => ({
        ...row,

        goal_name:
            goalMap.get(
                row.goal_id
            ) ||
            "Goal"
    }));
}


/* ============================================================
   LOAD REPORT
   ============================================================ */

async function loadReport() {


    if (!state.user) {
        return;
    }
    hideReportContent();

    showLoader();

    try {
        const label =
            state.range === "custom"
                ? `Custom: ${state.from} to ${localDateInputValue(
                    addDays(
                        new Date(
                            `${state.to}T00:00:00`
                        ),
                        -1
                    )
                )}`
                : rangeDates(
                    state.range
                ).label;

        document.getElementById(
            "periodLabel"
        ).textContent = label;

        const results =
            await Promise.allSettled([
                fetchRows(),
                fetchGoalContributions()
            ]);

        if (
            results[0].status ===
            "rejected"
        ) {
            throw results[0].reason;
        }

        state.rows =
            results[0].value || [];

        if (
            results[1].status ===
            "fulfilled"
        ) {
            state.goalContributions =
                results[1].value || [];
        } else {
            console.warn(
                "Goal contributions could not be loaded",
                results[1].reason
            );

            state.goalContributions =
                [];
        }

        renderSummary(
            state.rows
        );

        renderCategories(
            state.rows,
            "expense",
            "expenseCategories",
            "emptyExpenseCategories"
        );

        renderCategories(
            state.rows,
            "income",
            "incomeCategories",
            "emptyIncomeCategories"
        );

        renderVehicles(
            state.rows
        );

        renderDetails(
            state.rows
        );
        showReportContent();
    } catch (error) {
        console.error(
            "Report load failed:",
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


function currentPeriodLabel() {
    if (state.range === "custom") {
        return `Custom: ${state.from} to ${localDateInputValue(
            addDays(
                new Date(
                    `${state.to}T00:00:00`
                ),
                -1
            )
        )}`;
    }

    return rangeDates(
        state.range
    ).label;
}


/* ============================================================
   PDF
   ============================================================ */

function buildReportPdf() {
    if (!window.pdfMake) {
        showToast(
            "PDF generator is still loading. Please try again.",
            "warning"
        );

        return;
    }

    const baseDate =
        state.from
            ? new Date(`${state.from}T00:00:00`)
            : new Date();

    const fileName =
        state.range === "custom"
            ? `MyFinance ${state.from} - ${localDateInputValue(
                addDays(new Date(`${state.to}T00:00:00`), -1)
            )}`
            : `MyFinance ${new Intl.DateTimeFormat(
                "en-IN",
                { month: "short", year: "numeric" }
            ).format(baseDate)}`;

    createReportPdf({
        rows: state.rows || [],
        goalContributions: state.goalContributions || [],
        currency: state.currency,
        periodLabel: currentPeriodLabel(),
        fileName
    });
}


/* ============================================================
   INIT SHARED UI
   ============================================================ */

setupAppMenu();

setupTheme();

setupProfileMenu();


/* ============================================================
   RANGE SELECT
   ============================================================ */

document
    .getElementById(
        "rangeSelect"
    )
    ?.addEventListener(
        "change",
        event =>
            applyRange(
                event.target.value
            )
    );


/* ============================================================
   CUSTOM RANGE
   ============================================================ */

document
    .getElementById(
        "applyCustomRange"
    )
    ?.addEventListener(
        "click",
        async () => {

            const from =
                document.getElementById(
                    "fromDate"
                ).value;

            const to =
                document.getElementById(
                    "toDate"
                ).value;

            const today =
                localDateInputValue(
                    new Date()
                );


            if (
                !from ||
                !to ||
                from > to
            ) {
                showToast(
                    "Please select a valid custom date range.",
                    "warning"
                );

                return;
            }


            if (to > today) {
                showToast(
                    "Report end date cannot be in the future.",
                    "warning"
                );

                return;
            }


            state.range =
                "custom";

            state.from =
                from;

            state.to =
                localDateInputValue(
                    addDays(
                        new Date(
                            `${to}T00:00:00`
                        ),
                        1
                    )
                );


            document.getElementById(
                "rangeSelect"
            ).value =
                "custom";


            document
                .getElementById(
                    "customRange"
                )
                ?.classList
                .remove("hidden");


            await loadReport();
        }
    );


/* ============================================================
   PDF BUTTON
   ============================================================ */

document
    .getElementById(
        "printReport"
    )
    ?.addEventListener(
        "click",
        buildReportPdf
    );


/* ============================================================
   AUTH STATE
   ============================================================ */

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


/* ============================================================
   INITIAL LOAD
   ============================================================ */

(async () => {

    try {

        const profile =
            await loadProfileUI();

        state.user =
            profile.user;

        state.currency =
            profile.currency || "INR";


        applyRange(
            "this-month",
            false
        );


        document.getElementById(
            "rangeSelect"
        ).value =
            "this-month";


        document.getElementById(
            "fromDate"
        ).value =
            state.from;


        document.getElementById(
            "toDate"
        ).value =
            localDateInputValue(
                new Date()
            );


        await loadReport();

    } catch (error) {

        console.error(
            "Report initialization failed:",
            error
        );

        showToast(
            friendlySupabaseError(error),
            "error"
        );

        hideLoader();
    }

})();

