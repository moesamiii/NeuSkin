import express from "express";
import axios from "axios";
import { askAI, validateNameWithAI } from "./aiHelper.js";
import { handleAudioMessage } from "./webhookProcessor.js";

const app = express();
app.use(express.json());

/* ==============================
   💾 IN-MEMORY STORAGE
================================ */
const inMemoryStorage = {
  bookings: [],
  settings: {
    clinic_id: "default",
    clinic_name: "عيادة نيو سكن",
    booking_times: ["3 PM", "6 PM", "9 PM"],
  },
};

let clinicSettings = inMemoryStorage.settings;

/* ==============================
   📸 DOCTORS
================================ */
const DOCTOR_IMAGES = [
  "https://drive.google.com/uc?export=view&id=1ibiePCccQytufxR6MREHQsuQcdKEgnHu",
  "https://drive.google.com/uc?export=view&id=1oLw96zy3aWwJaOx6mwtZV173B7s5Rb64",
  "https://drive.google.com/uc?export=view&id=1UkAzSHARtI-t-T_PCiY4RKcsxtkxR4Jf",
];

const DOCTOR_INFO = [
  { name: "د. طارق عورتاني", specialization: "اخصائي جلدية" },
  { name: "د. ميساء صافي", specialization: "اخصائية جلدية" },
  { name: "د. تانيا بيربن", specialization: "اخصائية جلدية" },
];

/* ==============================
   🛡️ SPAM PROTECTION
================================ */
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

// Cleanup interval
setInterval(() => {
  const now = Date.now();
  for (const userId in userMessageTimestamps) {
    userMessageTimestamps[userId] = userMessageTimestamps[userId].filter(
      (timestamp) => now - timestamp < RATE_LIMIT_CONFIG.TIME_WINDOW_MS,
    );
    if (userMessageTimestamps[userId].length === 0) {
      delete userMessageTimestamps[userId];
    }
  }
  for (const userId in userLastMessages) {
    if (
      now - userLastMessages[userId].timestamp >
      RATE_LIMIT_CONFIG.DUPLICATE_WINDOW_MS * 2
    ) {
      delete userLastMessages[userId];
    }
  }
  for (const key in processingMessages) {
    if (
      now - processingMessages[key] >
      RATE_LIMIT_CONFIG.PROCESSING_TIMEOUT_MS
    ) {
      delete processingMessages[key];
    }
  }
}, 120000);

/* ==============================
   💾 DATABASE FUNCTIONS
================================ */
async function insertBooking(booking) {
  try {
    const id = Date.now().toString();
    const newBooking = {
      id,
      name: booking.name,
      phone: booking.phone,
      service: booking.service,
      appointment: booking.appointment,
      status: "new",
      created_at: new Date().toISOString(),
    };
    inMemoryStorage.bookings.push(newBooking);
    console.log("✅ Booking saved:", newBooking);
    console.log(`📊 Total bookings: ${inMemoryStorage.bookings.length}`);
    return true;
  } catch (err) {
    console.error("❌ Insert error:", err.message);
    return false;
  }
}

async function findBookingByPhone(phone) {
  try {
    const matchingBookings = inMemoryStorage.bookings
      .filter((b) => b.phone === phone && b.status === "new")
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    if (matchingBookings.length === 0) {
      console.log("❌ No booking found for phone:", phone);
      return null;
    }
    console.log("✅ Booking found:", matchingBookings[0]);
    return matchingBookings[0];
  } catch (err) {
    console.error("❌ Find booking error:", err.message);
    return null;
  }
}

async function cancelBooking(id) {
  try {
    const booking = inMemoryStorage.bookings.find((b) => b.id === id);
    if (!booking) {
      console.log("❌ Booking not found with id:", id);
      return false;
    }
    booking.status = "canceled";
    booking.canceled_at = new Date().toISOString();
    console.log("✅ Booking canceled:", booking);
    return true;
  } catch (err) {
    console.error("❌ Cancel error:", err.message);
    return false;
  }
}

