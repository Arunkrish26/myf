import { sb } from "../core/supabase-client.js";
import {
    appUrl,
    setupTheme,
    setupAppMenu,
    setupProfileMenu,
    loadProfileUI,
    localDateInputValue,
    formatCurrency,
    formatDate,
    escapeHtml,
    showToast,
    friendlySupabaseError
} from "../core/app-shared.js";


const loader = document.getElementById("pageLoader");

const showLoader = () =>
    loader?.classList.remove("hidden");

const hideLoader = () =>
    loader?.classList.add("hidden");


const state = {
    user: null,
    currency: "INR",
    goals: [],
    contributions: [],
    goalExpenses: [],
    editingId: null,
    contributingGoalId: null
};


/* =========================================================
   MESSAGES
========================================================= */

function goalMessage(kind, message) {
    const error = document.getElementById("goalFormError");
    const success = document.getElementById("goalFormSuccess");

    error.classList.toggle("hidden", kind !== "error");
    success.classList.toggle("hidden", kind !== "success");

    error.textContent = kind === "error" ? message : "";
    success.textContent = kind === "success" ? message : "";
}


function contributionMessage(message = "") {
    const box = document.getElementById("contributionError");

    box.textContent = message;
    box.classList.toggle("hidden", !message);
}


/* =========================================================
   GOAL CALCULATIONS
========================================================= */

function contributionsFor(goalId) {
    return state.contributions.filter(
        row => String(row.goal_id) === String(goalId)
    );
}


function savedFor(goalId) {
    return contributionsFor(goalId).reduce(
        (sum, row) => sum + Number(row.amount || 0),
        0
    );
}


function expensesFor(goalId) {
    return state.goalExpenses.filter(
        row => String(row.goal_id) === String(goalId)
    );
}


function spentFor(goalId) {
    return expensesFor(goalId).reduce(
        (sum, row) => sum + Number(row.amount || 0),
        0
    );
}


function availableFor(goalId) {
    const contributed = savedFor(goalId);
    const spent = spentFor(goalId);

    return Math.max(
        0,
        contributed - spent
    );
}


/* =========================================================
   GOAL STATUS
========================================================= */

function goalStatus(goal, saved) {

    const target = Number(
        goal.target_amount || 0
    );


    // Once completed, always remain completed
    if (goal.completed_at) {
        return {
            key: "completed",
            label: "Completed"
        };
    }


    // Automatically completed when target is reached
    if (
        saved >= target &&
        target > 0
    ) {
        return {
            key: "completed",
            label: "Completed"
        };
    }


    const today = new Date();

    today.setHours(
        0,
        0,
        0,
        0
    );


    const targetDate = new Date(
        `${goal.target_date}T00:00:00`
    );


    if (targetDate < today) {
        return {
            key: "overdue",
            label: "Past target date"
        };
    }


    return {
        key: "active",
        label: "In progress"
    };
}


/* =========================================================
   SUMMARY
========================================================= */

function renderSummary() {

    const currentGoals = state.goals.filter(
        goal =>
            goalStatus(
                goal,
                savedFor(goal.id)
            ).key !== "completed"
    );


    const finishedGoals = state.goals.filter(
        goal =>
            goalStatus(
                goal,
                savedFor(goal.id)
            ).key === "completed"
    );


    const totalTarget =
        state.goals.reduce(
            (sum, goal) =>
                sum +
                Number(goal.target_amount || 0),
            0
        );


    const totalContributed =
        state.goals.reduce(
            (sum, goal) =>
                sum +
                savedFor(goal.id),
            0
        );


    const totalSpent =
        state.goals.reduce(
            (sum, goal) =>
                sum +
                spentFor(goal.id),
            0
        );


    const totalAvailable =
        state.goals.reduce(
            (sum, goal) =>
                sum +
                availableFor(goal.id),
            0
        );


    const activeGoalCount =
        document.getElementById(
            "activeGoalCount"
        );

    const finishedGoalCount =
        document.getElementById(
            "finishedGoalCount"
        );

    const totalTargetAmount =
        document.getElementById(
            "totalTargetAmount"
        );

    const totalSavedAmount =
        document.getElementById(
            "totalSavedAmount"
        );

    const totalSpentAmount =
        document.getElementById(
            "totalSpentAmount"
        );

    const totalAvailableAmount =
        document.getElementById(
            "totalAvailableAmount"
        );


    if (activeGoalCount) {
        activeGoalCount.textContent =
            String(currentGoals.length);
    }


    if (finishedGoalCount) {
        finishedGoalCount.textContent =
            String(finishedGoals.length);
    }


    if (totalTargetAmount) {
        totalTargetAmount.textContent =
            formatCurrency(
                totalTarget,
                state.currency
            );
    }


    if (totalSavedAmount) {
        totalSavedAmount.textContent =
            formatCurrency(
                totalContributed,
                state.currency
            );
    }


    if (totalSpentAmount) {
        totalSpentAmount.textContent =
            formatCurrency(
                totalSpent,
                state.currency
            );
    }


    if (totalAvailableAmount) {
        totalAvailableAmount.textContent =
            formatCurrency(
                totalAvailable,
                state.currency
            );
    }
}


