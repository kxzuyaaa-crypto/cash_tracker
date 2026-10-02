const STORAGE_KEY = "cashTrackerData_v1";
const THEME_KEY = "cashTrackerTheme_v1";

const $ = (id) => document.getElementById(id);

const state = loadState();

function today() {
  return new Date().toISOString().slice(0, 10);
}

function defaultState() {
  return { transactions: [], recurring: [] };
}

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || defaultState();
  } catch {
    return defaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function money(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP"
  }).format(Number(value) || 0);
}

function formatDate(dateString) {
  return new Date(dateString + "T00:00:00").toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function addDays(date, days) {
  const d = new Date(date + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function addMonths(date, months) {
  const d = new Date(date + "T00:00:00");
  const originalDay = d.getDate();
  d.setMonth(d.getMonth() + months, 1);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(originalDay, lastDay));
  return d.toISOString().slice(0, 10);
}

function processRecurring() {
  let changed = false;
  const now = today();

  state.recurring.forEach(rule => {
    let next = rule.nextDate || rule.startDate;

    while (next <= now) {
      state.transactions.push({
        id: crypto.randomUUID(),
        type: "income",
        amount: Number(rule.amount),
        description: `${rule.description || "Automated cash addition"} (${rule.frequency})`,
        date: next,
        automated: true
      });

      if (rule.frequency === "daily") next = addDays(next, 1);
      if (rule.frequency === "weekly") next = addDays(next, 7);
      if (rule.frequency === "monthly") next = addMonths(next, 1);

      changed = true;
    }

    rule.nextDate = next;
  });

  if (changed) saveState();
}

function render() {
  processRecurring();

  const totalIncome = state.transactions
    .filter(t => t.type === "income")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const totalExpense = state.transactions
    .filter(t => t.type === "expense")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  $("totalIncome").textContent = money(totalIncome);
  $("totalExpense").textContent = money(totalExpense);
  $("balance").textContent = money(totalIncome - totalExpense);

  renderTransactions();
  renderRecurring();
}

function renderTransactions() {
  const filter = $("filterType").value;
  const list = $("transactionList");

  let transactions = [...state.transactions]
    .filter(t => filter === "all" || t.type === filter)
    .sort((a, b) => b.date.localeCompare(a.date));

  list.innerHTML = "";
  $("emptyState").style.display = transactions.length ? "none" : "block";

  transactions.forEach(t => {
    const item = document.createElement("div");
    item.className = "transaction";

    const sign = t.type === "income" ? "+" : "-";
    const cls = t.type === "income" ? "income-text" : "expense-text";
    const label = t.type === "income" ? "Cash added" : "Expense";

    item.innerHTML = `
      <div class="transaction-main">
        <div class="transaction-title">${escapeHtml(t.description || label)}</div>
        <div class="transaction-meta">${label} • ${formatDate(t.date)}${t.automated ? " • Automated" : ""}</div>
      </div>
      <div>
        <div class="transaction-amount ${cls}">${sign}${money(t.amount)}</div>
        <button class="delete-btn" title="Delete transaction" data-id="${t.id}">Delete</button>
      </div>
    `;

    item.querySelector(".delete-btn").addEventListener("click", () => {
      state.transactions = state.transactions.filter(x => x.id !== t.id);
      saveState();
      render();
    });

    list.appendChild(item);
  });
}

function renderRecurring() {
  const list = $("recurringList");
  list.innerHTML = "";
  $("recurringEmpty").style.display = state.recurring.length ? "none" : "block";

  state.recurring.forEach(rule => {
    const item = document.createElement("div");
    item.className = "recurring-item";
    item.innerHTML = `
      <div class="recurring-main">
        <div class="transaction-title">${escapeHtml(rule.description || "Automated cash addition")}</div>
        <div class="recurring-meta">${money(rule.amount)} • ${capitalize(rule.frequency)} • Next: ${formatDate(rule.nextDate)}</div>
      </div>
      <button class="delete-btn" title="Delete automated addition" data-id="${rule.id}">Delete</button>
    `;

    item.querySelector(".delete-btn").addEventListener("click", () => {
      state.recurring = state.recurring.filter(x => x.id !== rule.id);
      saveState();
      render();
    });

    list.appendChild(item);
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[char]));
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function openTransaction(type) {
  $("transactionType").value = type;
  $("transactionTitle").textContent = type === "income" ? "Add Cash" : "Add Expense";
  $("amount").value = "";
  $("description").value = "";
  $("transactionDate").value = today();
  $("transactionDialog").showModal();
  $("amount").focus();
}

$("addCashBtn").addEventListener("click", () => openTransaction("income"));
$("addExpenseBtn").addEventListener("click", () => openTransaction("expense"));

$("transactionForm").addEventListener("submit", event => {
  event.preventDefault();

  const amount = Number($("amount").value);
  if (!amount || amount <= 0) return;

  state.transactions.push({
    id: crypto.randomUUID(),
    type: $("transactionType").value,
    amount,
    description: $("description").value.trim(),
    date: $("transactionDate").value
  });

  saveState();
  $("transactionDialog").close();
  render();
});

$("cancelTransaction").addEventListener("click", () => $("transactionDialog").close());
$("closeTransaction").addEventListener("click", () => $("transactionDialog").close());

$("recurringBtn").addEventListener("click", () => {
  $("recurringAmount").value = "";
  $("recurringDescription").value = "";
  $("frequency").value = "weekly";
  $("recurringStart").value = today();
  $("recurringDialog").showModal();
});

$("recurringForm").addEventListener("submit", event => {
  event.preventDefault();

  const amount = Number($("recurringAmount").value);
  const startDate = $("recurringStart").value;
  if (!amount || amount <= 0 || !startDate) return;

  state.recurring.push({
    id: crypto.randomUUID(),
    amount,
    description: $("recurringDescription").value.trim(),
    frequency: $("frequency").value,
    startDate,
    nextDate: startDate
  });

  saveState();
  $("recurringDialog").close();
  render();
});

$("cancelRecurring").addEventListener("click", () => $("recurringDialog").close());
$("closeRecurring").addEventListener("click", () => $("recurringDialog").close());
$("filterType").addEventListener("change", renderTransactions);

function applyTheme() {
  const dark = localStorage.getItem(THEME_KEY) === "dark";
  document.body.classList.toggle("dark", dark);
  $("themeToggle").textContent = dark ? "☀️" : "🌙";
  $("themeToggle").setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
}

$("themeToggle").addEventListener("click", () => {
  const dark = !document.body.classList.contains("dark");
  localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
  applyTheme();
});

applyTheme();
render();
