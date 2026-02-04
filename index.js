/* =========================================================
   🏥 WhatsApp Clinic Bot – Production index.js
   ---------------------------------------------------------
   ✔ Supabase (Service Role)
   ✔ WhatsApp Cloud API
   ✔ AI (askAI / validateNameWithAI)
   ✔ Voice messages
   ✔ Booking + Cancel
   ✔ booking_history
   ✔ clinic_settings from DB
   ✔ Rate limit & anti-duplicate
   ✔ Vercel compatible (serverless)
   ========================================================= */

import express from "express";
import axios from "axios";
import { createClient } from "@supabase/supabase-js";

import { askAI, validateNameWithAI } from "./aiHelper.js";
import { handleAudioMessage } from "./webhookProcessor.js";

/* =========================================================
   🚀 APP INIT
   ========================================================= */
const app = express();
app.use(express.json());

/* =========================================================
   🔐 SUPABASE CLIENT (SERVICE ROLE)
   ========================================================= */
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

/* =========================================================
   ⚙️ GLOBAL STATE (ONLY TEMP SESSION DATA)
   ========================================================= */
const tempBookings = {}; // booking flow per WhatsApp user
const cancelSessions = {}; // cancel flow per WhatsApp user

/* =========================================================
   🏥 CLINIC SETTINGS (FROM DB)
   ========================================================= */
let clinicSettings = {
  clinic_name: "عيادة نيو سكن",
  booking_times: ["3 PM", "6 PM", "9 PM"],
};

async function loadClinicSettings() {
  const { data, error } = await supabase
    .from("clinic_settings")
    .select("*")
    .eq("clinic_id", "default")
    .single();

  if (error) {
    console.warn("⚠️ Using fallback clinic settings");
    return;
  }

  clinicSettings = data;
  console.log("✅ Clinic settings loaded from DB");
}

// load on cold start
await loadClinicSettings();

/* =========================================================
   👨‍⚕️ DOCTORS DATA
   ========================================================= */
const DOCTOR_IMAGES = [
  "https://drive.google.com/uc?export=view&id=1ibiePCccQytufxR6MREHQsuQcdKEgnHu",
  "https://drive.google.com/uc?export=view&id=1oLw96zy3aWwJaOx6mwtZV173B7s5Rb64",
  "https://drive.google.com/uc?export=view&id=1UkAzSHARtI-t-T_PCiY4RKcsxtkxR4Jf",
];

const DOCTOR_INFO = [
  { name: "د. طارق عورتاني", specialization: "أخصائي جلدية" },
  { name: "د. ميساء صافي", specialization: "أخصائية جلدية" },
  { name: "د. تانيا بيربن", specialization: "أخصائية جلدية" },
];

/* =========================================================
   🛡️ ANTI-SPAM & RATE LIMIT
   ========================================================= */
const userMessageTimestamps = {};
const userLastMessages = {};
const processingMessages = {};

const RATE_LIMIT = {
  DUPLICATE_MS: 5000,
  MAX_MSG: 10,
  WINDOW_MS: 30000,
  PROCESS_TIMEOUT: 10000,
};

function isDuplicateMessage(userId, text) {
  const now = Date.now();
  if (!userLastMessages[userId]) {
    userLastMessages[userId] = { text: "", ts: 0 };
  }
  const last = userLastMessages[userId];
  const dup = last.text === text && now - last.ts < RATE_LIMIT.DUPLICATE_MS;
  userLastMessages[userId] = { text, ts: now };
  return dup;
}

function checkRateLimit(userId) {
  const now = Date.now();
  if (!userMessageTimestamps[userId]) userMessageTimestamps[userId] = [];
  userMessageTimestamps[userId] = userMessageTimestamps[userId].filter(
    (t) => now - t < RATE_LIMIT.WINDOW_MS,
  );
  if (userMessageTimestamps[userId].length >= RATE_LIMIT.MAX_MSG) {
    return false;
  }
  userMessageTimestamps[userId].push(now);
  return true;
}

function isProcessing(userId, msgId) {
  const key = `${userId}:${msgId}`;
  const now = Date.now();
  if (processingMessages[key]) return true;
  processingMessages[key] = now;
  return false;
}

function doneProcessing(userId, msgId) {
  delete processingMessages[`${userId}:${msgId}`];
}

/* =========================================================
   💾 DATABASE FUNCTIONS
   ========================================================= */

// INSERT BOOKING
async function insertBooking(booking) {
  const { data, error } = await supabase
    .from("bookings")
    .insert([
      {
        name: booking.name,
        phone: booking.phone,
        service: booking.service,
        appointment: booking.appointment,
        status: "new",
      },
    ])
    .select()
    .single();

  if (error) {
    console.error("❌ Insert booking error:", error);
    return null;
  }

  // history
  await supabase.from("booking_history").insert([
    {
      booking_id: data.id,
      action: "created",
      note: "Booking created via WhatsApp",
    },
  ]);

  return data;
}

// FIND BOOKING
async function findBookingByPhone(phone) {
  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .eq("phone", phone)
    .eq("status", "new")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error) return null;
  return data;
}

// CANCEL BOOKING
async function cancelBooking(booking) {
  const { error } = await supabase
    .from("bookings")
    .update({
      status: "canceled",
      canceled_at: new Date().toISOString(),
    })
    .eq("id", booking.id);

  if (error) return false;

  await supabase.from("booking_history").insert([
    {
      booking_id: booking.id,
      action: "canceled",
      note: "Booking canceled via WhatsApp",
    },
  ]);

  return true;
}