/* =========================================================
   GOAL CARD
========================================================= */

function renderGoalCard(goal) {

    const targetAmount =
        Number(goal.target_amount || 0);


    const contributed =
        savedFor(goal.id);


    const spent =
        spentFor(goal.id);


    const available =
        availableFor(goal.id);


    const remainingToTarget =
        Math.max(
            0,
            targetAmount - contributed
        );


    const percent =
        targetAmount > 0
            ? Math.min(
                100,
                (contributed / targetAmount) * 100
            )
            : 0;


    const status =
        goalStatus(
            goal,
            contributed
        );


    const contributionCount =
        contributionsFor(goal.id).length;


    const expenseCount =
        expensesFor(goal.id).length;


    const statusClass =
        status.key;


    const completedDate =
        goal.completed_at
            ? formatDate(
                goal.completed_at.slice(0, 10)
            )
            : "";


    const isCompleted =
        status.key === "completed";


    return `
    <article class="goal-card ${statusClass}">

      <div class="goal-card-head">

        <div>
          <h3>
            ${escapeHtml(goal.name)}
          </h3>

          <p>
            ${escapeHtml(
        goal.description ||
        "No description added."
    )}
          </p>
        </div>

        <span class="goal-status ${statusClass}">
          ${escapeHtml(status.label)}
        </span>

      </div>


      <div class="goal-numbers">

        <div class="goal-number">
          <span>Target</span>

          <strong>
            ${escapeHtml(
        formatCurrency(
            targetAmount,
            state.currency
        )
    )}
          </strong>
        </div>


        <div class="goal-number">
          <span>Contributed</span>

          <strong>
            ${escapeHtml(
        formatCurrency(
            contributed,
            state.currency
        )
    )}
          </strong>
        </div>


        <div class="goal-number">
          <span>Spent</span>

          <strong>
            ${escapeHtml(
        formatCurrency(
            spent,
            state.currency
        )
    )}
          </strong>
        </div>


        <div class="goal-number">
          <span>Available</span>

          <strong>
            ${escapeHtml(
        formatCurrency(
            available,
            state.currency
        )
    )}
          </strong>
        </div>

      </div>


      <div class="goal-progress-label">

        <span>
          Progress
        </span>

        <span>
          ${Math.round(percent)}%
        </span>

      </div>


      <div
        class="goal-progress-track"
        aria-label="${Math.round(percent)} percent completed">

        <div
          class="goal-progress-fill"
          style="width:${percent}%">
        </div>

      </div>


      <div class="goal-meta">

        <span>
          Target date:
          ${escapeHtml(
        formatDate(goal.target_date)
    )}
        </span>

        <span>
          ${contributionCount}
          contribution${contributionCount === 1 ? "" : "s"}
        </span>

        <span>
          ${expenseCount}
          goal expense${expenseCount === 1 ? "" : "s"}
        </span>

      </div>


      ${isCompleted
            ? `
            <div class="goal-completed-info">

              <span>
                🔒 Goal completed
              </span>

              ${completedDate
                ? `<span>Completed: ${escapeHtml(completedDate)}</span>`
                : ""
            }

            </div>
          `
            : `
            <div class="goal-remaining-info">

              <span>
                Remaining to target:
              </span>

              <strong>
                ${escapeHtml(
                formatCurrency(
                    remainingToTarget,
                    state.currency
                )
            )}
              </strong>

            </div>
          `
        }


      <div class="goal-actions">

        ${isCompleted
            ? ""
            : `
              <button
                class="btn btn-sm btn-contribute"
                type="button"
                data-contribute="${goal.id}">
                + Contribute
              </button>

              <button
                class="btn btn-sm goal-edit-button"
                type="button"
                data-edit="${goal.id}">
                Edit
              </button>

              <button
                class="btn btn-sm goal-delete-button"
                type="button"
                data-delete="${goal.id}">
                Delete
              </button>
            `
        }


        <button
          class="btn btn-sm goal-history-button"
          type="button"
          data-history="${goal.id}">
          History
        </button>

      </div>

    </article>
  `;
}