/* ==============================
   📞 WHATSAPP
================================ */
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
  const buttons = bookingTimes.slice(0, 3).map((t) => ({
    type: "reply",
    reply: {
      id: `slot_${t.toLowerCase().replace(/\s/g, "")}`,
      title: t,
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
        body: { text: "📅 اختر الموعد المناسب:" },
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

/* ==============================
   🧠 STATE & INTENT DETECTION
================================ */
const tempBookings = {};
const cancelSessions = {};

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

/* ==============================
   📩 WEBHOOK
================================ */
app.post("/webhook", async (req, res) => {
  const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!message) return res.sendStatus(200);

  const from = message.from;
  const messageId = message.id;

  // Check if already processing
  if (isMessageBeingProcessed(from, messageId)) {
    console.log(`🔄 Message ${messageId} already processing - ignoring`);
    return res.sendStatus(200);
  }

  try {
    // Duplicate detection
    if (message.type === "text") {
      const text = message.text.body;
      if (isDuplicateMessage(from, text)) {
        console.log(`🔁 Duplicate message from ${from} - ignoring`);
        markMessageProcessed(from, messageId);
        return res.sendStatus(200);
      }
    }

    // Rate limit check
    const rateLimitCheck = checkRateLimit(from);
    if (!rateLimitCheck.allowed) {
      console.log(`⚠️ Rate limited user ${from}`);
      markMessageProcessed(from, messageId);
      return res.sendStatus(200);
    }

    // Voice message handling
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

    // Interactive buttons
    if (message.type === "interactive") {
      const id =
        message.interactive?.button_reply?.id ||
        message.interactive?.list_reply?.id;

      if (id.startsWith("slot_")) {
        tempBookings[from] = {
          appointment: id.replace("slot_", "").toUpperCase(),
        };
        await sendTextMessage(from, "👍 أرسل اسمك:");
        markMessageProcessed(from, messageId);
        return res.sendStatus(200);
      }

      if (id.startsWith("service_")) {
        const booking = tempBookings[from];
        booking.service = id.replace("service_", "");
        await insertBooking(booking);
        await sendTextMessage(
          from,
          `✅ تم تأكيد الحجز:\n👤 ${booking.name}\n📱 ${booking.phone}\n💊 ${booking.service}\n📅 ${booking.appointment}`,
        );
        delete tempBookings[from];
        markMessageProcessed(from, messageId);
        return res.sendStatus(200);
      }
    }

    // Text messages
    if (message.type === "text") {
      const text = message.text.body;
      console.log("📩 Message from:", from, "Text:", text);

      // PRIORITY 0: Reset/Start
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

      // PRIORITY 1: Cancel detection
      if (isCancelRequest(text) && !tempBookings[from]) {
        console.log("🚫 Cancel request detected");
        cancelSessions[from] = true;
        if (tempBookings[from]) delete tempBookings[from];
        await sendTextMessage(from, "📌 أرسل رقم الجوال المستخدم في الحجز:");
        markMessageProcessed(from, messageId);
        return res.sendStatus(200);
      }

      // PRIORITY 2: Cancel flow - waiting for phone
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
        const success = await cancelBooking(booking.id);
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

      // PRIORITY 3: Doctor request
      if (!tempBookings[from] && isDoctorRequest(text)) {
        await sendDoctorInfo(from);
        markMessageProcessed(from, messageId);
        return res.sendStatus(200);
      }

      // PRIORITY 4: Start booking
      if (!tempBookings[from] && isBookingRequest(text)) {
        console.log("📅 Starting booking for:", from);
        tempBookings[from] = {};
        await sendAppointmentOptions(from);
        markMessageProcessed(from, messageId);
        return res.sendStatus(200);
      }

      // PRIORITY 5: Collect name
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

      // PRIORITY 6: Collect phone
      if (tempBookings[from] && !tempBookings[from].phone) {
        tempBookings[from].phone = text.replace(/\D/g, "");
        await sendServiceList(from);
        markMessageProcessed(from, messageId);
        return res.sendStatus(200);
      }

      // PRIORITY 7: General question - AI
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

/* ==============================
   🔐 WEBHOOK VERIFICATION
================================ */
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

/* ==============================
   🏥 HEALTH & INFO ENDPOINTS
================================ */
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "WhatsApp Bot is running",
    clinic: clinicSettings.clinic_name,
    bookings_count: inMemoryStorage.bookings.length,
    timestamp: new Date().toISOString(),
  });
});

app.get("/bookings", (req, res) => {
  res.json({
    total: inMemoryStorage.bookings.length,
    bookings: inMemoryStorage.bookings,
  });
});

/* ==============================
   🚀 START SERVER
================================ */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
  console.log("🏥 Clinic:", clinicSettings.clinic_name);
  console.log("💾 Using in-memory storage (data will be lost on restart)");
});
