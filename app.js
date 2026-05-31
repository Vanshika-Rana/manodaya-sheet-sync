/* global CONFIG */

const STORAGE_KEY = "manodaya-bookings";

let bookings = [];

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const entryForm = $("#entry-form");
const bookerSelect = $("#booker");
const typeSelect = $("#type");
const guestInput = $("#guest");
const roomSelect = $("#room");
const checkinInput = $("#checkin");
const checkoutInput = $("#checkout");
const amountInput = $("#amount");
const paymentSelect = $("#payment");
const hasFoodCheckbox = $("#hasFood");
const foodFields = $("#food-fields");
const foodAmountInput = $("#foodAmount");
const foodBillInput = $("#foodBill");
const contactInput = $("#contact");
const notesInput = $("#notes");
const saveBtn = $("#save-btn");
const guestError = $("#guest-error");
const amountError = $("#amount-error");
const successToast = $("#success-toast");
const syncDot = $("#sync-dot");
const syncLabel = $("#sync-label");
const ledgerList = $("#ledger-list");

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

function formatDateLabel(iso) {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatShortDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function bookingTotal(booking) {
  const room = Number(booking.amount) || 0;
  const food = booking.hasFood ? Number(booking.foodAmount) || 0 : 0;
  return room + food;
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function loadBookings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    bookings = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(bookings)) bookings = [];
  } catch {
    bookings = [];
  }
}

function saveBookings() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings));
}

function updateSyncDot() {
  const pending = bookings.some((b) => !b.synced);
  syncDot.classList.toggle("sync-dot--pending", pending);
  syncLabel.textContent = pending ? "Pending" : "Synced";
  syncDot.setAttribute(
    "aria-label",
    pending ? "Some bookings not synced" : "All bookings synced"
  );
}

async function syncBooking(booking) {
  if (!CONFIG.SHEET_URL || CONFIG.SHEET_URL.includes("PASTE_YOUR")) {
    return false;
  }

  try {
    await fetch(CONFIG.SHEET_URL, {
      method: "POST",
      mode: "no-cors",
      body: JSON.stringify(booking),
    });
    return true;
  } catch {
    return false;
  }
}

async function retryUnsynced() {
  let changed = false;

  for (const booking of bookings) {
    if (booking.synced) continue;
    const ok = await syncBooking(booking);
    if (ok) {
      booking.synced = true;
      changed = true;
    }
  }

  if (changed) {
    saveBookings();
    updateSyncDot();
    renderLedger();
  }
}

function populateSelect(select, options) {
  select.innerHTML = options
    .map((opt) => `<option value="${escapeHtml(opt)}">${escapeHtml(opt)}</option>`)
    .join("");
}

function populateRooms() {
  populateSelect(roomSelect, CONFIG.ROOMS);
}

function populateBookers() {
  populateSelect(bookerSelect, CONFIG.BOOKERS);
}

function updateSaveButtonStyle() {
  const isWalkin = typeSelect.value === "walkin";
  saveBtn.classList.toggle("btn-save--walkin", isWalkin);
}

function resetForm() {
  const savedType = typeSelect.value;
  entryForm.reset();
  typeSelect.value = savedType;
  checkinInput.value = todayISO();
  checkoutInput.value = todayISO();
  foodFields.hidden = true;
  updateSaveButtonStyle();
  clearErrors();
}

function clearErrors() {
  guestError.hidden = true;
  amountError.hidden = true;
  guestInput.classList.remove("field-input--error");
  amountInput.classList.remove("field-input--error");
}

function showError(el, errorEl, message) {
  errorEl.textContent = message;
  errorEl.hidden = false;
  el.classList.add("field-input--error");
}

function showToast(message, offline = false) {
  successToast.textContent = message;
  successToast.classList.toggle("success-toast--offline", offline);
  successToast.hidden = false;

  setTimeout(() => {
    successToast.hidden = true;
  }, 2000);
}