/* =========================================================
   RENDER GOALS
========================================================= */

function renderGoals() {

    const currentGrid =
        document.getElementById(
            "goalsGrid"
        );


    const finishedGrid =
        document.getElementById(
            "finishedGoalsGrid"
        );


    const currentEmpty =
        document.getElementById(
            "emptyGoals"
        );


    const finishedEmpty =
        document.getElementById(
            "emptyFinishedGoals"
        );


    const currentGoals =
        state.goals.filter(
            goal =>
                goalStatus(
                    goal,
                    savedFor(goal.id)
                ).key !== "completed"
        );


    const finishedGoals =
        state.goals.filter(
            goal =>
                goalStatus(
                    goal,
                    savedFor(goal.id)
                ).key === "completed"
        );


    /* Current Goals */

    if (currentGrid) {

        currentGrid.innerHTML =
            currentGoals
                .map(renderGoalCard)
                .join("");
    }


    if (currentEmpty) {

        currentEmpty.classList.toggle(
            "hidden",
            currentGoals.length > 0
        );
    }


    /* Finished Goals */

    if (finishedGrid) {

        finishedGrid.innerHTML =
            finishedGoals
                .map(renderGoalCard)
                .join("");
    }


    if (finishedEmpty) {

        finishedEmpty.classList.toggle(
            "hidden",
            finishedGoals.length > 0
        );
    }


    renderSummary();
}


/* =========================================================
   LOAD DATA
========================================================= */

