/**
 * webhookProcessor.js
 * VOICE-FIRST VERSION - All responses are voice when user sends voice
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
  console.log(`🎤 Sending voice message to ${to}`);

  // 1️⃣ Upload audio to WhatsApp
  const form = new FormData();
  form.append("file", audioBuffer, {
    filename: "reply.ogg",
    contentType: "audio/ogg",
  });
  form.append("messaging_product", "whatsapp");
  form.append("type", "audio");

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
  console.log(`✅ Audio uploaded, media ID: ${mediaId}`);

  // 2️⃣ Send voice note
  const sendRes = await axios.post(
    `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: "whatsapp",
      to: to,
      type: "audio",
      audio: {
        id: mediaId,
        voice: true, // ✅ CRITICAL - makes it a voice note
      },
    },
    {
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
    },
  );

  console.log(`✅ Voice message sent successfully`);
  return sendRes.data;
}

// ------------------------------------
// 🧠 Helper functions
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
      lastMessageType: null, // Track if user prefers voice or text
    };
  }
  return global.userSessions[from];
}

// ------------------------------------
// 🎙️ MAIN AUDIO HANDLER
// ------------------------------------
async function handleAudioMessage(message, from) {
  console.log(`🎤 Processing audio message from ${from}`);

  try {
    const tempBookings = (global.tempBookings = global.tempBookings || {});
    const session = getSession(from);

    // Mark that user prefers voice
    session.lastMessageType = "audio";

    const mediaId = message?.audio?.id;
    if (!mediaId) {
      console.error("❌ No media ID found in audio message");
      return;
    }

    console.log(`📝 Transcribing audio (media ID: ${mediaId})`);
    const transcript = await transcribeAudio(mediaId, from);
    console.log(`📝 Transcript: "${transcript}"`);

    if (!transcript) {
      const voice = await generateVoice(
        "لم أتمكن من فهم الرسالة الصوتية، حاول مرة أخرى.",
      );
      await sendVoiceMessage(from, voice);
      return;
    }

    // Handle cancel request
    if (isCancelRequest(transcript)) {
      session.waitingForCancelPhone = true;
      delete tempBookings[from];
      await askForCancellationPhone(from);
      return;
    }

    // Handle location request
    if (isLocationRequest(transcript)) {
      await sendLocationMessages(from, isEnglish(transcript) ? "en" : "ar");
      return;
    }

    // Handle offers request
    if (isOffersRequest(transcript)) {
      await sendOffersImages(from, isEnglish(transcript) ? "en" : "ar");
      return;
    }

    // Handle doctors request
    if (isDoctorsRequest(transcript)) {
      await sendDoctorsImages(from, isEnglish(transcript) ? "en" : "ar");
      return;
    }

    // Handle Friday mention
    if (containsFriday(transcript)) {
      const voice = await generateVoice("يوم الجمعة عطلة رسمية.");
      await sendVoiceMessage(from, voice);
      await sendAppointmentOptions(from);
      return;
    }

    // Handle general questions
    if (isQuestion(transcript)) {
      const answer = await askAI(transcript);
      const voice = await generateVoice(answer);
      await sendVoiceMessage(from, voice);
      return;
    }

    // Start booking flow
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

    // Collect name
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

    // Collect phone
    if (!tempBookings[from].phone) {
      const normalized = normalizeArabicDigits(transcript);
      if (!/^07\d{8}$/.test(normalized)) {
        const voice = await generateVoice(
          "رقم غير صحيح. أدخل رقم جوال أردني يبدأ بـ 07.",
        );
        await sendVoiceMessage(from, voice);
        return;
      }
      tempBookings[from].phone = normalized;
      await sendServiceList(from);
      return;
    }

    // Collect service
    if (!tempBookings[from].service) {
      tempBookings[from].service = transcript;
      const booking = tempBookings[from];
      await saveBooking(booking);
      await sendBookingConfirmation(from, booking);
      delete tempBookings[from];
    }
  } catch (err) {
    console.error("❌ Audio processing error:", err);
    const voice = await generateVoice("عذراً، حدث خطأ. حاول مرة أخرى.");
    await sendVoiceMessage(from, voice);
  }
}

// ------------------------------------
// 💬 MAIN TEXT HANDLER (unchanged logic)
// ------------------------------------
async function handleTextMessage(message, from) {
  console.log(`💬 Processing text message from ${from}`);

  try {
    const tempBookings = (global.tempBookings = global.tempBookings || {});
    const session = getSession(from);

    // Mark that user prefers text
    session.lastMessageType = "text";

    const userMessage = message.text?.body || "";

    if (!userMessage) {
      await sendTextMessage(from, "مرحباً! كيف يمكنني مساعدتك؟");
      return;
    }

    // Handle cancel request
    if (isCancelRequest(userMessage)) {
      session.waitingForCancelPhone = true;
      delete tempBookings[from];
      await askForCancellationPhone(from);
      return;
    }

    // Handle location request
    if (isLocationRequest(userMessage)) {
      await sendLocationMessages(from, isEnglish(userMessage) ? "en" : "ar");
      return;
    }

    // Handle offers request
    if (isOffersRequest(userMessage)) {
      await sendOffersImages(from, isEnglish(userMessage) ? "en" : "ar");
      return;
    }

    // Handle doctors request
    if (isDoctorsRequest(userMessage)) {
      await sendDoctorsImages(from, isEnglish(userMessage) ? "en" : "ar");
      return;
    }

    // Handle Friday mention
    if (containsFriday(userMessage)) {
      await sendTextMessage(from, "يوم الجمعة عطلة رسمية.");
      await sendAppointmentOptions(from);
      return;
    }

    // Handle general questions
    if (isQuestion(userMessage)) {
      const answer = await askAI(userMessage);
      await sendTextMessage(from, answer);
      return;
    }

    // Start booking flow
    if (!tempBookings[from]) {
      if (
        userMessage.includes("حجز") ||
        userMessage.toLowerCase().includes("book") ||
        userMessage.includes("موعد") ||
        userMessage.includes("appointment")
      ) {
        tempBookings[from] = {};
        await sendAppointmentOptions(from);
      } else {
        const answer = await askAI(userMessage);
        await sendTextMessage(from, answer);
      }
      return;
    }

    // Collect name
    if (!tempBookings[from].name) {
      if (!(await validateNameWithAI(userMessage))) {
        await sendTextMessage(from, "أدخل اسمًا صحيحًا.");
        return;
      }
      tempBookings[from].name = userMessage;
      await sendTextMessage(from, "أرسل رقم جوالك.");
      return;
    }

    // Collect phone
    if (!tempBookings[from].phone) {
      const normalized = normalizeArabicDigits(userMessage);
      if (!/^07\d{8}$/.test(normalized)) {
        await sendTextMessage(
          from,
          "رقم غير صحيح. أدخل رقم جوال أردني يبدأ بـ 07.",
        );
        return;
      }
      tempBookings[from].phone = normalized;
      await sendServiceList(from);
      return;
    }

    // Collect service
    if (!tempBookings[from].service) {
      tempBookings[from].service = userMessage;
      const booking = tempBookings[from];
      await saveBooking(booking);
      await sendTextMessage(
        from,
        `تم حفظ حجزك بنجاح. ${booking.service} بتاريخ ${booking.appointment}`,
      );
      delete tempBookings[from];
    }
  } catch (err) {
    console.error("❌ Text processing error:", err);
    await sendTextMessage(from, "عذراً، حدث خطأ. حاول مرة أخرى.");
  }
}

// ------------------------------------
// 🎯 MAIN WEBHOOK PROCESSOR
// ------------------------------------
export async function processWebhook(body) {
  try {
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;

    if (!messages || messages.length === 0) {
      console.log("⚠️ No messages in webhook");
      return;
    }

    const message = messages[0];
    const from = message.from;
    const messageType = message.type;

    console.log(`\n📨 Received ${messageType} message from ${from}`);

    // ✅ CRITICAL: Route based on message type
    if (messageType === "audio") {
      console.log("🎤 Routing to audio handler");
      await handleAudioMessage(message, from);
    } else if (messageType === "text") {
      console.log("💬 Routing to text handler");
      await handleTextMessage(message, from);
    } else {
      console.log(`⚠️ Unsupported message type: ${messageType}`);
      await sendTextMessage(from, "عذراً، نوع الرسالة غير مدعوم.");
    }
  } catch (error) {
    console.error("❌ Webhook processing error:", error);
    throw error;
  }
}

// Export handlers for external use
export {
  handleAudioMessage,
  handleTextMessage,
  generateVoice,
  sendVoiceMessage,
};