async function handleSave(e) {
  e.preventDefault();
  clearErrors();

  const guest = guestInput.value.trim();
  const amount = Number(amountInput.value);

  let valid = true;

  if (!guest) {
    showError(guestInput, guestError, "Guest name is required");
    valid = false;
  }

  if (!amountInput.value || amount <= 0) {
    showError(amountInput, amountError, "Enter a valid room amount");
    valid = false;
  }

  if (!valid) return;

  const booking = {
    id: Date.now(),
    date: todayISO(),
    booker: bookerSelect.value,
    guest,
    contact: contactInput.value.trim(),
    room: roomSelect.value,
    type: typeSelect.value,
    checkin: checkinInput.value,
    checkout: checkoutInput.value,
    amount,
    hasFood: hasFoodCheckbox.checked,
    foodAmount: hasFoodCheckbox.checked ? Number(foodAmountInput.value) || 0 : 0,
    foodBill: hasFoodCheckbox.checked ? foodBillInput.value.trim() : "",
    payment: paymentSelect.value,
    notes: notesInput.value.trim(),
    synced: false,
  };

  bookings.push(booking);
  saveBookings();

  const synced = await syncBooking(booking);
  if (synced) {
    booking.synced = true;
    saveBookings();
    showToast("Booking saved & synced ✓");
  } else {
    showToast("Saved offline — will sync when online", true);
  }

  updateSyncDot();
  renderLedger();
  renderSummary();
  resetForm();
}

function switchScreen(name) {
  $$(".screen").forEach((screen) => {
    const isActive = screen.id === `screen-${name}`;
    screen.classList.toggle("screen-active", isActive);
    screen.hidden = !isActive;
  });

  $$(".nav-btn").forEach((btn) => {
    const isActive = btn.dataset.screen === name;
    btn.classList.toggle("nav-btn--active", isActive);
    if (isActive) {
      btn.setAttribute("aria-current", "page");
    } else {
      btn.removeAttribute("aria-current");
    }
  });

  if (name === "ledger") renderLedger();
  if (name === "summary") renderSummary();
}

function groupByDate(items) {
  const groups = new Map();

  for (const booking of items) {
    const key = booking.date;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(booking);
  }

  return [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]));
}

