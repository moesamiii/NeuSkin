import express from "express";
import axios from "axios";
import Groq from "groq-sdk";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(express.json());

// ==============================
// 🔑 SUPABASE SETUP
// ==============================
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function insertBookingToSupabase(booking) {
  try {
    await supabase.from("bookings").insert([
      {
        name: booking.name,
        phone: booking.phone,
        service: booking.service,
        appointment: booking.appointment,
        status: "new",
      },
    ]);
    return true;
  } catch (err) {
    console.error("❌ Supabase error:", err.message);
    return false;
  }
}

// ==============================
// 🤖 GROQ AI
// ==============================
const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

function detectLanguage(text) {
  return /[\u0600-\u06FF]/.test(text) ? "ar" : "en";
}

async function askAI(userMessage) {
  try {
    const lang = detectLanguage(userMessage);

    const systemPrompt =
      lang === "ar"
        ? `أنت موظف خدمة عملاء في عيادة ابتسامة. لا تبدأ الحجز إلا إذا طلب المستخدم ذلك صراحة.`
        : `You are a clinic assistant. Do not start booking unless user asks explicitly.`;

    const completion = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0.7,
      max_completion_tokens: 300,
    });

    return completion.choices[0]?.message?.content || "";
  } catch {
    return "⚠️ حدث خطأ.";
  }
}

// ==============================
// 📞 WHATSAPP
// ==============================
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;

async function sendTextMessage(to, text) {
  await axios.post(
    `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
    { messaging_product: "whatsapp", to, text: { body: text } },
    { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } },
  );
}

async function sendAppointmentOptions(to) {
  await axios.post(
    `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
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

async function sendServiceList(to) {
  await axios.post(
    `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "list",
        body: { text: "اختر نوع الخدمة:" },
        action: {
          button: "الخدمات",
          sections: [
            {
              title: "الخدمات",
              rows: [
                { id: "service_فحص عام", title: "فحص عام" },
                { id: "service_تنظيف الأسنان", title: "تنظيف الأسنان" },
                { id: "service_تبييض الأسنان", title: "تبييض الأسنان" },
              ],
            },
          ],
        },
      },
    },
    { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } },
  );
}

// ==============================
// 🧠 BOOKING STATE
// ==============================
const tempBookings = {};

// ✅ booking intent ONLY
function isBookingRequest(text) {
  return /(حجز|موعد|احجز|book|appointment|reserve)/i.test(text);
}

// ==============================
// 📩 WEBHOOK
// ==============================
app.post("/webhook", async (req, res) => {
  const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!message) return res.sendStatus(200);

  const from = message.from;

  // ---------------- BUTTONS ----------------
  if (message.type === "interactive") {
    const id =
      message.interactive?.list_reply?.id ||
      message.interactive?.button_reply?.id;

    if (id.startsWith("slot_")) {
      tempBookings[from] = {
        appointment: id.replace("slot_", "").toUpperCase(),
      };
      await sendTextMessage(from, "👍 أرسل اسمك:");
      return res.sendStatus(200);
    }

    if (id.startsWith("service_")) {
      const booking = tempBookings[from];
      booking.service = id.replace("service_", "");

      await insertBookingToSupabase(booking);

      await sendTextMessage(
        from,
        `✅ تم تأكيد الحجز:\n👤 ${booking.name}\n📱 ${booking.phone}\n💊 ${booking.service}\n📅 ${booking.appointment}`,
      );

      delete tempBookings[from];
      return res.sendStatus(200);
    }
  }

  // ---------------- TEXT ----------------
  if (message.type === "text") {
    const text = message.text.body;

    // 🚫 لا تبدأ الحجز إلا إذا طلبه
    if (!tempBookings[from] && !isBookingRequest(text)) {
      const reply = await askAI(text);
      await sendTextMessage(from, reply);
      return res.sendStatus(200);
    }

    // ▶️ بدء الحجز
    if (!tempBookings[from] && isBookingRequest(text)) {
      tempBookings[from] = {};
      await sendAppointmentOptions(from);
      return res.sendStatus(200);
    }

    if (tempBookings[from] && !tempBookings[from].name) {
      tempBookings[from].name = text;
      await sendTextMessage(from, "📱 أرسل رقم الجوال:");
      return res.sendStatus(200);
    }

    if (tempBookings[from] && !tempBookings[from].phone) {
      tempBookings[from].phone = text.replace(/\D/g, "");
      await sendServiceList(from);
      return res.sendStatus(200);
    }
  }

  res.sendStatus(200);
});

// ==============================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🚀 Server running"));
