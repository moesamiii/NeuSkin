/* =========================================================
   🏥 WhatsApp Clinic Bot – Complete Production Version
   ---------------------------------------------------------
   ✔ Supabase (Service Role) with booking_history
   ✔ WhatsApp Cloud API
   ✔ AI (askAI / validateNameWithAI)
   ✔ Voice messages
   ✔ Booking + Cancel with history tracking
   ✔ clinic_settings from DB
   ✔ Rate limit & anti-duplicate & spam protection
   ✔ Doctor info with images
   ✔ Reset/Start functionality
   ✔ Production ready
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
  try {
    const { data, error } = await supabase
      .from("clinic_settings")
      .select("*")
      .eq("clinic_id", "default")
      .single();

    if (error) {
      console.warn("⚠️ Using fallback clinic settings:", error.message);
      return;
    }

    clinicSettings = data;
    console.log(
      "✅ Clinic settings loaded from DB:",
      clinicSettings.clinic_name,
    );
  } catch (err) {
    console.warn(
      "⚠️ Error loading clinic settings, using defaults:",
      err.message,
    );
  }
}

// Load on cold start
await loadClinicSettings();

/* =========================================================
   👨‍⚕️ DOCTORS DATA
   ========================================================= */
const DOCTOR_IMAGES = [
  "https://drive.google.com/uc?export=view&id=1ibiePCccQytufxR6MREHQsuQcdKEgnHu",
  "https://drive.google.com/uc?export=view&id=1oLw96zy3aWwJaOx6mwtZV173B7s5Rb64",
];

const DOCTOR_INFO = [
  { name: "د. طارق عورتاني", specialization: "اخصائي جلدية" },
  { name: "د. ميساء صافي", specialization: "اخصائية جلدية" },
];

/* =========================================================
   🛡️ ANTI-SPAM & RATE LIMIT
   ========================================================= */
const userMessageTimestamps = {};
const userLastMessages = {};
const processingMessages = {};

const RATE_LIMIT_CONFIG = {
  DUPLICATE_WINDOW_MS: 5000,
  MAX_MESSAGES_PER_WINDOW: 10,
  TIME_WINDOW_MS: 30000,
  PROCESSING_TIMEOUT_MS: 10000,
};

function isDuplicateMessage(userId, messageText) {
  const now = Date.now();

  if (!userLastMessages[userId]) {
    userLastMessages[userId] = { text: "", timestamp: 0 };
  }

  const lastMsg = userLastMessages[userId];
  const isDuplicate =
    lastMsg.text === messageText &&
    now - lastMsg.timestamp < RATE_LIMIT_CONFIG.DUPLICATE_WINDOW_MS;

  userLastMessages[userId] = { text: messageText, timestamp: now };
  return isDuplicate;
}

function checkRateLimit(userId) {
  const now = Date.now();

  if (!userMessageTimestamps[userId]) {
    userMessageTimestamps[userId] = [];
  }

  userMessageTimestamps[userId] = userMessageTimestamps[userId].filter(
    (timestamp) => now - timestamp < RATE_LIMIT_CONFIG.TIME_WINDOW_MS,
  );

  if (
    userMessageTimestamps[userId].length >=
    RATE_LIMIT_CONFIG.MAX_MESSAGES_PER_WINDOW
  ) {
    console.log(`⚠️ Rate limit exceeded for ${userId}`);
    return { allowed: false, rateLimited: true };
  }

  userMessageTimestamps[userId].push(now);
  return { allowed: true, rateLimited: false };
}

function isMessageBeingProcessed(userId, messageId) {
  const now = Date.now();

  // Clean up old processing entries
  for (const key in processingMessages) {
    if (
      now - processingMessages[key] >
      RATE_LIMIT_CONFIG.PROCESSING_TIMEOUT_MS
    ) {
      delete processingMessages[key];
    }
  }

  const processingKey = `${userId}:${messageId}`;

  if (processingMessages[processingKey]) return true;

  processingMessages[processingKey] = now;
  return false;
}

function markMessageProcessed(userId, messageId) {
  delete processingMessages[`${userId}:${messageId}`];
}

// Cleanup interval - run every 2 minutes
setInterval(() => {
  const now = Date.now();

  // Clean up message timestamps
  for (const userId in userMessageTimestamps) {
    userMessageTimestamps[userId] = userMessageTimestamps[userId].filter(
      (timestamp) => now - timestamp < RATE_LIMIT_CONFIG.TIME_WINDOW_MS,
    );
    if (userMessageTimestamps[userId].length === 0) {
      delete userMessageTimestamps[userId];
    }
  }

  // Clean up last messages
  for (const userId in userLastMessages) {
    if (
      now - userLastMessages[userId].timestamp >
      RATE_LIMIT_CONFIG.DUPLICATE_WINDOW_MS * 2
    ) {
      delete userLastMessages[userId];
    }
  }

  // Clean up processing messages
  for (const key in processingMessages) {
    if (
      now - processingMessages[key] >
      RATE_LIMIT_CONFIG.PROCESSING_TIMEOUT_MS
    ) {
      delete processingMessages[key];
    }
  }
}, 120000);

