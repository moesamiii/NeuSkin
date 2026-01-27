console.log("WEBHOOK HIT:", JSON.stringify(body, null, 2));
/**
 *
 * webhookProcessor.js
 * VOICE-ENABLED VERSION - FIXED
 */
import axios from "axios";
import FormData from "form-data";
import Groq from "groq-sdk";
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
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const VOICE_ID = "yXEnnEln9armDCyhkXcA";

// 🤖 Initialize Groq client
const groqClient = new Groq({
  apiKey: GROQ_API_KEY,
});

// 🎙️ Generate Voice
async function generateVoice(text) {
  try {
    console.log(`🎤 Generating voice: "${text.substring(0, 50)}..."`);

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
  } catch (error) {
    console.error("❌ Voice generation error:", error.message);
    throw error;
  }
}

// 🎧 Send Voice Message
async function sendVoiceMessage(to, audioBuffer) {
  try {
    console.log(`🎧 Sending voice message to ${to}`);

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

    console.log("✅ Voice message sent successfully");
  } catch (error) {
    console.error("❌ Voice sending error:", error.message);
    throw error;
  }
}

// 💬 Send Text Message
async function sendTextMessage(to, text) {
  await axios.post(
    `https://graph.facebook.com/v17.0/${PHONE_NUMBER_ID}/messages`,
    { messaging_product: "whatsapp", to, text: { body: text } },
    { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } },
  );
}

// 🧠 AI Helper using Groq
async function askAI(question) {
  try {
    console.log(`🤖 Asking AI: "${question.substring(0, 50)}..."`);

    const completion = await groqClient.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content:
            "أنت موظف خدمة عملاء لعيادة Glow Clinic. رد فقط على الأسئلة المتعلقة بالمواعيد، الأسعار، الموقع، والحجز. رد بإيجاز وبالعربية فقط.",
        },
        { role: "user", content: question },
      ],
    });

    const answer = completion.choices[0]?.message?.content || "عذراً، لم أفهم.";
    console.log(`✅ AI response: "${answer.substring(0, 50)}..."`);
    return answer;
  } catch (error) {
    console.error("❌ AI error:", error.message);
    return "عذراً، حدث خطأ. حاول مرة أخرى.";
  }
}

async function validateNameWithAI(name) {
  try {
    const completion = await groqClient.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "user",
          content: `Is "${name}" a valid human name? Answer only: YES or NO`,
        },
      ],
    });
    return (
      completion.choices[0]?.message?.content?.trim().toUpperCase() === "YES"
    );
  } catch (error) {
    console.error("❌ Name validation error:", error.message);
    return true; // Fallback: accept name if validation fails
  }
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

// 🎙️ AUDIO HANDLER - FIXED
async function handleAudioMessage(message, from) {
  console.log(`🎤 Audio message received from ${from}`);
  try {
    const tempBookings = (global.tempBookings = global.tempBookings || {});
    const session = getSession(from);
    session.lastMessageType = "audio";

    // Step 1: Transcribe audio
    const transcript = await transcribeAudio(message?.audio?.id, from);
    console.log(`📝 Transcript: "${transcript}"`);

    if (!transcript) {
      const voice = await generateVoice("لم أفهم، حاول مرة أخرى.");
      await sendVoiceMessage(from, voice);
      return;
    }

    // Step 2: Check for cancellation
    if (isCancelRequest(transcript)) {
      delete tempBookings[from];
      await askForCancellationPhone(from, true);
      return;
    }

    // Step 3: Check for location request
    if (isLocationRequest(transcript)) {
      await sendLocationMessages(from, isEnglish(transcript) ? "en" : "ar");
      return;
    }

    // Step 4: Check for Friday
    if (containsFriday(transcript)) {
      const voice = await generateVoice("يوم الجمعة عطلة.");
      await sendVoiceMessage(from, voice);
      await sendAppointmentOptions(from, true);
      return;
    }

    // Step 5: Check if it's a question
    if (isQuestion(transcript)) {
      console.log("🤔 Detected question, asking AI...");
      const answer = await askAI(transcript);
      console.log(`💬 AI Answer: "${answer}"`);
      const voice = await generateVoice(answer);
      await sendVoiceMessage(from, voice);
      return;
    }

    // Step 6: Check for booking request
    if (!tempBookings[from]) {
      if (transcript.includes("حجز") || transcript.includes("book")) {
        tempBookings[from] = {};
        await sendAppointmentOptions(from, true);
      } else {
        // Any other voice message -> treat as question
        console.log("🗣️ General voice message, asking AI...");
        const answer = await askAI(transcript);
        const voice = await generateVoice(answer);
        await sendVoiceMessage(from, voice);
      }
      return;
    }

    // Step 7: Collect booking info
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
      await sendServiceList(from, true);
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
    console.error("❌ Audio handling error:", err.message);
    console.error(err.stack);

    // Send error voice message
    try {
      const voice = await generateVoice("عذراً، حدث خطأ. حاول مرة أخرى.");
      await sendVoiceMessage(from, voice);
    } catch (voiceErr) {
      console.error("❌ Could not send error voice:", voiceErr.message);
    }
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

  console.log(`\n📨 Received ${messageType} message from ${from}`);

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
  askAI,
};
