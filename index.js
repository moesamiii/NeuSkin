import express from "express";
import axios from "axios";
import Groq from "groq-sdk";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(express.json());

// ==============================
// 🔑 SUPABASE SETUP (ADDED)
// ==============================
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function insertBookingToSupabase(booking) {
  try {
    console.log("📥 INSERT BOOKING REQUEST:", booking);

    const { data, error } = await supabase.from("bookings").insert([
      {
        name: booking.name,
        phone: booking.phone,
        service: booking.service,
        appointment: booking.appointment,
        status: "new",
      },
    ]);

    if (error) {
      console.error("❌ Supabase insert error:", error.message);
      return false;
    }

    console.log("✅ SUPABASE INSERT SUCCESS");
    return true;
  } catch (err) {
    console.error("❌ Supabase exception:", err.message);
    return false;
  }
}

// ==============================
// 🤖 GROQ AI SETUP
// ==============================
const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

function detectLanguage(text) {
  const arabic = /[\u0600-\u06FF]/;
  return arabic.test(text) ? "ar" : "en";
}

async function askAI(userMessage) {
  try {
    const lang = detectLanguage(userMessage);

    const arabicPrompt = `أنت موظف خدمة عملاء ذكي وودود في "عيادة ابتسامة الطبيّة".
📍 الموقع: عمّان – عبدون، خلف بنك الإسكان، الطابق الأول.
🕒 مواعيد العمل: يوميًا من الساعة 2 ظهرًا حتى الساعة 10 مساءً (الجمعة مغلق).`;

    const englishPrompt = `You are a friendly customer service assistant at "Smile Medical Clinic".`;

    const completion = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: lang === "ar" ? arabicPrompt : englishPrompt,
        },
        { role: "user", content: userMessage },
      ],
      temperature: 0.7,
      max_completion_tokens: 512,
    });

    return completion.choices[0]?.message?.content || "عذرًا، لم أفهم سؤالك.";
  } catch (err) {
    console.error("❌ AI Error:", err.message);
    return "⚠️ حدث خطأ في نظام المساعد الذكي.";
  }
}

async function validateNameWithAI(name) {
  try {
    const prompt = `هل "${name}" يبدو اسم شخص حقيقي؟ أجب بـ "نعم" أو "لا" فقط.`;
    const completion = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
      max_completion_tokens: 10,
    });
    const reply =
      completion.choices?.[0]?.message?.content?.toLowerCase() || "";
    return reply.includes("نعم") || reply.includes("yes");
  } catch {
    return true;
  }
}

// ==============================
// 💬 WHATSAPP FUNCTIONS
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
        body: { text: "اختر نوع الخدمة من القائمة:" },
        action: {
          button: "عرض الخدمات",
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

// ==============================
// 📩 WEBHOOK
// ==============================
app.post("/webhook", async (req, res) => {
  const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!message) return res.sendStatus(200);

  const from = message.from;

  // BUTTONS
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
        `✅ تم حفظ الحجز:\n${booking.name}\n${booking.phone}\n${booking.service}`,
      );

      delete tempBookings[from];
      return res.sendStatus(200);
    }
  }

  // TEXT
  if (message.type === "text") {
    const text = message.text.body;

    if (!tempBookings[from]) {
      tempBookings[from] = {};
      await sendAppointmentOptions(from);
      return res.sendStatus(200);
    }

    if (!tempBookings[from].name) {
      tempBookings[from].name = text;
      await sendTextMessage(from, "📱 أرسل رقم الجوال:");
      return res.sendStatus(200);
    }

    if (!tempBookings[from].phone) {
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
