/*
 * Financial Report PDF
 * --------------------
 * Builds and downloads the report PDF with pdfMake.
 *
 * Layout rules:
 *  - Nothing is ever cut in half: table rows never split across pages
 *    (dontBreakRows), headers repeat on every page, small blocks are kept
 *    together (unbreakable) and section titles never sit alone at the bottom
 *    of a page (pageBreakBefore).
 *  - Everything adapts to the data: columns with no data are hidden, long
 *    words are wrapped, amounts shrink to fit their card, big lists switch
 *    from side-by-side to full-width, empty sections show a clean message.
 */

/* ---------- Design tokens ---------- */
const COLORS = {
    ink: "#182230",
    muted: "#667085",
    line: "#e4e7ec",
    zebra: "#f8fafc",
    headBg: "#eef4ff",
    headText: "#243b53",
    brand: "#0b6b53",
    brandSoft: "#d1fae5",
    income: "#087443",
    expense: "#b42318",
    savings: "#b54708",
    net: "#175cd3",
    incomeBg: "#eaf8f1",
    expenseBg: "#fff0f1",
    savingsBg: "#fff6e8",
    netBg: "#edf5ff",
    track: "#e5e7eb"
};

const PAGE = {
    width: 595.28,                      // A4 portrait (pt)
    margin: { left: 32, right: 32, top: 46, bottom: 44 }
};
const CONTENT_WIDTH = PAGE.width - PAGE.margin.left - PAGE.margin.right;

/* Blocks with more rows than this may span pages (rows still never split). */
const MAX_KEEP_TOGETHER_ROWS = 18;
/* Lists longer than this stop being shown side-by-side. */
const MAX_SIDE_BY_SIDE_ROWS = 10;

const TYPE_COLOR = {
    income: COLORS.income,
    expense: COLORS.expense,
    savings: COLORS.savings
};

/* ---------- Small helpers ---------- */
const toNumber = value => Number(value || 0);
const sum = (rows, pick = row => row.amount) =>
    rows.reduce((total, row) => total + toNumber(pick(row)), 0);
const pct = (value, total) => (total > 0 ? (toNumber(value) / total) * 100 : 0);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const capitalize = text => (text ? text.charAt(0).toUpperCase() + text.slice(1) : "");

/* yyyy-mm-dd -> dd/mm/yy */
function shortDate(value) {
    if (!value) return "—";
    const parts = String(value).slice(0, 10).split("-");
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0].slice(-2)}` : String(value);
}

/* Lets very long unbroken strings wrap inside narrow cells. */
function wrapText(value, chunk = 16) {
    if (!value) return "—";
    return String(value)
        .split(/\s+/)
        .map(word => {
            if (word.length <= chunk) return word;
            const parts = [];
            for (let i = 0; i < word.length; i += chunk) parts.push(word.slice(i, i + chunk));
            return parts.join("\u200B");
        })
        .join(" ");
}

function makeMoney(currency) {
    const symbol = currency === "INR" ? "Rs." : currency;
    return value =>
        `${symbol} ${toNumber(value).toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;
}

function groupByCategory(rows, type) {
    const totals = {};
    rows
        .filter(row => row.transaction_type === type)
        .forEach(row => {
            const name = row.category_name || "Uncategorized";
            totals[name] = (totals[name] || 0) + toNumber(row.amount);
        });
    return Object.entries(totals).sort((a, b) => b[1] - a[1]);
}

/* ---------- Table layouts ---------- */
const tableLayout = {
    hLineWidth: (i, node) => (i === 0 || i === node.table.body.length ? 0.8 : 0.4),
    vLineWidth: () => 0,
    hLineColor: () => COLORS.line,
    paddingLeft: () => 8,
    paddingRight: () => 8,
    paddingTop: () => 6,
    paddingBottom: () => 6,
    fillColor: rowIndex => {
        if (rowIndex === 0) return COLORS.headBg;
        return rowIndex % 2 === 0 ? COLORS.zebra : null;
    }
};

const borderlessLayout = {
    hLineWidth: () => 0,
    vLineWidth: () => 0,
    paddingLeft: () => 0,
    paddingRight: () => 0,
    paddingTop: () => 0,
    paddingBottom: () => 0
};