function renderLedger() {
  if (!bookings.length) {
    ledgerList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon"><i class="ti ti-notebook" aria-hidden="true"></i></div>
        <p class="empty-state-title">No bookings yet</p>
        <p class="empty-state-text">Saved bookings will appear here, grouped by date.</p>
      </div>
    `;
    return;
  }

  const sorted = [...bookings].sort((a, b) => b.id - a.id);
  const groups = groupByDate(sorted);

  ledgerList.innerHTML = groups
    .map(([date, dayBookings]) => {
      const dayTotal = dayBookings.reduce((sum, b) => sum + bookingTotal(b), 0);

      const cards = dayBookings
        .map((b) => {
          const typeLabel = b.type === "online" ? "Pre-book" : "Walk-in";
          const badgeClass = b.type === "online" ? "badge--online" : "badge--walkin";
          const cardClass = b.type === "walkin" ? "booking-card--walkin" : "";
          const total = bookingTotal(b);

          return `
            <article class="booking-card ${cardClass}" data-id="${b.id}" tabindex="0" role="button" aria-expanded="false">
              <div class="booking-card-summary">
                <div class="booking-card-top">
                  <p class="booking-guest">${escapeHtml(b.guest)}</p>
                  <span class="badge ${badgeClass}">${typeLabel}</span>
                </div>
                <p class="booking-meta">${escapeHtml(b.room)}</p>
                ${b.booker ? `<p class="booking-booker"><i class="ti ti-user-check" aria-hidden="true"></i>${escapeHtml(b.booker)}</p>` : ""}
                <p class="booking-dates">
                  <i class="ti ti-calendar" aria-hidden="true"></i>
                  ${formatShortDate(b.checkin)} → ${formatShortDate(b.checkout)}
                </p>
                <p class="booking-total">${formatCurrency(total)}</p>
              </div>
              <div class="booking-card-details">
                <div class="detail-row"><span class="detail-label">Booked by</span><span class="detail-value">${escapeHtml(b.booker || "—")}</span></div>
                <div class="detail-row"><span class="detail-label">Contact</span><span class="detail-value">${escapeHtml(b.contact || "—")}</span></div>
                <div class="detail-row"><span class="detail-label">Room amount</span><span class="detail-value">${formatCurrency(b.amount)}</span></div>
                <div class="detail-row"><span class="detail-label">Food</span><span class="detail-value">${b.hasFood ? formatCurrency(b.foodAmount) + (b.foodBill ? ` (${escapeHtml(b.foodBill)})` : "") : "No"}</span></div>
                <div class="detail-row"><span class="detail-label">Payment</span><span class="detail-value">${escapeHtml(b.payment || "—")}</span></div>
                <div class="detail-row"><span class="detail-label">Notes</span><span class="detail-value">${escapeHtml(b.notes || "—")}</span></div>
                ${!b.synced ? '<span class="sync-badge"><i class="ti ti-cloud-off" aria-hidden="true"></i> Not synced yet</span>' : ""}
              </div>
            </article>
          `;
        })
        .join("");

      return `
        <div class="ledger-date-group">
          <div class="ledger-date-header">
            <h2 class="ledger-date-label">${formatDateLabel(date)}</h2>
            <p class="ledger-date-total">${formatCurrency(dayTotal)}</p>
          </div>
          ${cards}
        </div>
      `;
    })
    .join("");

  ledgerList.querySelectorAll(".booking-card").forEach((card) => {
    card.addEventListener("click", () => toggleCard(card));
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggleCard(card);
      }
    });
  });
}

function toggleCard(card) {
  const expanded = card.classList.toggle("booking-card--expanded");
  card.setAttribute("aria-expanded", String(expanded));
}

function getMonthBookings() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  return bookings.filter((b) => {
    const d = new Date(b.date + "T12:00:00");
    return d.getFullYear() === year && d.getMonth() === month;
  });
}

function renderSummary() {
  const today = todayISO();
  const todayTotal = bookings
    .filter((b) => b.date === today)
    .reduce((sum, b) => sum + bookingTotal(b), 0);

  const monthBookings = getMonthBookings();
  const monthTotal = monthBookings.reduce((sum, b) => sum + bookingTotal(b), 0);

  const onlineTotal = monthBookings
    .filter((b) => b.type === "online")
    .reduce((sum, b) => sum + bookingTotal(b), 0);

  const walkinTotal = monthBookings
    .filter((b) => b.type === "walkin")
    .reduce((sum, b) => sum + bookingTotal(b), 0);

  $("#summary-today").textContent = formatCurrency(todayTotal);
  $("#summary-month").textContent = formatCurrency(monthTotal);
  $("#summary-online").textContent = formatCurrency(onlineTotal);
  $("#summary-walkin").textContent = formatCurrency(walkinTotal);

  const roomTotals = {};
  for (const room of CONFIG.ROOMS) {
    roomTotals[room] = 0;
  }

  for (const b of monthBookings) {
    if (roomTotals[b.room] !== undefined) {
      roomTotals[b.room] += bookingTotal(b);
    } else {
      roomTotals[b.room] = bookingTotal(b);
    }
  }

  const roomList = $("#summary-rooms");
  const entries = Object.entries(roomTotals).filter(([, total]) => total > 0);

  if (!entries.length) {
    roomList.innerHTML = '<li class="room-list-empty">No room income this month yet.</li>';
  } else {
    roomList.innerHTML = entries
      .map(
        ([room, total]) => `
          <li class="room-list-item">
            <span class="room-list-name">${escapeHtml(room)}</span>
            <span class="room-list-amount">${formatCurrency(total)}</span>
          </li>
        `
      )
      .join("");
  }
}

function init() {
  loadBookings();
  populateRooms();
  populateBookers();
  checkinInput.value = todayISO();
  checkoutInput.value = todayISO();
  updateSaveButtonStyle();
  updateSyncDot();
  renderLedger();
  renderSummary();
  retryUnsynced();

  typeSelect.addEventListener("change", updateSaveButtonStyle);

  hasFoodCheckbox.addEventListener("change", () => {
    foodFields.hidden = !hasFoodCheckbox.checked;
  });

  entryForm.addEventListener("submit", handleSave);

  $$(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchScreen(btn.dataset.screen));
  });
}

init();
