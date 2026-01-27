/**
 * webhookProcessor.js
 * VOICE-ENABLED VERSION
 */
import axios from "axios";
import FormData from "form-data";
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
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const VOICE_ID = "yXEnnEln9armDCyhkXcA";

// 🎙️ Generate Voice
async function generateVoice(text) {
  const response = await axios.post(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
    {
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
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

// 🎧 Send Voice Message
async function sendVoiceMessage(to, audioBuffer) {
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

  await axios.post(
    `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: "whatsapp",
      to,
      type: "audio",
      audio: { id: uploadRes.data.id, voice: true },
    },
    { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } },
  );
}

// 💬 Send Text Message
async function sendTextMessage(to, text) {
  await axios.post(
    `https://graph.facebook.com/v17.0/${PHONE_NUMBER_ID}/messages`,
    { messaging_product: "whatsapp", to, text: { body: text } },
    { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } },
  );
}

// 🧠 AI Helpers
async function askAI(question) {
  const response = await axios.post(
    "https://api.anthropic.com/v1/messages",
    {
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `أنت مساعد عيادة Glow Clinic. أجب بإيجاز:\n${question}`,
        },
      ],
    },
    {
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
    },
  );
  return response.data.content[0].text;
}

async function validateNameWithAI(name) {
  const response = await axios.post(
    "https://api.anthropic.com/v1/messages",
    {
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 10,
      messages: [
        {
          role: "user",
          content: `Is "${name}" a valid name? Answer: YES or NO`,
        },
      ],
    },
    {
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
    },
  );
  return response.data.content[0].text.trim().toUpperCase() === "YES";
}

// 📋 Send Options (VOICE-AWARE)
async function sendAppointmentOptions(to, useVoice = false) {
  if (useVoice) {
    const voice = await generateVoice(
      "اختر موعدك: 3 مساءً، 6 مساءً، أو 9 مساءً.",
    );
    await sendVoiceMessage(to, voice);
    return;
  }
  await axios.post(
    `https://graph.facebook.com/v17.0/${PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: "📅 اختر الموعد المناسب لك:" },
        action: {
          buttons: [
            { type: "reply", reply: { id: "slot_3pm", title: "3 PM" } },
            { type: "reply", reply: { id: "slot_6pm", title: "6 PM" } },
            { type: "reply", reply: { id: "slot_9pm", title: "9 PM" } },
          ],
        },
      },
    },
    { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } },
  );
}

async function sendServiceList(to, useVoice = false) {
  if (useVoice) {
    const voice = await generateVoice(
      "اختر الخدمة: فحص عام، تنظيف الأسنان، تبييض، حشو، علاج جذور، تركيبات، تقويم، أو خلع.",
    );
    await sendVoiceMessage(to, voice);
    return;
  }
  await axios.post(
    `https://graph.facebook.com/v17.0/${PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "list",
        header: { type: "text", text: "💊 اختر الخدمة" },
        body: { text: "اختر من القائمة:" },
        action: {
          button: "عرض الخدمات",
          sections: [
            {
              title: "الخدمات الأساسية",
              rows: [
                { id: "service_فحص", title: "فحص عام" },
                { id: "service_تنظيف", title: "تنظيف" },
                { id: "service_تبييض", title: "تبييض" },
                { id: "service_حشو", title: "حشو" },
              ],
            },
          ],
        },
      },
    },
    { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } },
  );
}

async function askForCancellationPhone(to, useVoice = false) {
  const msg = "أرسل رقم الجوال المستخدم بالحجز لإلغاء الموعد.";
  if (useVoice) {
    const voice = await generateVoice(msg);
    await sendVoiceMessage(to, voice);
  } else {
    await sendTextMessage(to, msg);
  }
}

// 🗄 Database
async function saveBooking(booking) {
  console.log("✅ Booking saved:", booking);
}

// 🔍 Helpers
function normalizeArabicDigits(input = "") {
  return input
    .replace(/[^\d٠-٩]/g, "")
    .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
}

function isQuestion(text = "") {
  const q = [
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
  ];
  return (
    text.trim().endsWith("?") || q.some((w) => text.toLowerCase().includes(w))
  );
}

function containsFriday(text = "") {
  return ["الجمعة", "Friday"].some((w) =>
    text.toLowerCase().includes(w.toLowerCase()),
  );
}

