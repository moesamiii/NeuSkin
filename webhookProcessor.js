/**
 * webhookProcessor.js
 *
 * SAME FILE – VOICE REPLY ENABLED (VOICE IN → VOICE OUT)
 */

import axios from "axios";
import FormData from "form-data";

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

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

// ✅ Saudi Arabic voice (Jeddawi)
const VOICE_ID = "yXEnnEln9armDCyhkXcA";

// ------------------------------------
// 🎙️ Generate AI Voice (ElevenLabs)
// ------------------------------------
async function generateVoice(text) {
  const response = await axios.post(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
    {
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
      },
    },
    {
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
        Accept: "audio/ogg",
      },
      responseType: "arraybuffer",
    },
  );

  return Buffer.from(response.data);
}

// ------------------------------------
// 🎧 Send WhatsApp Voice Message
// ------------------------------------
async function sendVoiceMessage(to, audioBuffer) {
  // 1️⃣ Upload audio to WhatsApp
  const form = new FormData();
  form.append("file", audioBuffer, {
    filename: "reply.ogg",
    contentType: "audio/ogg",
  });
  form.append("messaging_product", "whatsapp");
  form.append("type", "audio"); // ✅ REQUIRED

  const uploadRes = await axios.post(
    `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/media`,
    form,
    {
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        ...form.getHeaders(),
      },
    },
  );

  const mediaId = uploadRes.data.id;

  // 2️⃣ Send voice note
  await axios.post(
    `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: "whatsapp",
      to: to,
      type: "audio",
      audio: {
        id: mediaId,
        voice: true, // ✅ CRITICAL
      },
    },
    {
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
    },
  );
}

// ------------------------------------
// 🧠 Helper functions (UNCHANGED)
// ------------------------------------
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
  const voice = await generateVoice(
    `تم حفظ حجزك بنجاح. ${booking.service} بتاريخ ${booking.appointment}`,
  );
  await sendVoiceMessage(to, voice);
}

function getSession(from) {
  if (!global.userSessions) global.userSessions = {};
  if (!global.userSessions[from]) {
    global.userSessions[from] = {
      waitingForCancelPhone: false,
      waitingForOffersConfirmation: false,
    };
  }
  return global.userSessions[from];
}

// ------------------------------------
// 🎙️ MAIN AUDIO HANDLER (UPDATED)
// ------------------------------------
async function handleAudioMessage(message, from) {
  try {
    const tempBookings = (global.tempBookings = global.tempBookings || {});
    const session = getSession(from);

    const mediaId = message?.audio?.id;
    if (!mediaId) return;

    const transcript = await transcribeAudio(mediaId, from);

    if (!transcript) {
      const voice = await generateVoice(
        "لم أتمكن من فهم الرسالة الصوتية، حاول مرة أخرى.",
      );
      await sendVoiceMessage(from, voice);
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
      const voice = await generateVoice("يوم الجمعة عطلة رسمية.");
      await sendVoiceMessage(from, voice);
      await sendAppointmentOptions(from);
      return;
    }

    if (isQuestion(transcript)) {
      const answer = await askAI(transcript);
      const voice = await generateVoice(answer);
      await sendVoiceMessage(from, voice);
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
        const answer = await askAI(transcript);
        const voice = await generateVoice(answer);
        await sendVoiceMessage(from, voice);
      }
      return;
    }

    if (!tempBookings[from].name) {
      if (!(await validateNameWithAI(transcript))) {
        const voice = await generateVoice("أدخل اسمًا صحيحًا.");
        await sendVoiceMessage(from, voice);
        return;
      }
      tempBookings[from].name = transcript;
      const voice = await generateVoice("أرسل رقم جوالك.");
      await sendVoiceMessage(from, voice);
      return;
    }

    if (!tempBookings[from].phone) {
      const normalized = normalizeArabicDigits(transcript);
      if (!/^07\d{8}$/.test(normalized)) {
        const voice = await generateVoice("رقم غير صحيح.");
        await sendVoiceMessage(from, voice);
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