async function loadData() {

    showLoader();

    try {

        const profile =
            await loadProfileUI();


        state.user =
            profile.user;


        state.currency =
            profile.currency || "INR";


        const [
            goalsResult,
            contributionsResult,
            goalExpensesResult
        ] = await Promise.all([

            sb
                .from("goals")
                .select(
                    "id,user_id,name,target_amount,target_date,description,completed_at,created_at,updated_at"
                )
                .eq(
                    "user_id",
                    state.user.id
                )
                .order(
                    "target_date",
                    { ascending: true }
                )
                .order(
                    "id",
                    { ascending: true }
                ),


            sb
                .from("goal_contributions")
                .select(
                    "id,user_id,goal_id,amount,contribution_date,note,created_at"
                )
                .eq(
                    "user_id",
                    state.user.id
                )
                .order(
                    "contribution_date",
                    { ascending: false }
                )
                .order(
                    "id",
                    { ascending: false }
                ),


            sb
                .from("transactions")
                .select(
                    "id,goal_id,amount,transaction_date,description,notes"
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
                )
                .order(
                    "transaction_date",
                    { ascending: false }
                )
                .order(
                    "id",
                    { ascending: false }
                )

        ]);


        if (goalsResult.error)
            throw goalsResult.error;


        if (contributionsResult.error)
            throw contributionsResult.error;


        if (goalExpensesResult.error)
            throw goalExpensesResult.error;


        state.goals =
            goalsResult.data || [];


        state.contributions =
            contributionsResult.data || [];


        state.goalExpenses =
            goalExpensesResult.data || [];


        renderGoals();

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


/* =========================================================
   RESET GOAL FORM
========================================================= */

function resetGoalForm() {

    document
        .getElementById("goalForm")
        .reset();


    document
        .getElementById("targetDate")
        .value =
        localDateInputValue();


    state.editingId =
        null;


    document
        .getElementById("goalFormTitle")
        .textContent =
        "Create a Goal";


    document
        .getElementById("saveGoalButton")
        .textContent =
        "Create Goal";


    goalMessage(
        "success",
        ""
    );


    document
        .getElementById("goalFormSuccess")
        .classList
        .add("hidden");


    document
        .getElementById("goalFormError")
        .classList
        .add("hidden");
}


/* =========================================================
   EDIT GOAL
========================================================= */

function fillGoalForm(id) {

    const goal =
        state.goals.find(
            row =>
                String(row.id) ===
                String(id)
        );


    if (!goal)
        return;


    // Completed goals cannot be edited
    if (goal.completed_at) {

        showToast(
            "Completed goals cannot be edited.",
            "error"
        );

        return;
    }


    state.editingId =
        goal.id;


    document
        .getElementById("goalFormTitle")
        .textContent =
        "Edit Goal";


    document
        .getElementById("saveGoalButton")
        .textContent =
        "Update Goal";


    document
        .getElementById("goalName")
        .value =
        goal.name || "";


    document
        .getElementById("targetAmount")
        .value =
        goal.target_amount || "";


    document
        .getElementById("targetDate")
        .value =
        goal.target_date || "";


    document
        .getElementById("goalDescription")
        .value =
        goal.description || "";


    goalMessage(
        "success",
        ""
    );


    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}


/* =========================================================
   SAVE GOAL
========================================================= */

async function saveGoal(event) {

    event.preventDefault();


    goalMessage(
        "success",
        ""
    );


    document
        .getElementById("goalFormSuccess")
        .classList
        .add("hidden");


    document
        .getElementById("goalFormError")
        .classList
        .add("hidden");


    const name =
        document
            .getElementById("goalName")
            .value
            .trim();


    const amount =
        Number(
            document
                .getElementById("targetAmount")
                .value
        );


    const targetDate =
        document
            .getElementById("targetDate")
            .value;


    const description =
        document
            .getElementById("goalDescription")
            .value
            .trim();


    if (!name)
        return goalMessage(
            "error",
            "Please enter a goal name."
        );


    if (
        !Number.isFinite(amount) ||
        amount < 1
    )
        return goalMessage(
            "error",
            "Target amount must be at least 1."
        );


    if (!targetDate)
        return goalMessage(
            "error",
            "Please select a target date."
        );


    // Prevent updating a completed goal
    if (state.editingId) {

        const existingGoal =
            state.goals.find(
                row =>
                    String(row.id) ===
                    String(state.editingId)
            );


        if (
            existingGoal &&
            existingGoal.completed_at
        ) {

            state.editingId = null;

            return goalMessage(
                "error",
                "Completed goals cannot be edited."
            );
        }
    }


    const button =
        document.getElementById(
            "saveGoalButton"
        );


    button.disabled = true;

    showLoader();


    try {

        const payload = {
            user_id: state.user.id,
            name,
            target_amount: amount,
            target_date: targetDate,
            description: description || null
        };


        let result;


        if (state.editingId) {

            result =
                await sb
                    .from("goals")
                    .update(payload)
                    .eq(
                        "id",
                        state.editingId
                    )
                    .eq(
                        "user_id",
                        state.user.id
                    )
                    .select()
                    .maybeSingle();

        } else {

            result =
                await sb
                    .from("goals")
                    .insert(payload)
                    .select()
                    .maybeSingle();
        }


        if (result.error)
            throw result.error;


        showToast(
            state.editingId
                ? "Goal updated."
                : "Goal created.",
            "success"
        );


        resetGoalForm();

        await loadData();

    } catch (error) {

        console.error(error);

        goalMessage(
            "error",
            friendlySupabaseError(error)
        );


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
   OPEN CONTRIBUTION MODAL
========================================================= */

function openContributionModal(id) {

    const goal =
        state.goals.find(
            row =>
                String(row.id) ===
                String(id)
        );


    if (!goal)
        return;


    // Completed goals cannot receive contributions
    if (goal.completed_at) {

        showToast(
            "Completed goals cannot receive new contributions.",
            "error"
        );

        return;
    }


    const saved =
        savedFor(goal.id);


    const remaining =
        Math.max(
            0,
            Number(goal.target_amount) -
            saved
        );


    state.contributingGoalId =
        goal.id;


    document
        .getElementById(
            "contributionGoalName"
        )
        .textContent =
        goal.name;


    document
        .getElementById(
            "contributionRemaining"
        )
        .textContent =
        `Remaining ${formatCurrency(
            remaining,
            state.currency
        )}`;


    document
        .getElementById(
            "contributionAmount"
        )
        .value = "";


    document
        .getElementById(
            "contributionDate"
        )
        .value =
        localDateInputValue();


    document
        .getElementById(
            "contributionNote"
        )
        .value = "";


    contributionMessage(
        remaining <= 0
            ? "This goal is already complete."
            : ""
    );


    document
        .getElementById(
            "contributionSave"
        )
        .disabled =
        remaining <= 0;


    document
        .getElementById(
            "goalModal"
        )
        .classList
        .remove("hidden");


    document
        .getElementById(
            "contributionAmount"
        )
        .focus();
}


/* =========================================================
   CLOSE CONTRIBUTION MODAL
========================================================= */

function closeContributionModal() {

    document
        .getElementById("goalModal")
        ?.classList
        .add("hidden");


    state.contributingGoalId =
        null;
}


/* =========================================================
   SAVE CONTRIBUTION
========================================================= */

async function saveContribution() {

    const goal =
        state.goals.find(
            row =>
                String(row.id) ===
                String(
                    state.contributingGoalId
                )
        );


    if (!goal)
        return;


    // Extra protection for completed goals
    if (goal.completed_at) {

        contributionMessage(
            "Completed goals cannot receive new contributions."
        );

        return;
    }


    const amount =
        Number(
            document
                .getElementById(
                    "contributionAmount"
                )
                .value
        );


    const date =
        document
            .getElementById(
                "contributionDate"
            )
            .value;


    const note =
        document
            .getElementById(
                "contributionNote"
            )
            .value
            .trim();


    const remaining =
        Math.max(
            0,
            Number(goal.target_amount) -
            savedFor(goal.id)
        );


    contributionMessage("");


    if (
        !Number.isFinite(amount) ||
        amount < 1
    ) {

        return contributionMessage(
            "Contribution amount must be at least 1."
        );
    }


    if (!date) {

        return contributionMessage(
            "Please select a contribution date."
        );
    }


    if (amount > remaining) {

        return contributionMessage(
            `Contribution cannot exceed the remaining ${formatCurrency(
                remaining,
                state.currency
            )}.`
        );
    }


    const button =
        document.getElementById(
            "contributionSave"
        );


    button.disabled = true;

    showLoader();


    try {

        const payload = {
            user_id: state.user.id,
            goal_id: goal.id,
            amount,
            contribution_date: date,
            note: note || null
        };


        const {
            error
        } =
            await sb
                .from("goal_contributions")
                .insert(payload);


        if (error)
            throw error;


        // Calculate the new contribution total
        const newSavedAmount =
            savedFor(goal.id) +
            amount;


        const targetAmount =
            Number(
                goal.target_amount || 0
            );


        // Permanently mark the goal as completed
        if (
            targetAmount > 0 &&
            newSavedAmount >= targetAmount
        ) {

            const {
                error: completeError
            } =
                await sb
                    .from("goals")
                    .update({
                        completed_at:
                            new Date().toISOString()
                    })
                    .eq(
                        "id",
                        goal.id
                    )
                    .eq(
                        "user_id",
                        state.user.id
                    );


            if (completeError) {

                console.error(
                    "Failed to mark goal as completed:",
                    completeError
                );
            }
        }


        closeContributionModal();


        showToast(
            "Goal contribution saved.",
            "success"
        );


        await loadData();

    } catch (error) {

        console.error(error);


        contributionMessage(
            friendlySupabaseError(error)
        );


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
   HISTORY
========================================================= */

function openHistoryModal(id) {

    const goal =
        state.goals.find(
            row =>
                String(row.id) ===
                String(id)
        );


    if (!goal)
        return;


    const contributed =
        savedFor(goal.id);


    const spent =
        spentFor(goal.id);


    const available =
        availableFor(goal.id);


    document
        .getElementById(
            "historyModalSubtitle"
        )
        .textContent =
        `${goal.name} — Contributed ${formatCurrency(
            contributed,
            state.currency
        )} · Spent ${formatCurrency(
            spent,
            state.currency
        )} · Available ${formatCurrency(
            available,
            state.currency
        )}.`;


    const rows =
        contributionsFor(goal.id);


    const target =
        document.getElementById(
            "contributionHistoryList"
        );


    target.innerHTML =
        rows.length

            ? rows
                .map(
                    row => `
              <div class="history-row">

                <div>

                  <strong>
                    ${escapeHtml(
                        formatDate(
                            row.contribution_date
                        )
                    )}
                  </strong>

                  <span>
                    ${escapeHtml(
                        row.note ||
                        "No note added."
                    )}
                  </span>

                </div>

                <span class="history-amount">
                  +${escapeHtml(
                        formatCurrency(
                            row.amount,
                            state.currency
                        )
                    )}
                </span>

              </div>
            `
                )
                .join("")

            : `
          <div class="empty-state">

            <strong>
              No contributions yet
            </strong>

            Add the first contribution
            to start this goal.

          </div>
        `;


    document
        .getElementById(
            "historyModal"
        )
        .classList
        .remove("hidden");
}


/* =========================================================
   CLOSE HISTORY
========================================================= */

function closeHistoryModal() {

    document
        .getElementById(
            "historyModal"
        )
        ?.classList
        .add("hidden");
}


/* =========================================================
   DELETE GOAL
========================================================= */

async function deleteGoal(id) {

    const goal =
        state.goals.find(
            row =>
                String(row.id) ===
                String(id)
        );


    if (!goal)
        return;


    // Completed goals cannot be deleted
    if (goal.completed_at) {

        showToast(
            "Completed goals cannot be deleted.",
            "error"
        );

        return;
    }


    const ok =
        window.confirm(
            `Delete goal “${goal.name}”? Its contribution history will also be removed.`
        );


    if (!ok)
        return;


    showLoader();


    try {

        const {
            error: contributionError
        } =
            await sb
                .from("goal_contributions")
                .delete()
                .eq(
                    "goal_id",
                    goal.id
                )
                .eq(
                    "user_id",
                    state.user.id
                );


        if (contributionError)
            throw contributionError;


        const {
            error
        } =
            await sb
                .from("goals")
                .delete()
                .eq(
                    "id",
                    goal.id
                )
                .eq(
                    "user_id",
                    state.user.id
                );


        if (error)
            throw error;


        showToast(
            "Goal deleted.",
            "success"
        );


        await loadData();

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


/* =========================================================
   SETUP
========================================================= */

setupAppMenu();

setupTheme();

setupProfileMenu();


document
    .getElementById("goalForm")
    ?.addEventListener(
        "submit",
        saveGoal
    );


document
    .getElementById("clearGoalButton")
    ?.addEventListener(
        "click",
        resetGoalForm
    );


document
    .getElementById("goalModalClose")
    ?.addEventListener(
        "click",
        closeContributionModal
    );


document
    .getElementById("contributionCancel")
    ?.addEventListener(
        "click",
        closeContributionModal
    );


document
    .getElementById("contributionSave")
    ?.addEventListener(
        "click",
        saveContribution
    );


document
    .getElementById("goalModal")
    ?.addEventListener(
        "click",
        event => {

            if (
                event.target.id ===
                "goalModal"
            ) {
                closeContributionModal();
            }

        }
    );


document
    .getElementById("historyModalClose")
    ?.addEventListener(
        "click",
        closeHistoryModal
    );


document
    .getElementById("historyModal")
    ?.addEventListener(
        "click",
        event => {

            if (
                event.target.id ===
                "historyModal"
            ) {
                closeHistoryModal();
            }

        }
    );


/* =========================================================
   CURRENT + FINISHED GOAL ACTIONS
========================================================= */

function handleGoalAction(event) {

    const contribute =
        event.target.closest(
            "[data-contribute]"
        );


    const history =
        event.target.closest(
            "[data-history]"
        );


    const edit =
        event.target.closest(
            "[data-edit]"
        );


    const del =
        event.target.closest(
            "[data-delete]"
        );


    if (contribute) {

        openContributionModal(
            contribute.dataset.contribute
        );

        return;
    }


    if (history) {

        openHistoryModal(
            history.dataset.history
        );

        return;
    }


    if (edit) {

        fillGoalForm(
            edit.dataset.edit
        );

        return;
    }


    if (del) {

        deleteGoal(
            del.dataset.delete
        );

    }
}


document
    .getElementById("goalsGrid")
    ?.addEventListener(
        "click",
        handleGoalAction
    );


document
    .getElementById("finishedGoalsGrid")
    ?.addEventListener(
        "click",
        handleGoalAction
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

loadData();