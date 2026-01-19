/**
 * bookingFlowHandler.js (UPDATED — ADD DAYS + RESET FIX)
 *
 * Responsibilities:
 * - Handle booking flow: day → time → name → phone → service
 * - Handle cancel flow: detect → ask for phone → cancel
 * - Handle interactive buttons (days + slots + services)
 * - Handle global reset/restart to stop any flow
 */

const {
  askAI,
  sendTextMessage,
  sendAppointmentOptions, // now accepts (to, day)
  insertBookingToSupabase,
  askForCancellationPhone,
  processCancellation,
  sendDayOptions, // ✅ NEW (we will add in helpers.js below)
} = require("./helpers");

const { isBookingRequest, isCancelRequest } = require("./messageHandlers");

const {
  handleNameStep,
  handlePhoneStep,
  handleServiceStep,
} = require("./bookingSteps");

// ---------------------------------------------
// 🧠 Sessions = per-user conversation state
// ---------------------------------------------
const sessions = {}; // { userId: { ...state } }

function getSession(userId) {
  if (!sessions[userId]) {
    sessions[userId] = {
      waitingForOffersConfirmation: false,
      waitingForDoctorConfirmation: false,
      waitingForBookingDetails: false,
      waitingForCancelPhone: false,
      lastIntent: null,
    };
  }
  return sessions[userId];
}

// ---------------------------------------------
// 🔁 Global reset keywords
// ---------------------------------------------
function isResetRequest(text = "") {
  const t = text.trim().toLowerCase();
  const words = [
    "reset",
    "restart",
    "start over",
    "begin again",
    "main menu",
    "menu",
    "الغاء",
    "إلغاء",
    "كنسل",
    "ابدأ من جديد",
    "ريست",
    "اعادة",
    "إعادة",
    "صفّر",
    "ابدأ",
    "القائمة",
  ];
  return words.some((w) => t === w || t.includes(w));
}

/**
 * ===========================
 *  📌 HANDLE BUTTON MESSAGES
 * ===========================
 */
async function handleInteractiveMessage(message, from, tempBookings) {
  const itype = message.interactive?.type;

  const id =
    itype === "list_reply"
      ? message.interactive?.list_reply?.id
      : message.interactive?.button_reply?.id;

  console.log("🔘 Interactive message received:", { from, id, type: itype });

  // ========== DAY BUTTON ==========
  // day_2026-01-19
  if (id?.startsWith("day_")) {
    const day = id.replace("day_", ""); // YYYY-MM-DD

    if (!tempBookings[from]) tempBookings[from] = {};
    tempBookings[from].day = day;

    await sendTextMessage(
      from,
      `✅ تم اختيار اليوم: ${day}\n⏰ الآن اختر الوقت:`,
    );
    await sendAppointmentOptions(from, day); // ✅ pass day
    return;
  }

  // ========== APPOINTMENT SLOT BUTTON ==========
  // slot_9 PM
  if (id?.startsWith("slot_")) {
    const time = id.replace("slot_", "").toUpperCase(); // e.g. "9 PM"

    if (!tempBookings[from] || !tempBookings[from].day) {
      await sendTextMessage(from, "📅 قبل اختيار الوقت، اختر اليوم أولاً:");
      await sendDayOptions(from);
      return;
    }

    const day = tempBookings[from].day;

    tempBookings[from].time = time;
    tempBookings[from].appointment = `${day} ${time}`;

    await sendTextMessage(from, "👍 تم اختيار الموعد! الآن أرسل اسمك:");
    return;
  }

  // ========== SERVICE BUTTON (FIXED) ==========
  if (id?.startsWith("service_")) {
    const serviceName = id.replace("service_", "");

    console.log("💊 Service selected:", serviceName);
    console.log("📋 Current booking state:", tempBookings[from]);

    if (!tempBookings[from]) {
      console.log("❌ No booking found for user:", from);
      await sendTextMessage(
        from,
        "⚠️ يجب إكمال خطوات الحجز قبل اختيار الخدمة.",
      );
      return;
    }

    if (!tempBookings[from].phone) {
      console.log("❌ Phone missing for user:", from);
      await sendTextMessage(
        from,
        "⚠️ يجب إكمال خطوات الحجز قبل اختيار الخدمة.",
      );
      return;
    }

    tempBookings[from].service = serviceName;
    const booking = tempBookings[from];

    console.log("✅ Complete booking:", booking);

    await insertBookingToSupabase(booking);

    await sendTextMessage(
      from,
      `✅ تم حفظ حجزك بنجاح:\n👤 ${booking.name}\n📱 ${booking.phone}\n💊 ${booking.service}\n📅 ${booking.appointment}`,
    );

    delete tempBookings[from];
    return;
  }
}