/* Card with a coloured top edge. */
const cardLayout = accent => ({
    hLineWidth: i => (i === 0 ? 3 : 0.6),
    vLineWidth: () => 0.6,
    hLineColor: i => (i === 0 ? accent : COLORS.line),
    vLineColor: () => COLORS.line,
    paddingLeft: () => 0,
    paddingRight: () => 0,
    paddingTop: () => 0,
    paddingBottom: () => 0
});

/* ---------- Building blocks ---------- */
const headerRow = labels =>
    labels.map(item => {
        const cell = typeof item === "string" ? { text: item } : item;
        return { ...cell, style: "tableHeader" };
    });

const emptyRow = (message, columns) => [
    { text: message, colSpan: columns, color: COLORS.muted, italics: true, alignment: "center", margin: [0, 6, 0, 6] },
    ...Array(columns - 1).fill({})
];

/* Table that never splits a row and repeats its header on each page. */
function dataTable({ widths, body, extra = {} }) {
    return {
        table: { widths, body, headerRows: 1, keepWithHeaderRows: 1, dontBreakRows: true, ...extra },
        layout: tableLayout
    };
}

/*
 * Section = title + content.
 * Short sections are unbreakable (moved to the next page as a whole);
 * long sections may flow, but the title is never left alone at a page bottom.
 */
function section(title, content, { rows = 0, keepTogether = true, top = 16 } = {}) {
    const titleNode = {
        text: title,
        style: "sectionTitle",
        headlineLevel: 1,
        margin: [0, top, 0, 6]
    };

    if (keepTogether && rows <= MAX_KEEP_TOGETHER_ROWS) {
        return { unbreakable: true, stack: [titleNode, content] };
    }
    return { stack: [titleNode, content] };
}

/* Small horizontal bar drawn with canvas (width scales with the value). */
function progressBar(percentValue, color, width = 90, target = null) {
    const filled = clamp(percentValue, 0, 100) / 100 * width;
    const shapes = [
        { type: "rect", x: 0, y: 0, w: width, h: 6, r: 3, color: COLORS.track },
        ...(filled > 0 ? [{ type: "rect", x: 0, y: 0, w: Math.max(filled, 3), h: 6, r: 3, color }] : [])
    ];
    if (target !== null) {
        const x = clamp(target, 0, 100) / 100 * width;
        shapes.push({ type: "line", x1: x, y1: -2, x2: x, y2: 8, lineWidth: 1, lineColor: COLORS.ink });
    }
    return { canvas: shapes, margin: [0, 4, 0, 0] };
}

/* Amount text that shrinks so it always fits inside its card. */
function fitAmount(text, color) {
    const size = text.length <= 13 ? 15 : text.length <= 16 ? 13 : text.length <= 20 ? 11 : 9;
    return { text, fontSize: size, bold: true, color, margin: [0, 4, 0, 0], noWrap: false };
}

function kpiCard(label, value, color, background) {
    return {
        table: {
            widths: ["*"],
            body: [[{
                stack: [
                    { text: label.toUpperCase(), fontSize: 7, bold: true, color: COLORS.muted, characterSpacing: 0.6 },
                    fitAmount(value, color)
                ],
                fillColor: background,
                margin: [10, 10, 10, 10]
            }]]
        },
        layout: cardLayout(color)
    };
}

function totalRow(cells) {
    return cells.map(cell => ({ bold: true, fillColor: COLORS.headBg, ...cell }));
}

