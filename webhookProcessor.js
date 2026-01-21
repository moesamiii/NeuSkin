/**
 * webhookProcessor.js
 *
 * SAME FILE – ESM FIX ONLY
 */

import {
  askAI,
  validateNameWithAI,
  sendTextMessage,
  sendServiceList,
  sendAppointmentOptions,
  saveBooking,
  askForCancellationPhone,
} from "./helpers.js";

import {
  transcribeAudio,
  sendLocationMessages,
  sendOffersImages,
  sendDoctorsImages,
  isLocationRequest,
  isOffersRequest,
  isDoctorsRequest,
  isCancelRequest,
  isEnglish,
} from "./messageHandlers.js";

/* 🔽🔽🔽 EVERYTHING BELOW IS 100% UNCHANGED 🔽🔽🔽 */

function normalizeArabicDigits(input = "") {
  return input
    .replace(/[^\d٠-٩]/g, "")
    .replace(/٠/g, "0")
    .replace(/١/g, "1")
    .replace(/٢/g, "2")
    .replace(/٣/g, "3")
    .replace(/٤/g, "4")
    .replace(/٥/g, "5")
    .replace(/٦/g, "6")
    .replace(/٧/g, "7")
    .replace(/٨/g, "8")
    .replace(/٩/g, "9");
}

function isQuestion(text = "") {
  if (!text) return false;

  const questionWords = [
    "?",
    "كيف",
    "ليش",
    "متى",
    "أين",
    "وين",
    "شو",
    "what",
    "why",
    "how",
    "when",
    "where",
    "who",
  ];

  return (
    text.trim().endsWith("?") ||
    questionWords.some((w) => text.toLowerCase().includes(w.toLowerCase()))
  );
}

function containsFriday(text = "") {
  const fridayWords = ["الجمعة", "Friday", "friday"];
  return fridayWords.some((w) => text.toLowerCase().includes(w.toLowerCase()));
}

async function sendBookingConfirmation(to, booking) {
  await sendTextMessage(
    to,
    `✅ تم حفظ حجزك بنجاح:
👤 ${booking.name}
📱 ${booking.phone}
💊 ${booking.service}
📅 ${booking.appointment}`,
  );
}

function getSession(from) {
  if (!global.userSessions) {
    global.userSessions = {};
  }
  if (!global.userSessions[from]) {
    global.userSessions[from] = {
      waitingForCancelPhone: false,
      waitingForOffersConfirmation: false,
    };
  }
  return global.userSessions[from];
}

async function handleAudioMessage(message, from) {
  try {
    const tempBookings = (global.tempBookings = global.tempBookings || {});
    const session = getSession(from);

    const mediaId = message?.audio?.id;
    if (!mediaId) return;

    const transcript = await transcribeAudio(mediaId, from);

    if (!transcript) {
      await sendTextMessage(
        from,
        "⚠️ لم أتمكن من فهم الرسالة الصوتية، حاول مرة أخرى 🎙️",
      );
      return;
    }

    if (isCancelRequest(transcript)) {
      session.waitingForCancelPhone = true;
      delete tempBookings[from];
      await askForCancellationPhone(from);
      return;
    }

    if (isLocationRequest(transcript)) {
      await sendLocationMessages(from, isEnglish(transcript) ? "en" : "ar");
      return;
    }

    if (isOffersRequest(transcript)) {
      await sendOffersImages(from, isEnglish(transcript) ? "en" : "ar");
      return;
    }

    if (isDoctorsRequest(transcript)) {
      await sendDoctorsImages(from, isEnglish(transcript) ? "en" : "ar");
      return;
    }

    if (containsFriday(transcript)) {
      await sendTextMessage(from, "📅 يوم الجمعة عطلة رسمية");
      await sendAppointmentOptions(from);
      return;
    }

    if (isQuestion(transcript)) {
      const answer = await askAI(transcript);
      await sendTextMessage(from, answer);
      return;
    }

    if (!tempBookings[from]) {
      if (
        transcript.includes("حجز") ||
        transcript.toLowerCase().includes("book") ||
        transcript.includes("موعد") ||
        transcript.includes("appointment")
      ) {
        tempBookings[from] = {};
        await sendAppointmentOptions(from);
      } else {
        await sendTextMessage(from, await askAI(transcript));
      }
      return;
    }

    if (!tempBookings[from].name) {
      if (!(await validateNameWithAI(transcript))) {
        await sendTextMessage(from, "⚠️ أدخل اسمًا صحيحًا");
        return;
      }
      tempBookings[from].name = transcript;
      await sendTextMessage(from, "📱 أرسل رقم جوالك");
      return;
    }

    if (!tempBookings[from].phone) {
      const normalized = normalizeArabicDigits(transcript);
      if (!/^07\d{8}$/.test(normalized)) {
        await sendTextMessage(from, "⚠️ رقم غير صحيح");
        return;
      }
      tempBookings[from].phone = normalized;
      await sendServiceList(from);
      return;
    }

    if (!tempBookings[from].service) {
      tempBookings[from].service = transcript;
      const booking = tempBookings[from];
      await saveBooking(booking);
      await sendBookingConfirmation(from, booking);
      delete tempBookings[from];
    }
  } catch (err) {
    console.error("❌ Audio processing error:", err);
    throw err;
  }
}

export { handleAudioMessage };