/* =========================================================
   💾 SUPABASE DATABASE FUNCTIONS
   ========================================================= */

// INSERT BOOKING
async function insertBooking(booking) {
  try {
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
      console.error("❌ Insert booking error:", error.message);
      return null;
    }

    console.log("✅ Booking saved to Supabase:", data);

    // Insert into booking_history
    await supabase.from("booking_history").insert([
      {
        booking_id: data.id,
        action: "created",
        note: "Booking created via WhatsApp",
      },
    ]);

    return data;
  } catch (err) {
    console.error("❌ Insert booking exception:", err.message);
    return null;
  }
}

// FIND BOOKING BY PHONE
async function findBookingByPhone(phone) {
  try {
    const { data, error } = await supabase
      .from("bookings")
      .select("*")
      .eq("phone", phone)
      .eq("status", "new")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error) {
      console.log("❌ No booking found for phone:", phone);
      return null;
    }

    console.log("✅ Booking found:", data);
    return data;
  } catch (err) {
    console.error("❌ Find booking error:", err.message);
    return null;
  }
}

// CANCEL BOOKING
async function cancelBooking(booking) {
  try {
    const { error } = await supabase
      .from("bookings")
      .update({
        status: "canceled",
        canceled_at: new Date().toISOString(),
      })
      .eq("id", booking.id);

    if (error) {
      console.error("❌ Cancel booking error:", error.message);
      return false;
    }

    console.log("✅ Booking canceled in Supabase");

    // Insert into booking_history
    await supabase.from("booking_history").insert([
      {
        booking_id: booking.id,
        action: "canceled",
        note: "Booking canceled via WhatsApp",
      },
    ]);

    return true;
  } catch (err) {
    console.error("❌ Cancel booking exception:", err.message);
    return false;
  }
}

/* =========================================================
   📞 WHATSAPP API
   ========================================================= */
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;

async function sendTextMessage(to, text) {
  try {
    await axios.post(
      `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
      { messaging_product: "whatsapp", to, text: { body: text } },
      { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } },
    );
  } catch (err) {
    console.error("❌ Send message error:", err.message);
  }
}

async function sendImageMessage(to, imageUrl, caption) {
  try {
    await axios.post(
      `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to,
        type: "image",
        image: { link: imageUrl, caption },
      },
      { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } },
    );
  } catch (err) {
    console.error("❌ Image send error:", err.message);
  }
}

