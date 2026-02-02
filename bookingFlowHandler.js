/**
 * bookingFlowHandler.js (FINAL – FULL VERSION)
 *
 * Responsibilities:
 * - Handle booking flow (name → phone → service)
 * - Handle cancel flow (detect → ask for phone → cancel)
 * - Handle interactive buttons (slots + services)
 */

const {
  askAI,
  sendTextMessage,
  sendAppointmentOptions,
  insertBookingToSupabase,
  askForCancellationPhone,
  processCancellation,
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

  // =====================================
  // ⏰ APPOINTMENT SLOT BUTTON
  // =====================================
  if (id?.startsWith("slot_")) {
    const appointment = id.replace("slot_", "").toUpperCase();

    tempBookings[from] = { appointment };

    await sendTextMessage(from, "👍 تم اختيار الموعد! الآن أرسل اسمك:");
    return;
  }

  // =====================================
  // 💊 SERVICE SELECTION BUTTON
  // =====================================
  if (id?.startsWith("service_")) {
    const serviceName = id.replace("service_", "");

    console.log("💊 Service selected:", serviceName);
    console.log("📋 Booking state:", tempBookings[from]);

    if (!tempBookings[from]) {
      await sendTextMessage(from, "⚠️ يجب بدء الحجز أولاً قبل اختيار الخدمة.");
      return;
    }

    if (!tempBookings[from].phone) {
      await sendTextMessage(
        from,
        "⚠️ يرجى إدخال رقم الجوال قبل اختيار الخدمة.",
      );
      return;
    }

    tempBookings[from].service = serviceName;
    const booking = tempBookings[from];

    console.log("✅ Final booking object:", booking);

    // Save booking
    await insertBookingToSupabase(booking);

    // Confirmation
    await sendTextMessage(
      from,
      `✅ تم حفظ حجزك بنجاح:\n\n👤 الاسم: ${booking.name}\n📱 الجوال: ${booking.phone}\n💊 الخدمة: ${booking.service}\n📅 الموعد: ${booking.appointment}`,
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

  console.log("💬 Message from:", from, text);

  /**
   * ==================================================
   * ❌ CANCEL BOOKING FLOW
   * ==================================================
   */

  // Step 1 — Detect cancel intent
  if (isCancelRequest(text)) {
    console.log("❌ Cancel intent detected");

    // Stop any booking flow
    if (tempBookings[from]) {
      delete tempBookings[from];
    }

    session.waitingForCancelPhone = true;

    await askForCancellationPhone(from);
    return;
  }

  // Step 2 — Waiting for phone number
  if (session.waitingForCancelPhone) {
    const phone = text.replace(/\D/g, "");

    if (phone.length < 8) {
      await sendTextMessage(
        from,
        "⚠️ رقم الجوال غير صحيح. أرسل الرقم بدون مسافات:",
      );
      return;
    }

    session.waitingForCancelPhone = false;

    await processCancellation(from, phone);
    return;
  }

  /**
   * ==================================================
   * 📅 BOOKING FLOW
   * ==================================================
   */

  // Start booking
  if (!tempBookings[from] && isBookingRequest(text)) {
    await sendAppointmentOptions(from);
    return;
  }

  // Quick shortcut (3 / 6 / 9)
  if (!tempBookings[from] && ["3", "6", "9"].includes(text)) {
    tempBookings[from] = { appointment: `${text} PM` };

    await sendTextMessage(from, "👍 تم اختيار الموعد! الآن أرسل اسمك:");
    return;
  }

  // Name step
  if (tempBookings[from] && !tempBookings[from].name) {
    await handleNameStep(text, from, tempBookings);
    return;
  }

  // Phone step
  if (tempBookings[from] && !tempBookings[from].phone) {
    await handlePhoneStep(text, from, tempBookings);
    return;
  }

  // Service step
  if (tempBookings[from] && !tempBookings[from].service) {
    await handleServiceStep(text, from, tempBookings);
    return;
  }

  /**
   * ==================================================
   * 🤖 AI FALLBACK
   * ==================================================
   */
  if (!tempBookings[from]) {
    const reply = await askAI(text);
    await sendTextMessage(from, reply);
    return;
  }
}

module.exports = {
  getSession,
  handleInteractiveMessage,
  handleTextMessage,
};
