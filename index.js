import express from "express";
import axios from "axios";
import Groq from "groq-sdk";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(express.json());

// ==============================
// 🔑 SUPABASE
// ==============================
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

let clinicSettings = null;

async function loadClinicSettings() {
  const { data } = await supabase
    .from("clinic_settings")
    .select("*")
    .eq("clinic_id", "default")
    .single();

  clinicSettings = data;
}
loadClinicSettings();

// ==============================
// 🤖 AI
// ==============================
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

function detectLanguage(text) {
  return /[\u0600-\u06FF]/.test(text) ? "ar" : "en";
}

async function askAI(text) {
  const lang = detectLanguage(text);
  const clinicName = clinicSettings?.clinic_name || "Smile Clinic";

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content:
          lang === "ar"
            ? `أنت موظف خدمة عملاء في ${clinicName}.`
            : `You are a clinic assistant at ${clinicName}.`,
      },
      { role: "user", content: text },
    ],
  });

  return completion.choices[0].message.content;
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

// ==============================
// 🧠 STATE
// ==============================
const tempBookings = {};
const cancelSessions = {};

// ==============================
// ✅ VERIFY WEBHOOK (GET)
// ==============================
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

// ==============================
// 📩 RECEIVE MESSAGES (POST)
// ==============================
app.post("/webhook", async (req, res) => {
  const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!message) return res.sendStatus(200);

  const from = message.from;

  if (message.type === "text") {
    const text = message.text.body;

    // cancel
    if (/cancel|إلغاء|الغاء/.test(text)) {
      cancelSessions[from] = true;
      await sendTextMessage(from, "📌 أرسل رقم الجوال المستخدم في الحجز:");
      return res.sendStatus(200);
    }

    // cancel flow
    if (cancelSessions[from]) {
      cancelSessions[from] = false;
      await sendTextMessage(from, "✅ تم إلغاء الحجز");
      return res.sendStatus(200);
    }

    // booking
    if (/حجز|موعد|book/.test(text)) {
      tempBookings[from] = {};
      await sendTextMessage(from, "📅 ما الموعد المناسب؟");
      return res.sendStatus(200);
    }

    // AI
    const reply = await askAI(text);
    await sendTextMessage(from, reply);
  }

  res.sendStatus(200);
});

// ==============================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🚀 Server running on", PORT));