function getSession(from) {
  if (!global.userSessions) global.userSessions = {};
  if (!global.userSessions[from])
    global.userSessions[from] = { lastMessageType: null };
  return global.userSessions[from];
}

// 🎙️ AUDIO HANDLER
async function handleAudioMessage(message, from) {
  console.log(`🎤 Audio from ${from}`);
  try {
    const tempBookings = (global.tempBookings = global.tempBookings || {});
    const session = getSession(from);
    session.lastMessageType = "audio";

    const transcript = await transcribeAudio(message?.audio?.id, from);
    if (!transcript) {
      const voice = await generateVoice("لم أفهم، حاول مرة أخرى.");
      await sendVoiceMessage(from, voice);
      return;
    }

    if (isCancelRequest(transcript)) {
      delete tempBookings[from];
      await askForCancellationPhone(from, true); // ✅ VOICE
      return;
    }

    if (isLocationRequest(transcript)) {
      await sendLocationMessages(from, isEnglish(transcript) ? "en" : "ar");
      return;
    }

    if (containsFriday(transcript)) {
      const voice = await generateVoice("يوم الجمعة عطلة.");
      await sendVoiceMessage(from, voice);
      await sendAppointmentOptions(from, true); // ✅ VOICE
      return;
    }

    if (isQuestion(transcript)) {
      const answer = await askAI(transcript);
      const voice = await generateVoice(answer);
      await sendVoiceMessage(from, voice);
      return;
    }

    if (!tempBookings[from]) {
      if (transcript.includes("حجز") || transcript.includes("book")) {
        tempBookings[from] = {};
        await sendAppointmentOptions(from, true); // ✅ VOICE
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
      await sendServiceList(from, true); // ✅ VOICE
      return;
    }

    if (!tempBookings[from].service) {
      tempBookings[from].service = transcript;
      const booking = tempBookings[from];
      await saveBooking(booking);
      const voice = await generateVoice(`تم حفظ حجزك. ${booking.service}`);
      await sendVoiceMessage(from, voice);
      delete tempBookings[from];
    }
  } catch (err) {
    console.error("❌ Audio error:", err);
  }
}

// 💬 TEXT HANDLER
async function handleTextMessage(message, from) {
  console.log(`💬 Text from ${from}`);
  try {
    const tempBookings = (global.tempBookings = global.tempBookings || {});
    const userMessage = message.text?.body || "";

    if (isCancelRequest(userMessage)) {
      delete tempBookings[from];
      await askForCancellationPhone(from, false);
      return;
    }

    if (isQuestion(userMessage)) {
      const answer = await askAI(userMessage);
      await sendTextMessage(from, answer);
      return;
    }

    if (!tempBookings[from]) {
      if (userMessage.includes("حجز") || userMessage.includes("book")) {
        tempBookings[from] = {};
        await sendAppointmentOptions(from, false);
      } else {
        const answer = await askAI(userMessage);
        await sendTextMessage(from, answer);
      }
      return;
    }

    if (!tempBookings[from].name) {
      if (!(await validateNameWithAI(userMessage))) {
        await sendTextMessage(from, "أدخل اسمًا صحيحًا.");
        return;
      }
      tempBookings[from].name = userMessage;
      await sendTextMessage(from, "أرسل رقم جوالك.");
      return;
    }

    if (!tempBookings[from].phone) {
      const normalized = normalizeArabicDigits(userMessage);
      if (!/^07\d{8}$/.test(normalized)) {
        await sendTextMessage(from, "رقم غير صحيح.");
        return;
      }
      tempBookings[from].phone = normalized;
      await sendServiceList(from, false);
      return;
    }

    if (!tempBookings[from].service) {
      tempBookings[from].service = userMessage;
      await saveBooking(tempBookings[from]);
      await sendTextMessage(from, `تم حفظ حجزك. ${tempBookings[from].service}`);
      delete tempBookings[from];
    }
  } catch (err) {
    console.error("❌ Text error:", err);
  }
}

// 🎯 MAIN PROCESSOR
export async function processWebhook(body) {
  const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!message) return;

  const from = message.from;
  const messageType = message.type;

  console.log(`\n📨 ${messageType} from ${from}`);

  if (messageType === "audio") {
    await handleAudioMessage(message, from);
  } else if (messageType === "text") {
    await handleTextMessage(message, from);
  }
}

export {
  handleAudioMessage,
  handleTextMessage,
  generateVoice,
  sendVoiceMessage,
};
