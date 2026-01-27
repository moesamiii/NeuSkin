/**
 * helpers.js (FINAL — Supabase + VOICE SUPPORT - ES6 VERSION)
 */

import axios from "axios";
import FormData from "form-data";
import Groq from "groq-sdk";
import { createClient } from "@supabase/supabase-js";

// =============================================
// 🤖 GROQ AI CLIENT
// =============================================
const groqClient = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

async function askAI(userMessage) {
  try {
    const completion = await groqClient.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content:
            "أنت موظف خدمة عملاء لعيادة Glow Clinic. رد فقط على الأسئلة المتعلقة بالمواعيد، الأسعار، الموقع، والحجز. رد بإيجاز وبالعربية فقط.",
        },
        { role: "user", content: userMessage },
      ],
    });
    return completion.choices[0]?.message?.content || "عذراً، لم أفهم.";
  } catch (error) {
    console.error("❌ AI error:", error.message);
    return "عذراً، حدث خطأ. حاول مرة أخرى.";
  }
}

async function validateNameWithAI(name) {
  // Simple validation
  return name && name.trim().length > 0 && /[a-zA-Zأ-ي]/.test(name);
}

// =============================================
// 🗄 SUPABASE
// =============================================
import {
  findLastBookingByPhone,
  updateBookingStatus,
  insertBookingToSupabase,
} from "./databaseHelper.js";

// ✅ Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// ✅ Global variable to store clinic settings
let clinicSettings = null;

// ✅ Load clinic settings from database
async function loadClinicSettings() {
  try {
    const { data, error } = await supabase
      .from("clinic_settings")
      .select("*")
      .eq("clinic_id", "default")
      .single();

    if (error) {
      console.error("❌ Error loading clinic settings:", error);
      return;
    }

    clinicSettings = data;
    console.log("✅ Clinic settings loaded:", clinicSettings?.clinic_name);
  } catch (err) {
    console.error("❌ Exception loading clinic settings:", err.message);
  }
}

// ✅ Load settings on module initialization
loadClinicSettings();

// =============================================
// 🌍 ENVIRONMENT VARIABLES
// =============================================
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const VOICE_ID = "yXEnnEln9armDCyhkXcA"; // Saudi Arabic voice

// =============================================
// 🎙️ VOICE GENERATION & SENDING
// =============================================
async function generateVoice(text) {
  try {
    console.log(`🎤 Generating voice for: "${text.substring(0, 50)}..."`);

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

    console.log("✅ Voice generated successfully");
    return Buffer.from(response.data);
  } catch (error) {
    console.error("❌ Voice generation error:", error.message);
    throw error;
  }
}

async function sendVoiceMessage(to, audioBuffer) {
  try {
    console.log(`🎧 Sending voice message to ${to}`);

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
    await axios.post(
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

    console.log(`✅ Voice message sent successfully to ${to}`);
  } catch (error) {
    console.error("❌ Voice sending error:", error.message);
    if (error.response) {
      console.error("Response data:", error.response.data);
    }
    throw error;
  }
}

// =============================================
// 💬 SEND WHATSAPP TEXT MESSAGE
// =============================================
async function sendTextMessage(to, text) {
  try {
    console.log(
      `📤 Sending WhatsApp text to ${to}: ${text.substring(0, 50)}...`,
    );

    await axios.post(
      `https://graph.facebook.com/v17.0/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to,
        text: { body: text },
      },
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
      },
    );

    console.log("✅ Text message sent successfully");
  } catch (err) {
    console.error("❌ WhatsApp send error:", err.response?.data || err.message);
  }
}

// =============================================
// 📅 APPOINTMENT BUTTONS (VOICE-AWARE)
// =============================================
async function sendAppointmentOptions(to, useVoice = false) {
  // ✅ If voice mode, send voice message
  if (useVoice) {
    const voice = await generateVoice(
      "اختر موعدك: الساعة 3 مساءً، 6 مساءً، أو 9 مساءً. أرسل الوقت المناسب لك.",
    );
    await sendVoiceMessage(to, voice);
    return;
  }

  // ✅ Otherwise, send interactive buttons
  try {
    // ✅ Get dynamic booking times or use defaults
    const bookingTimes = clinicSettings?.booking_times || [
      "3 PM",
      "6 PM",
      "9 PM",
    ];

    // ✅ Build buttons dynamically from database settings
    const buttons = bookingTimes.slice(0, 3).map((time, index) => ({
      type: "reply",
      reply: {
        id: `slot_${time.toLowerCase().replace(/\s/g, "")}`,
        title: time,
      },
    }));

    await axios.post(
      `https://graph.facebook.com/v17.0/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to,
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: "📅 اختر الموعد المناسب لك:" },
          action: { buttons },
        },
      },
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        },
      },
    );
  } catch (err) {
    console.error("❌ Appointment button error:", err.message);
    // Fallback to text if buttons fail
    await sendTextMessage(to, "📅 أرسل الوقت المناسب لك: 3 PM، 6 PM، أو 9 PM");
  }
}