/* ---------- Main ---------- */
export function createReportPdf({
    rows = [],
    goalContributions = [],
    currency = "INR",
    periodLabel = "",
    fileName = "MyFinance Report"
}) {
    const money = makeMoney(currency);

    /* ----- Totals (same rules as the on-screen report) ----- */
    const expenseRows = rows.filter(row => row.transaction_type === "expense");
    const normalExpenses = sum(expenseRows.filter(row => !row.goal_id));
    const goalFundedExpenses = sum(expenseRows.filter(row => row.goal_id));
    const expenses = normalExpenses + goalFundedExpenses;
    const income = sum(rows.filter(row => row.transaction_type === "income"));
    const savingsTransactions = sum(rows.filter(row => row.transaction_type === "savings"));
    const goalContribTotal = sum(goalContributions);
    const totalSavings = savingsTransactions + goalContribTotal;
    const net = income - normalExpenses - savingsTransactions - goalContribTotal;

    const budgetSpend = type =>
        sum(expenseRows.filter(row => !row.goal_id && row.budget_type === type));
    const needs = budgetSpend("needs");
    const wants = budgetSpend("wants");

    const expenseItems = groupByCategory(rows, "expense");
    const incomeItems = groupByCategory(rows, "income");
    const vehicleRows = expenseRows.filter(row => row.vehicle_id);

    const generatedOn = new Intl.DateTimeFormat("en-IN", {
        day: "2-digit", month: "short", year: "numeric"
    }).format(new Date());

    /* ===== 1. Hero header ===== */
    const hero = {
        table: {
            widths: ["*", "auto"],
            body: [[
                {
                    stack: [
                        { text: "MyFinance", fontSize: 10, bold: true, color: COLORS.brandSoft, characterSpacing: 1 },
                        { text: "Financial Report", fontSize: 22, bold: true, color: "#ffffff", margin: [0, 3, 0, 3] },
                        { text: periodLabel, fontSize: 10, color: COLORS.brandSoft }
                    ],
                    margin: [18, 16, 8, 16]
                },
                {
                    stack: [
                        { text: "TRANSACTIONS", fontSize: 7, bold: true, color: COLORS.brandSoft, alignment: "right", characterSpacing: 0.6 },
                        { text: String(rows.length), fontSize: 20, bold: true, color: "#ffffff", alignment: "right" },
                        { text: `Generated ${generatedOn}`, fontSize: 7.5, color: COLORS.brandSoft, alignment: "right", margin: [0, 4, 0, 0] }
                    ],
                    margin: [8, 16, 18, 16]
                }
            ]]
        },
        layout: {
            ...borderlessLayout,
            fillColor: () => COLORS.brand
        },
        margin: [0, 0, 0, 14]
    };

    /* ===== 2. KPI cards (4 equal columns) ===== */
    const kpis = {
        columns: [
            kpiCard("Income", money(income), COLORS.income, COLORS.incomeBg),
            kpiCard("Expenses", money(expenses), COLORS.expense, COLORS.expenseBg),
            kpiCard("Savings", money(totalSavings), COLORS.savings, COLORS.savingsBg),
            kpiCard("Net After Allocations", money(net), net < 0 ? COLORS.expense : COLORS.net, COLORS.netBg)
        ],
        columnGap: 8,
        unbreakable: true
    };

    const formulaNote = {
        text: "Net After Allocations = Income − Normal Expenses − Savings − Goal Contributions. " +
            "Goal-funded expenses are shown in Expenses but are not deducted twice.",
        fontSize: 7.5,
        italics: true,
        color: COLORS.muted,
        margin: [0, 6, 0, 0]
    };

    /* ===== 3. Expense composition ===== */
    const compositionBody = [
        headerRow(["Expense Type", { text: "Amount", alignment: "right" }, { text: "Share", alignment: "right" }]),
        ["Normal Expenses", { text: money(normalExpenses), alignment: "right" }, { text: `${pct(normalExpenses, expenses).toFixed(1)}%`, alignment: "right" }],
        ["Goal-Funded Expenses", { text: money(goalFundedExpenses), alignment: "right" }, { text: `${pct(goalFundedExpenses, expenses).toFixed(1)}%`, alignment: "right" }],
        totalRow([{ text: "Total Expenses" }, { text: money(expenses), alignment: "right" }, { text: expenses > 0 ? "100.0%" : "0.0%", alignment: "right" }])
    ];
    const composition = section(
        "Expense Composition",
        dataTable({ widths: ["*", "auto", 54], body: compositionBody }),
        { rows: compositionBody.length }
    );

    /* ===== 4. Category breakdowns ===== */
    const categoryTable = (items, total, color) => {
        const body = [
            headerRow(["Category", { text: "Amount", alignment: "right" }, { text: "Share", alignment: "right" }]),
            ...(items.length
                ? items.map(([name, value]) => [
                    { text: wrapText(name, 14) },
                    { text: money(value), alignment: "right", color },
                    { text: `${pct(value, total).toFixed(1)}%`, alignment: "right", color: COLORS.muted }
                ])
                : [emptyRow("No data", 3)])
        ];
        return { table: dataTable({ widths: ["*", "auto", 40], body }), rowCount: body.length };
    };

    const expenseTable = categoryTable(expenseItems, expenses, COLORS.expense);
    const incomeTable = categoryTable(incomeItems, income, COLORS.income);
    const sideBySide = Math.max(expenseTable.rowCount, incomeTable.rowCount) <= MAX_SIDE_BY_SIDE_ROWS;

    const breakdowns = sideBySide
        ? {
            unbreakable: true,
            stack: [
                {
                    columns: [
                        { width: "*", stack: [{ text: "Expense Breakdown", style: "sectionTitle", headlineLevel: 1 }, expenseTable.table] },
                        { width: "*", stack: [{ text: "Income Breakdown", style: "sectionTitle", headlineLevel: 1 }, incomeTable.table] }
                    ],
                    columnGap: 14,
                    margin: [0, 16, 0, 0]
                }
            ]
        }
        : {
            stack: [
                section("Expense Breakdown", expenseTable.table, { rows: expenseTable.rowCount }),
                section("Income Breakdown", incomeTable.table, { rows: incomeTable.rowCount })
            ]
        };

    /* ===== 5. Needs / Wants / Savings (with progress vs 50/30/20 target) ===== */
    const budgetLine = (name, value, target, color) => {
        const share = pct(value, income);
        return [
            { text: name, bold: true },
            { text: money(value), alignment: "right" },
            { text: `${share.toFixed(1)}%`, alignment: "right" },
            { text: `${target}%`, alignment: "right", color: COLORS.muted },
            progressBar(share, color, 90, target)
        ];
    };
    const budgetBody = [
        headerRow(["Allocation", { text: "Amount", alignment: "right" }, { text: "% of Income", alignment: "right" }, { text: "Target", alignment: "right" }, "Progress"]),
        budgetLine("Needs", needs, 50, COLORS.net),
        budgetLine("Wants", wants, 30, COLORS.savings),
        budgetLine("Savings", totalSavings, 20, COLORS.income),
        [
            { text: "Goal Contributions (included in Savings)", color: COLORS.muted, italics: true },
            { text: money(goalContribTotal), alignment: "right", color: COLORS.muted },
            { text: `${pct(goalContribTotal, income).toFixed(1)}%`, alignment: "right", color: COLORS.muted },
            { text: "", },
            { text: "" }
        ]
    ];
    const budget = section(
        "Needs / Wants / Savings",
        dataTable({ widths: ["*", "auto", "auto", 36, 90], body: budgetBody }),
        { rows: budgetBody.length }
    );

    /* ===== 6. Goal contributions ===== */
    const goalBody = [
        headerRow(["Goal", "Date", { text: "Amount", alignment: "right" }]),
        ...(goalContributions.length
            ? goalContributions.map(row => [
                { text: wrapText(row.goal_name || "Goal", 24) },
                { text: shortDate(row.contribution_date) },
                { text: money(row.amount), alignment: "right", color: COLORS.income }
            ])
            : [emptyRow("No goal contributions", 3)]),
        ...(goalContributions.length
            ? [totalRow([{ text: "Total" }, { text: "" }, { text: money(goalContribTotal), alignment: "right" }])]
            : [])
    ];
    const goals = section(
        "Goal Contributions",
        dataTable({ widths: ["*", 54, "auto"], body: goalBody }),
        { rows: goalBody.length }
    );

    /* ===== 7. Vehicle expenses ===== */
    const vehicleBody = [
        headerRow(["Vehicle", "Category", "Date", { text: "Amount", alignment: "right" }]),
        ...(vehicleRows.length
            ? vehicleRows.map(row => [
                { text: wrapText(row.vehicle_name || "Vehicle", 18) },
                { text: wrapText(row.category_name || "Other Expense", 18) },
                { text: shortDate(row.transaction_date) },
                { text: money(row.amount), alignment: "right", color: COLORS.expense }
            ])
            : [emptyRow("No vehicle expenses", 4)]),
        ...(vehicleRows.length
            ? [totalRow([{ text: "Total" }, { text: "" }, { text: "" }, { text: money(sum(vehicleRows)), alignment: "right" }])]
            : [])
    ];
    const vehicles = section(
        "Vehicle Expenses",
        dataTable({ widths: ["*", "*", 54, "auto"], body: vehicleBody }),
        { rows: vehicleBody.length }
    );

    /* ===== 8. Detailed transactions (columns adapt to the data) ===== */
    const hasBudget = rows.some(row => row.budget_type === "needs" || row.budget_type === "wants");
    const hasVehicle = rows.some(row => row.vehicle_name);

    const columns = [
        { key: "no", label: "#", width: 20, cell: (_, i) => ({ text: String(i + 1), alignment: "center", color: COLORS.muted }) },
        { key: "date", label: "Date", width: 44, cell: row => ({ text: shortDate(row.transaction_date) }) },
        {
            key: "type", label: "Type", width: 42,
            cell: row => ({ text: capitalize(row.transaction_type), bold: true, color: TYPE_COLOR[row.transaction_type] || COLORS.ink })
        },
        { key: "category", label: "Category", width: hasBudget || hasVehicle ? 78 : 96, cell: row => ({ text: wrapText(row.category_name || "Uncategorized", 14) }) },
        ...(hasBudget
            ? [{
                key: "budget", label: "Budget", width: 36,
                cell: row => ({ text: row.budget_type === "needs" ? "Need" : row.budget_type === "wants" ? "Want" : "—", color: COLORS.muted })
            }]
            : []),
        ...(hasVehicle
            ? [{ key: "vehicle", label: "Vehicle", width: 58, cell: row => ({ text: wrapText(row.vehicle_name || "—", 12) }) }]
            : []),
        { key: "desc", label: "Description", width: "*", cell: row => ({ text: wrapText(row.description || row.notes || "—", 20) }) },
        {
            key: "amount", label: "Amount", width: "auto", align: "right",
            cell: row => ({ text: money(row.amount), alignment: "right", bold: true, color: TYPE_COLOR[row.transaction_type] || COLORS.ink, noWrap: true })
        }
    ];

    const detailBody = [
        headerRow(columns.map(col => ({ text: col.label, alignment: col.align || (col.key === "no" ? "center" : "left") }))),
        ...(rows.length
            ? rows.map((row, index) => columns.map(col => col.cell(row, index)))
            : [emptyRow("No transactions in this period", columns.length)])
    ];
    const details = {
        stack: [
            { text: "Detailed Transactions", style: "sectionTitle", headlineLevel: 1, margin: [0, 16, 0, 6] },
            {
                table: {
                    widths: columns.map(col => col.width),
                    body: detailBody,
                    headerRows: 1,
                    keepWithHeaderRows: 2,      // header + at least the first row stay together
                    dontBreakRows: true
                },
                layout: { ...tableLayout, paddingTop: () => 5, paddingBottom: () => 5, paddingLeft: () => 5, paddingRight: () => 5 }
            }
        ]
    };

    /* ===== Document ===== */
    const docDefinition = {
        pageSize: "A4",
        pageMargins: [PAGE.margin.left, PAGE.margin.top, PAGE.margin.right, PAGE.margin.bottom],
        defaultStyle: { font: "Roboto", fontSize: 9, color: COLORS.ink, lineHeight: 1.15 },
        info: { title: `MyFinance Financial Report — ${periodLabel}`, author: "MyFinance" },

        /* Slim running header on pages 2+ (page 1 has the hero). */
        header: page =>
            page === 1
                ? null
                : {
                    margin: [PAGE.margin.left, 20, PAGE.margin.right, 0],
                    columns: [
                        { text: "MyFinance · Financial Report", fontSize: 8, bold: true, color: COLORS.brand },
                        { text: periodLabel, fontSize: 8, color: COLORS.muted, alignment: "right" }
                    ]
                },

        footer: (page, pageCount) => ({
            margin: [PAGE.margin.left, 0, PAGE.margin.right, 18],
            columns: [
                { text: `MyFinance · ${periodLabel}`, fontSize: 8, color: COLORS.muted },
                { text: `Page ${page} of ${pageCount}`, fontSize: 8, color: COLORS.muted, alignment: "right" }
            ]
        }),

        /* Never leave a section title stranded at the bottom of a page. */
        pageBreakBefore: (currentNode, followingNodesOnPage) =>
            currentNode.headlineLevel === 1 && followingNodesOnPage.length === 0,

        content: [
            hero,
            kpis,
            formulaNote,
            composition,
            breakdowns,
            budget,
            goals,
            vehicles,
            details
        ],

        styles: {
            sectionTitle: { fontSize: 12, bold: true, color: COLORS.net },
            tableHeader: { fontSize: 8, bold: true, color: COLORS.headText }
        }
    };

    window.pdfMake.createPdf(docDefinition).download(`${fileName}.pdf`);
}
