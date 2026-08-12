/* global CONFIG */

const STORAGE_KEY = "manodaya-bookings";

let bookings = [];

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const entryForm = $("#entry-form");
const receiptInput = $("#receipt");
const bookerSelect = $("#booker");
const typeSelect = $("#type");
const guestInput = $("#guest");
const roomTypeCountInputs = $$(".room-type-count");
const totalRoomsDisplay = $("#totalRoomsDisplay");
const checkinInput = $("#checkin");
const checkoutInput = $("#checkout");
const amountInput = $("#amount");
const paymentSelect = $("#payment");
const hasFoodCheckbox = $("#hasFood");
const foodFields = $("#food-fields");
const mealPlanSelect = $("#mealPlan");
const mealPlanOtherField = $("#meal-plan-other-field");
const mealPlanOtherInput = $("#mealPlanOther");
const foodAmountInput = $("#foodAmount");
const foodBillInput = $("#foodBill");
const contactInput = $("#contact");
const notesInput = $("#notes");
const saveBtn = $("#save-btn");
const receiptError = $("#receipt-error");
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

function mealPlanLabel(booking) {
  if (!booking.hasFood) return "";
  if (booking.mealPlan === "Other") {
    return booking.mealPlanOther ? booking.mealPlanOther : "Other";
  }
  return booking.mealPlan || "";
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
    const params = new URLSearchParams();
    params.append("data", JSON.stringify(booking));

    await fetch(CONFIG.SHEET_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
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

function populateBookers() {
  const bookers = CONFIG.BOOKERS || ["Virender Rana", "Rakesh Rana"];
  bookerSelect.innerHTML = bookers
    .map((opt) => `<option value="${escapeHtml(opt)}">${escapeHtml(opt)}</option>`)
    .join("");
}

function updateSaveButtonStyle() {
  const isWalkin = typeSelect.value === "walkin";
  saveBtn.classList.toggle("btn-save--walkin", isWalkin);
}

function getRoomTypeBreakdown() {
  return [...roomTypeCountInputs]
    .map((input) => ({
      type: input.dataset.roomType,
      count: Number(input.value) || 0,
    }))
    .filter((r) => r.count > 0);
}

function getTotalRooms() {
  return [...roomTypeCountInputs].reduce((sum, input) => sum + (Number(input.value) || 0), 0);
}

function updateTotalRoomsDisplay() {
  totalRoomsDisplay.textContent = String(getTotalRooms());
}

function roomTypeText(breakdown) {
  if (!breakdown || !breakdown.length) return "—";
  return breakdown.map((r) => `${r.type} x${r.count}`).join(", ");
}

function resetForm() {
  const savedType = typeSelect.value;
  entryForm.reset();
  typeSelect.value = savedType;
  checkinInput.value = todayISO();
  checkoutInput.value = todayISO();
  roomTypeCountInputs.forEach((input) => { input.value = 0; });
  updateTotalRoomsDisplay();
  foodFields.hidden = true;
  mealPlanOtherField.hidden = true;
  updateSaveButtonStyle();
  clearErrors();
}

function clearErrors() {
  receiptError.hidden = true;
  guestError.hidden = true;
  amountError.hidden = true;
  receiptInput.classList.remove("field-input--error");
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

  const receipt = receiptInput.value.trim();
  const guest = guestInput.value.trim();
  const amount = Number(amountInput.value);

  let valid = true;

  if (!receipt) {
    showError(receiptInput, receiptError, "Receipt no. is required");
    valid = false;
  }

  if (!guest) {
    showError(guestInput, guestError, "Guest name is required");
    valid = false;
  }

  if (!amountInput.value || amount <= 0) {
    showError(amountInput, amountError, "Enter a valid room amount");
    valid = false;
  }

  if (!valid) return;

  const roomTypeBreakdown = getRoomTypeBreakdown();
  const totalRooms = getTotalRooms();
  const isOther = hasFoodCheckbox.checked && mealPlanSelect.value === "Other";

  const booking = {
    id: Date.now(),
    date: todayISO(),
    receipt,
    booker: bookerSelect.value,
    guest,
    contact: contactInput.value.trim(),
    roomTypeBreakdown,
    totalRooms,
    type: typeSelect.value,
    checkin: checkinInput.value,
    checkout: checkoutInput.value,
    amount,
    hasFood: hasFoodCheckbox.checked,
    mealPlan: hasFoodCheckbox.checked ? mealPlanSelect.value : "",
    mealPlanOther: isOther ? mealPlanOtherInput.value.trim() : "",
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
          const roomTypesLabel = roomTypeText(b.roomTypeBreakdown);
          const meal = mealPlanLabel(b);

          return `
            <article class="booking-card ${cardClass}" data-id="${b.id}" tabindex="0" role="button" aria-expanded="false">
              <div class="booking-card-summary">
                <div class="booking-card-top">
                  <p class="booking-guest">${escapeHtml(b.guest)}</p>
                  <span class="badge ${badgeClass}">${typeLabel}</span>
                </div>
                <p class="booking-meta">${escapeHtml(roomTypesLabel)}${b.totalRooms ? ` · ${b.totalRooms} room(s)` : ""}</p>
                ${b.booker ? `<p class="booking-booker"><i class="ti ti-user-check" aria-hidden="true"></i>${escapeHtml(b.booker)}</p>` : ""}
                <p class="booking-dates">
                  <i class="ti ti-calendar" aria-hidden="true"></i>
                  ${formatShortDate(b.checkin)} → ${formatShortDate(b.checkout)}
                </p>
                <p class="booking-total">${formatCurrency(total)}</p>
              </div>
              <div class="booking-card-details">
                <div class="detail-row"><span class="detail-label">Receipt no.</span><span class="detail-value">${escapeHtml(b.receipt || "—")}</span></div>
                <div class="detail-row"><span class="detail-label">Booked by</span><span class="detail-value">${escapeHtml(b.booker || "—")}</span></div>
                <div class="detail-row"><span class="detail-label">Contact</span><span class="detail-value">${escapeHtml(b.contact || "—")}</span></div>
                <div class="detail-row"><span class="detail-label">Room type</span><span class="detail-value">${escapeHtml(roomTypesLabel)}</span></div>
                <div class="detail-row"><span class="detail-label">Total rooms</span><span class="detail-value">${escapeHtml(b.totalRooms || "—")}</span></div>
                <div class="detail-row"><span class="detail-label">Room amount</span><span class="detail-value">${formatCurrency(b.amount)}</span></div>
                <div class="detail-row"><span class="detail-label">Meal plan</span><span class="detail-value">${meal ? escapeHtml(meal) : "—"}</span></div>
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

  // Sum of actual room counts per type (not just booking counts), now
  // that each booking records how many of each type was taken.
  const roomTypeCounts = {};
  for (const b of monthBookings) {
    const breakdown = (b.roomTypeBreakdown && b.roomTypeBreakdown.length)
      ? b.roomTypeBreakdown
      : [{ type: "Unspecified", count: b.totalRooms || 0 }];
    for (const r of breakdown) {
      roomTypeCounts[r.type] = (roomTypeCounts[r.type] || 0) + r.count;
    }
  }

  const roomList = $("#summary-rooms");
  const entries = Object.entries(roomTypeCounts).filter(([, count]) => count > 0).sort((a, b) => b[1] - a[1]);

  if (!entries.length) {
    roomList.innerHTML = '<li class="room-list-empty">No bookings this month yet.</li>';
  } else {
    roomList.innerHTML = entries
      .map(
        ([type, count]) => `
          <li class="room-list-item">
            <span class="room-list-name">${escapeHtml(type)}</span>
            <span class="room-list-amount">${count} room${count === 1 ? "" : "s"}</span>
          </li>
        `
      )
      .join("");
  }
}

function init() {
  loadBookings();
  populateBookers();
  checkinInput.value = todayISO();
  checkoutInput.value = todayISO();
  updateSaveButtonStyle();
  updateSyncDot();
  updateTotalRoomsDisplay();
  renderLedger();
  renderSummary();
  retryUnsynced();

  roomTypeCountInputs.forEach((input) => {
    input.addEventListener("input", updateTotalRoomsDisplay);
  });

  typeSelect.addEventListener("change", updateSaveButtonStyle);

  hasFoodCheckbox.addEventListener("change", () => {
    foodFields.hidden = !hasFoodCheckbox.checked;
    if (!hasFoodCheckbox.checked) {
      mealPlanOtherField.hidden = true;
    }
  });

  mealPlanSelect.addEventListener("change", () => {
    mealPlanOtherField.hidden = mealPlanSelect.value !== "Other";
  });

  entryForm.addEventListener("submit", handleSave);

  $$(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchScreen(btn.dataset.screen));
  });
}

init();