/* =========================================================
   📞 WHATSAPP API
   ========================================================= */
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;

async function sendText(to, body) {
  await axios.post(
    `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
    { messaging_product: "whatsapp", to, text: { body } },
    { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } },
  );
}

async function sendImage(to, link, caption) {
  await axios.post(
    `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: "whatsapp",
      to,
      type: "image",
      image: { link, caption },
    },
    { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } },
  );
}

async function sendDoctors(to) {
  await sendText(to, "👨‍⚕️ فريق الأطباء لدينا:");
  for (let i = 0; i < DOCTOR_INFO.length; i++) {
    await sendImage(
      to,
      DOCTOR_IMAGES[i],
      `${DOCTOR_INFO[i].name}\n${DOCTOR_INFO[i].specialization}`,
    );
  }
}

async function sendSlots(to) {
  const buttons = clinicSettings.booking_times.map((t) => ({
    type: "reply",
    reply: { id: `slot_${t}`, title: t },
  }));

  await axios.post(
    `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: "📅 اختر الموعد:" },
        action: { buttons },
      },
    },
    { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } },
  );
}

async function sendServices(to) {
  await axios.post(
    `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "list",
        body: { text: "اختر الخدمة:" },
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

/* =========================================================
   🧠 INTENT HELPERS
   ========================================================= */
const isBooking = (t) => /(حجز|موعد|book)/i.test(t);
const isCancel = (t) => /(الغاء|إلغاء|cancel)/i.test(t);
const isDoctor = (t) => /(طبيب|دكتور|doctor)/i.test(t);
const isReset = (t) => /(reset|ابدأ|عيد)/i.test(t);

/* =========================================================
   📩 WEBHOOK
   ========================================================= */
app.post("/webhook", async (req, res) => {
  const msg = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!msg) return res.sendStatus(200);

  const from = msg.from;
  const msgId = msg.id;

  if (isProcessing(from, msgId)) return res.sendStatus(200);

  try {
    if (!checkRateLimit(from)) return res.sendStatus(200);

    if (msg.type === "audio") {
      await handleAudioMessage(
        msg,
        from,
        askAI,
        sendText,
        sendSlots,
        sendServices,
        sendDoctors,
        tempBookings,
        cancelSessions,
      );
      return res.sendStatus(200);
    }

    if (msg.type === "interactive") {
      const id =
        msg.interactive?.button_reply?.id || msg.interactive?.list_reply?.id;

      if (id.startsWith("slot_")) {
        tempBookings[from] = { appointment: id.replace("slot_", "") };
        await sendText(from, "👍 أرسل اسمك:");
      }

      if (id.startsWith("service_")) {
        tempBookings[from].service = id.replace("service_", "");
        const saved = await insertBooking(tempBookings[from]);
        await sendText(
          from,
          saved ? "✅ تم تأكيد الحجز" : "❌ حدث خطأ أثناء الحجز",
        );
        delete tempBookings[from];
      }
      return res.sendStatus(200);
    }

    if (msg.type === "text") {
      const text = msg.text.body;

      if (isDuplicateMessage(from, text)) return res.sendStatus(200);

      if (isReset(text)) {
        delete tempBookings[from];
        delete cancelSessions[from];
        await sendText(from, `👋 مرحباً بك في ${clinicSettings.clinic_name}`);
        return res.sendStatus(200);
      }

      if (isCancel(text)) {
        cancelSessions[from] = true;
        await sendText(from, "📱 أرسل رقم الجوال:");
        return res.sendStatus(200);
      }

      if (cancelSessions[from]) {
        const phone = text.replace(/\D/g, "");
        const booking = await findBookingByPhone(phone);
        if (!booking) {
          await sendText(from, "❌ لا يوجد حجز.");
        } else {
          await cancelBooking(booking);
          await sendText(from, "🟣 تم إلغاء الحجز.");
        }
        delete cancelSessions[from];
        return res.sendStatus(200);
      }

      if (isDoctor(text)) {
        await sendDoctors(from);
        return res.sendStatus(200);
      }

      if (isBooking(text)) {
        tempBookings[from] = {};
        await sendSlots(from);
        return res.sendStatus(200);
      }

      if (tempBookings[from] && !tempBookings[from].name) {
        if (!(await validateNameWithAI(text))) {
          await sendText(from, "⚠️ اسم غير صحيح");
          return res.sendStatus(200);
        }
        tempBookings[from].name = text;
        await sendText(from, "📱 أرسل رقم الجوال:");
        return res.sendStatus(200);
      }

      if (tempBookings[from] && !tempBookings[from].phone) {
        tempBookings[from].phone = text.replace(/\D/g, "");
        await sendServices(from);
        return res.sendStatus(200);
      }

      const reply = await askAI(text);
      await sendText(from, reply);
    }
  } catch (e) {
    console.error("❌ Webhook error:", e);
  } finally {
    doneProcessing(from, msgId);
  }

  res.sendStatus(200);
});

/* =========================================================
   🔐 WEBHOOK VERIFY
   ========================================================= */
app.get("/webhook", (req, res) => {
  if (
    req.query["hub.mode"] === "subscribe" &&
    req.query["hub.verify_token"] === process.env.VERIFY_TOKEN
  ) {
    return res.send(req.query["hub.challenge"]);
  }
  res.sendStatus(403);
});

/* =========================================================
   🩺 HEALTH
   ========================================================= */
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    clinic: clinicSettings.clinic_name,
    timestamp: new Date().toISOString(),
  });
});

/* =========================================================
   🚀 START
   ========================================================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🚀 WhatsApp Clinic Bot running on", PORT);
});