/**
 * ===========================
 *  💬 HANDLE TEXT MESSAGES
 * ===========================
 */
async function handleTextMessage(text, from, tempBookings) {
  const session = getSession(from);
  const rawText = text || "";
  const t = rawText.trim();

  // ---------------------------------------------
  // ✅ GLOBAL RESET (stop anything)
  // ---------------------------------------------
  if (isResetRequest(t)) {
    if (tempBookings[from]) delete tempBookings[from];

    session.waitingForCancelPhone = false;
    session.waitingForBookingDetails = false;
    session.lastIntent = null;

    await sendTextMessage(from, "✅ تم إعادة الضبط. اكتب BOOK لبدء حجز جديد.");
    return;
  }

  /**
   * ---------------------------------------------
   * 🔥 CANCEL BOOKING SYSTEM
   * ---------------------------------------------
   */

  // Step 1 — Detect cancel intent
  if (isCancelRequest(t)) {
    session.waitingForCancelPhone = true;

    // stop any booking flow currently running
    if (tempBookings[from]) delete tempBookings[from];

    await askForCancellationPhone(from);
    return;
  }

  // Step 2 — Waiting for phone input to cancel booking
  if (session.waitingForCancelPhone) {
    const phone = t.replace(/\D/g, "");

    if (phone.length < 8) {
      await sendTextMessage(from, "⚠️ رقم الجوال غير صحيح. حاول مجددًا:");
      return;
    }

    session.waitingForCancelPhone = false;
    await processCancellation(from, phone);
    return;
  }

  /**
   * ---------------------------------------------
   * 🔥 BOOKING FLOW
   * ---------------------------------------------
   */

  // User wants to start booking
  if (!tempBookings[from] && isBookingRequest(t)) {
    tempBookings[from] = {}; // start booking object
    await sendDayOptions(from); // ✅ day first
    return;
  }

  // If booking exists but day not chosen yet
  if (tempBookings[from] && !tempBookings[from].day) {
    // Allow "today/tomorrow" simple support (optional)
    const low = t.toLowerCase();
    if (low === "today" || t === "اليوم") {
      const d = new Date().toISOString().slice(0, 10);
      tempBookings[from].day = d;
      await sendTextMessage(
        from,
        `✅ تم اختيار اليوم: ${d}\n⏰ الآن اختر الوقت:`,
      );
      await sendAppointmentOptions(from, d);
      return;
    }
    if (low === "tomorrow" || t === "بكرا" || t === "غدا") {
      const d0 = new Date();
      d0.setDate(d0.getDate() + 1);
      const d = d0.toISOString().slice(0, 10);
      tempBookings[from].day = d;
      await sendTextMessage(
        from,
        `✅ تم اختيار اليوم: ${d}\n⏰ الآن اختر الوقت:`,
      );
      await sendAppointmentOptions(from, d);
      return;
    }

    // Otherwise force day options
    await sendTextMessage(from, "📅 اختر اليوم من الخيارات 👇");
    await sendDayOptions(from);
    return;
  }

  // Quick shortcut (3,6,9 → PM) AFTER day is set
  if (
    tempBookings[from] &&
    tempBookings[from].day &&
    !tempBookings[from].appointment &&
    ["3", "6", "9"].includes(t)
  ) {
    const time = `${t} PM`;
    tempBookings[from].time = time;
    tempBookings[from].appointment = `${tempBookings[from].day} ${time}`;

    await sendTextMessage(from, "👍 تم اختيار الموعد! الآن أرسل اسمك:");
    return;
  }

  // NAME STEP
  if (
    tempBookings[from] &&
    tempBookings[from].appointment &&
    !tempBookings[from].name
  ) {
    await handleNameStep(t, from, tempBookings);
    return;
  }

  // PHONE STEP
  if (
    tempBookings[from] &&
    tempBookings[from].name &&
    !tempBookings[from].phone
  ) {
    await handlePhoneStep(t, from, tempBookings);
    return;
  }

  // SERVICE STEP
  if (
    tempBookings[from] &&
    tempBookings[from].phone &&
    !tempBookings[from].service
  ) {
    await handleServiceStep(t, from, tempBookings);
    return;
  }

  /**
   * ---------------------------------------------
   * 🤖 AI fallback
   * ---------------------------------------------
   */
  if (!tempBookings[from]) {
    const reply = await askAI(t);
    await sendTextMessage(from, reply);
    return;
  }

  // If user is inside booking but sent something weird
  await sendTextMessage(
    from,
    "تمام ✅ خلّينا نكمّل الحجز. اكتب RESET لإعادة البدء إذا حبيت.",
  );
}

module.exports = {
  getSession,
  handleInteractiveMessage,
  handleTextMessage,
};