// =============================================
// 💊 SERVICE LIST (VOICE-AWARE)
// =============================================
async function sendServiceList(to, useVoice = false) {
  // ✅ If voice mode, send voice message
  if (useVoice) {
    const voice = await generateVoice(
      "اختر الخدمة: فحص عام، تنظيف الأسنان، تبييض الأسنان، حشو الأسنان، علاج الجذور، التركيبات، تقويم الأسنان، أو خلع الأسنان.",
    );
    await sendVoiceMessage(to, voice);
    return;
  }

  // ✅ Otherwise, send interactive list
  try {
    await axios.post(
      `https://graph.facebook.com/v17.0/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to,
        type: "interactive",
        interactive: {
          type: "list",
          header: { type: "text", text: "💊 اختر الخدمة المطلوبة" },
          body: { text: "اختر نوع الخدمة من القائمة:" },
          action: {
            button: "عرض الخدمات",
            sections: [
              {
                title: "الخدمات الأساسية",
                rows: [
                  { id: "service_فحص عام", title: "فحص عام" },
                  { id: "service_تنظيف الأسنان", title: "تنظيف الأسنان" },
                  { id: "service_تبييض الأسنان", title: "تبييض الأسنان" },
                  { id: "service_حشو الأسنان", title: "حشو الأسنان" },
                ],
              },
              {
                title: "الخدمات المتقدمة",
                rows: [
                  { id: "service_علاج الجذور", title: "علاج الجذور" },
                  { id: "service_تركيب التركيبات", title: "التركيبات" },
                  { id: "service_تقويم الأسنان", title: "تقويم الأسنان" },
                  { id: "service_خلع الأسنان", title: "خلع الأسنان" },
                ],
              },
            ],
          },
        },
      },
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        },
      },
    );
  } catch (err) {
    console.error("❌ Service list error:", err.message);
    // Fallback to text if list fails
    await sendTextMessage(
      to,
      "💊 اختر الخدمة: فحص عام، تنظيف، تبييض، حشو، علاج جذور، تركيبات، تقويم، أو خلع.",
    );
  }
}

// ======================================================
// 🔥 CANCEL BOOKING (VOICE-AWARE)
// ======================================================
async function askForCancellationPhone(to, useVoice = false) {
  const message = "📌 أرسل رقم الجوال المستخدم بالحجز لإلغاء الموعد.";

  if (useVoice) {
    const voice = await generateVoice(message);
    await sendVoiceMessage(to, voice);
  } else {
    await sendTextMessage(to, message);
  }
}

async function processCancellation(to, phone, useVoice = false) {
  try {
    const booking = await findLastBookingByPhone(phone);

    if (!booking) {
      const message = "❌ لا يوجد حجز مرتبط بهذا الرقم.";
      if (useVoice) {
        const voice = await generateVoice(message);
        await sendVoiceMessage(to, voice);
      } else {
        await sendTextMessage(to, message);
      }
      return;
    }

    await updateBookingStatus(booking.id, "Canceled");

    const message = `🟣 تم إلغاء الحجز:\n👤 ${booking.name}\n💊 ${booking.service}\n📅 ${booking.appointment}`;

    if (useVoice) {
      const voice = await generateVoice(
        `تم إلغاء الحجز بنجاح. ${booking.name}، ${booking.service}، بتاريخ ${booking.appointment}`,
      );
      await sendVoiceMessage(to, voice);
    } else {
      await sendTextMessage(to, message);
    }
  } catch (err) {
    console.error("❌ Cancel error:", err.message);

    const message = "⚠️ حدث خطأ أثناء الإلغاء. حاول لاحقًا.";
    if (useVoice) {
      const voice = await generateVoice(message);
      await sendVoiceMessage(to, voice);
    } else {
      await sendTextMessage(to, message);
    }
  }
}

// =============================================
// 📤 EXPORTS (ES6 STYLE)
// =============================================
export {
  // AI - NOW DEFINED HERE
  askAI,
  validateNameWithAI,

  // WhatsApp
  sendTextMessage,
  sendAppointmentOptions,
  sendServiceList,

  // Voice - CRITICAL FOR VOICE REPLIES
  generateVoice,
  sendVoiceMessage,

  // Supabase
  insertBookingToSupabase,

  // Cancellation
  askForCancellationPhone,
  processCancellation,
};