async function sendDoctorInfo(to) {
  await sendTextMessage(to, "👨‍⚕️ فريق الأطباء لدينا:");

  for (let i = 0; i < DOCTOR_INFO.length; i++) {
    await sendImageMessage(
      to,
      DOCTOR_IMAGES[i],
      `${DOCTOR_INFO[i].name}\n${DOCTOR_INFO[i].specialization}`,
    );
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

async function sendAppointmentOptions(to) {
  const bookingTimes = clinicSettings?.booking_times || [
    "3 PM",
    "6 PM",
    "9 PM",
  ];

  const buttons = bookingTimes.slice(0, 3).map((time) => ({
    type: "reply",
    reply: {
      id: `slot_${time.toLowerCase().replace(/\s/g, "")}`,
      title: time,
    },
  }));

  await axios.post(
    `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
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
                { id: "service_فحص الجلد والبشرة", title: "فحص الجلد والبشرة" },
                { id: "service_علاج حب الشباب", title: "علاج حب الشباب" },
                {
                  id: "service_علاج التصبغات والبقع",
                  title: "علاج التصبغات والبقع",
                },
                {
                  id: "service_إزالة الشعر بالليزر",
                  title: "إزالة الشعر بالليزر",
                },
                {
                  id: "service_حقن الفيلر والبوتوكس",
                  title: "حقن الفيلر والبوتوكس",
                },
                { id: "service_التقشير الكيميائي", title: "التقشير الكيميائي" },
                {
                  id: "service_الميزوثيرابي للبشرة",
                  title: "الميزوثيرابي للبشرة",
                },
                {
                  id: "service_علاج الندبات وآثار الحبوب",
                  title: "علاج الندبات وآثار الحبوب",
                },
                {
                  id: "service_علاج الأكزيما والصدفية",
                  title: "علاج الأكزيما والصدفية",
                },
                { id: "service_فحص الشامات", title: "فحص الشامات" },
                {
                  id: "service_علاج الهالات السوداء",
                  title: "علاج الهالات السوداء",
                },
                {
                  id: "service_شد البشرة وعلاج التجاعيد",
                  title: "شد البشرة وعلاج التجاعيد",
                },
                {
                  id: "service_جلسات نضارة البشرة",
                  title: "جلسات نضارة البشرة",
                },
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
   🧠 INTENT DETECTION HELPERS
   ========================================================= */
function isBookingRequest(text) {
  return /(حجز|موعد|احجز|book|appointment|reserve)/i.test(text);
}

function isCancelRequest(text) {
  return /(الغاء|إلغاء|الغي|كنسل|cancel)/i.test(text);
}

function isDoctorRequest(text) {
  return /(طبيب|اطباء|أطباء|الاطباء|الأطباء|دكتور|دكاترة|doctor|doctors)/i.test(
    text,
  );
}

function isResetRequest(text) {
  return /(reset|start|عيد من اول|ابدا من جديد|ابدأ من جديد|من البداية|بداية جديدة|restart|new chat|ابدا|ابدأ|عيد)/i.test(
    text,
  );
}

/* =========================================================
   📩 WEBHOOK - MAIN MESSAGE HANDLER
   ========================================================= */
app.post("/webhook", async (req, res) => {
  const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!message) return res.sendStatus(200);

  const from = message.from;
  const messageId = message.id;

  // Check if message is already being processed
  if (isMessageBeingProcessed(from, messageId)) {
    console.log(
      `🔄 Message ${messageId} from ${from} already processing - ignoring`,
    );
    return res.sendStatus(200);
  }

  try {
    // Duplicate detection for text messages
    if (message.type === "text") {
      const text = message.text.body;
      if (isDuplicateMessage(from, text)) {
        console.log(`🔁 Duplicate message from ${from}: "${text}" - ignoring`);
        markMessageProcessed(from, messageId);
        return res.sendStatus(200);
      }
    }

    // Rate limit check
    const rateLimitCheck = checkRateLimit(from);
    if (!rateLimitCheck.allowed) {
      console.log(`⚠️ Rate limited user ${from} - silently ignoring`);
      markMessageProcessed(from, messageId);
      return res.sendStatus(200);
    }

    // ============ VOICE MESSAGE HANDLING ============
    if (message.type === "audio") {
      console.log("🎙️ Voice message received from", from);
      try {
        await handleAudioMessage(
          message,
          from,
          askAI,
          sendTextMessage,
          sendAppointmentOptions,
          sendServiceList,
          sendDoctorInfo,
          tempBookings,
          cancelSessions,
        );
        markMessageProcessed(from, messageId);
        return res.sendStatus(200);
      } catch (err) {
        console.error("❌ Voice handling error:", err.message);
        await sendTextMessage(
          from,
          "⚠️ عذراً، حدث خطأ في معالجة الرسالة الصوتية.",
        );
        markMessageProcessed(from, messageId);
        return res.sendStatus(200);
      }
    }

    // ============ INTERACTIVE BUTTONS ============
    if (message.type === "interactive") {
      const id =
        message.interactive?.button_reply?.id ||
        message.interactive?.list_reply?.id;

      // Time slot selected
      if (id.startsWith("slot_")) {
        tempBookings[from] = {
          appointment: id.replace("slot_", "").toUpperCase(),
        };
        await sendTextMessage(from, "👍 أرسل اسمك:");
        markMessageProcessed(from, messageId);
        return res.sendStatus(200);
      }

      // Service selected - complete booking
      if (id.startsWith("service_")) {
        const booking = tempBookings[from];
        booking.service = id.replace("service_", "");

        const saved = await insertBooking(booking);

        if (saved) {
          await sendTextMessage(
            from,
            `✅ تم تأكيد الحجز:\n👤 ${booking.name}\n📱 ${booking.phone}\n💊 ${booking.service}\n📅 ${booking.appointment}`,
          );
        } else {
          await sendTextMessage(
            from,
            "⚠️ حدث خطأ في حفظ الحجز. يرجى المحاولة مرة أخرى.",
          );
        }

        delete tempBookings[from];
        markMessageProcessed(from, messageId);
        return res.sendStatus(200);
      }
    }

    // ============ TEXT MESSAGES ============
    if (message.type === "text") {
      const text = message.text.body;
      console.log("📩 Message from:", from, "Text:", text);

      // PRIORITY 0: RESET/START (Highest Priority)
      if (isResetRequest(text)) {
        console.log("🔄 Reset request detected");
        delete tempBookings[from];
        delete cancelSessions[from];

        const lang = /[\u0600-\u06FF]/.test(text) ? "ar" : "en";
        const clinicName =
          clinicSettings?.clinic_name ||
          (lang === "ar" ? "عيادة ابتسامة" : "Ibtisama Clinic");

        const greeting =
          lang === "ar"
            ? `👋 مرحباً بك في ${clinicName}!\n\nكيف يمكنني مساعدتك اليوم؟`
            : `👋 Hello! Welcome to ${clinicName}!\n\nHow can I help you today?`;

        await sendTextMessage(from, greeting);
        markMessageProcessed(from, messageId);
        return res.sendStatus(200);
      }

      // PRIORITY 1: CANCEL DETECTION
      if (isCancelRequest(text) && !tempBookings[from]) {
        console.log("🚫 Cancel request detected");
        cancelSessions[from] = true;

        if (tempBookings[from]) {
          delete tempBookings[from];
        }

        await sendTextMessage(from, "📌 أرسل رقم الجوال المستخدم في الحجز:");
        markMessageProcessed(from, messageId);
        return res.sendStatus(200);
      }

      // PRIORITY 2: CANCEL FLOW - Waiting for phone
      if (cancelSessions[from]) {
        const phone = text.replace(/\D/g, "");

        if (phone.length < 8) {
          await sendTextMessage(from, "⚠️ رقم الجوال غير صحيح. حاول مجددًا:");
          markMessageProcessed(from, messageId);
          return res.sendStatus(200);
        }

        const booking = await findBookingByPhone(phone);

        if (!booking) {
          await sendTextMessage(from, "❌ لا يوجد حجز مرتبط بهذا الرقم.");
          delete cancelSessions[from];
          markMessageProcessed(from, messageId);
          return res.sendStatus(200);
        }

        const success = await cancelBooking(booking);

        if (success) {
          await sendTextMessage(
            from,
            `🟣 تم إلغاء الحجز:\n👤 ${booking.name}\n💊 ${booking.service}\n📅 ${booking.appointment}`,
          );
        } else {
          await sendTextMessage(from, "⚠️ حدث خطأ أثناء الإلغاء.");
        }

        delete cancelSessions[from];
        markMessageProcessed(from, messageId);
        return res.sendStatus(200);
      }

      // PRIORITY 3: DOCTOR REQUEST
      if (!tempBookings[from] && isDoctorRequest(text)) {
        await sendDoctorInfo(from);
        markMessageProcessed(from, messageId);
        return res.sendStatus(200);
      }

      // PRIORITY 4: START BOOKING
      if (!tempBookings[from] && isBookingRequest(text)) {
        console.log("📅 Starting booking for:", from);
        tempBookings[from] = {};
        await sendAppointmentOptions(from);
        markMessageProcessed(from, messageId);
        return res.sendStatus(200);
      }

      // PRIORITY 5: COLLECT NAME
      if (tempBookings[from] && !tempBookings[from].name) {
        const isValidName = await validateNameWithAI(text);

        if (!isValidName) {
          await sendTextMessage(from, "⚠️ الرجاء إدخال اسم صحيح:");
          markMessageProcessed(from, messageId);
          return res.sendStatus(200);
        }

        tempBookings[from].name = text;
        await sendTextMessage(from, "📱 أرسل رقم الجوال:");
        markMessageProcessed(from, messageId);
        return res.sendStatus(200);
      }

      // PRIORITY 6: COLLECT PHONE
      if (tempBookings[from] && !tempBookings[from].phone) {
        tempBookings[from].phone = text.replace(/\D/g, "");
        await sendServiceList(from);
        markMessageProcessed(from, messageId);
        return res.sendStatus(200);
      }

      // PRIORITY 7: GENERAL QUESTION - AI
      if (!tempBookings[from]) {
        const reply = await askAI(text);
        await sendTextMessage(from, reply);
        markMessageProcessed(from, messageId);
        return res.sendStatus(200);
      }
    }

    markMessageProcessed(from, messageId);
  } catch (error) {
    console.error("❌ Error processing message:", error);
    markMessageProcessed(from, messageId);
  }

  res.sendStatus(200);
});

/* =========================================================
   🔐 WEBHOOK VERIFICATION
   ========================================================= */
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  console.log("🔍 Webhook verification:");
  console.log("Mode:", mode);
  console.log("Token:", token);
  console.log("Expected:", process.env.VERIFY_TOKEN);

  if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
    console.log("✅ Verification successful");
    return res.status(200).send(challenge);
  }

  console.log("❌ Verification failed");
  res.sendStatus(403);
});

/* =========================================================
   🩺 HEALTH & INFO ENDPOINTS
   ========================================================= */
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "WhatsApp Bot is running - Connected to Supabase",
    clinic: clinicSettings.clinic_name,
    timestamp: new Date().toISOString(),
  });
});

app.get("/bookings", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("bookings")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({
      total: data.length,
      bookings: data,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================================================
   🚀 START SERVER
   ========================================================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
  console.log("🏥 Clinic:", clinicSettings.clinic_name);
  console.log("💾 Connected to Supabase Database");
  console.log(
    "📊 Features: Bookings, Cancellations, History, Voice, AI, Anti-spam",
  );
});
