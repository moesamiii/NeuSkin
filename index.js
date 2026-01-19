import express from "express";
import axios from "axios";
import Groq from "groq-sdk";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(express.json());

// ==============================
// 📸 DOCTOR DATA
// ==============================
const DOCTOR_IMAGES = [
  "https://drive.google.com/uc?export=view&id=1aHoA2ks39qeuMk9WMZOdotOod-agEonm",
  "https://drive.google.com/uc?export=view&id=1Oe2UG2Gas6UY0ORxXtUYvTJeJZ8Br2_R",
  "https://drive.google.com/uc?export=view&id=1_4eDWRuVme3YaLLoeFP_10LYHZyHyjUT",
];

const DOCTOR_INFO = [
  { name: "د. أحمد الخطيب", specialization: "تقويم الأسنان" },
  { name: "د. سارة محمود", specialization: "تجميل الأسنان" },
  { name: "د. خالد العمري", specialization: "طب الأسنان العام" },
];

// ==============================
// 🛡️ SPAM PROTECTION
// ==============================
const userMessageTimestamps = {}; // Track message timestamps per user
const userWarnings = {}; // Track warnings issued to users
const blockedUsers = {}; // Track temporarily blocked users

const RATE_LIMIT_CONFIG = {
  MAX_MESSAGES_PER_WINDOW: 5, // Max messages allowed in time window
  TIME_WINDOW_MS: 10000, // 10 seconds
  WARNING_THRESHOLD: 3, // Messages in 3 seconds triggers warning
  WARNING_WINDOW_MS: 3000, // 3 seconds for warning threshold
  BLOCK_DURATION_MS: 60000, // Block for 1 minute
  MAX_WARNINGS: 2, // After 2 warnings, block user
};

function checkRateLimit(userId) {
  const now = Date.now();

  // Check if user is blocked
  if (blockedUsers[userId]) {
    if (now - blockedUsers[userId] < RATE_LIMIT_CONFIG.BLOCK_DURATION_MS) {
      const remainingTime = Math.ceil(
        (RATE_LIMIT_CONFIG.BLOCK_DURATION_MS - (now - blockedUsers[userId])) /
          1000,
      );
      return {
        allowed: false,
        blocked: true,
        remainingTime,
      };
    } else {
      // Unblock user
      delete blockedUsers[userId];
      delete userWarnings[userId];
      userMessageTimestamps[userId] = [];
    }
  }

  // Initialize user tracking if not exists
  if (!userMessageTimestamps[userId]) {
    userMessageTimestamps[userId] = [];
  }

  // Remove timestamps outside the time window
  userMessageTimestamps[userId] = userMessageTimestamps[userId].filter(
    (timestamp) => now - timestamp < RATE_LIMIT_CONFIG.TIME_WINDOW_MS,
  );

  // Check for spam in warning window (faster rate)
  const recentMessages = userMessageTimestamps[userId].filter(
    (timestamp) => now - timestamp < RATE_LIMIT_CONFIG.WARNING_WINDOW_MS,
  );

  // Issue warning if too many messages too fast
  if (recentMessages.length >= RATE_LIMIT_CONFIG.WARNING_THRESHOLD) {
    userWarnings[userId] = (userWarnings[userId] || 0) + 1;

    // Block user if exceeded max warnings
    if (userWarnings[userId] >= RATE_LIMIT_CONFIG.MAX_WARNINGS) {
      blockedUsers[userId] = now;
      console.log(`🚫 User ${userId} blocked for spam`);
      return {
        allowed: false,
        blocked: true,
        remainingTime: Math.ceil(RATE_LIMIT_CONFIG.BLOCK_DURATION_MS / 1000),
      };
    }

    return {
      allowed: true,
      warning: true,
      warningCount: userWarnings[userId],
    };
  }

  // Check if user exceeded rate limit
  if (
    userMessageTimestamps[userId].length >=
    RATE_LIMIT_CONFIG.MAX_MESSAGES_PER_WINDOW
  ) {
    return {
      allowed: false,
      blocked: false,
      message: "تجاوزت الحد المسموح من الرسائل",
    };
  }

  // Add current timestamp
  userMessageTimestamps[userId].push(now);

  return {
    allowed: true,
    warning: false,
  };
}

// Clean up old data every 5 minutes
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

  // Clean up unblocked users
  for (const userId in blockedUsers) {
    if (now - blockedUsers[userId] >= RATE_LIMIT_CONFIG.BLOCK_DURATION_MS) {
      delete blockedUsers[userId];
      delete userWarnings[userId];
    }
  }
}, 300000); // 5 minutes

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

// ✅ NEW: Find booking by phone
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
      console.error("❌ Find booking error:", error);
      return null;
    }

    return data;
  } catch (err) {
    console.error("❌ Find booking exception:", err.message);
    return null;
  }
}

// ✅ NEW: Cancel booking
async function cancelBooking(id) {
  try {
    const { error } = await supabase
      .from("bookings")
      .update({ status: "canceled" })
      .eq("id", id);

    if (error) {
      console.error("❌ Cancel booking error:", error);
      return false;
    }

    return true;
  } catch (err) {
    console.error("❌ Cancel booking exception:", err.message);
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

// ✅ Send image message
async function sendImageMessage(to, imageUrl, caption) {
  try {
    await axios.post(
      `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to,
        type: "image",
        image: {
          link: imageUrl,
          caption: caption,
        },
      },
      { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } },
    );
  } catch (err) {
    console.error("❌ Image send error:", err.message);
  }
}

// ✅ Send doctor info
async function sendDoctorInfo(to) {
  await sendTextMessage(to, "👨‍⚕️ فريق الأطباء لدينا:");

  for (let i = 0; i < DOCTOR_INFO.length; i++) {
    const doctor = DOCTOR_INFO[i];
    const caption = `${doctor.name}\n${doctor.specialization}`;
    await sendImageMessage(to, DOCTOR_IMAGES[i], caption);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
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
// 🧠 BOOKING & CANCEL STATE
// ==============================
const tempBookings = {};
const cancelSessions = {}; // NEW: Track users waiting to cancel

// ✅ Booking intent detection
function isBookingRequest(text) {
  return /(حجز|موعد|احجز|book|appointment|reserve)/i.test(text);
}

// ✅ Cancel intent detection
function isCancelRequest(text) {
  return /(الغاء|إلغاء|الغي|كنسل|cancel)/i.test(text);
}

// ✅ Doctor request detection
function isDoctorRequest(text) {
  return /(طبيب|اطباء|أطباء|الاطباء|الأطباء|دكتور|دكاترة|doctor|doctors)/i.test(
    text,
  );
}

// ✅ NEW: Reset/Start request detection
function isResetRequest(text) {
  return /(reset|start|عيد من اول|ابدا من جديد|ابدأ من جديد|من البداية|بداية جديدة|restart|new chat|ابدا|ابدأ|عيد)/i.test(
    text,
  );
}

// ==============================
// 📩 WEBHOOK
// ==============================
app.post("/webhook", async (req, res) => {
  const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!message) return res.sendStatus(200);

  const from = message.from;

  // ✅ SPAM PROTECTION CHECK
  const rateLimitCheck = checkRateLimit(from);

  if (!rateLimitCheck.allowed) {
    if (rateLimitCheck.blocked) {
      console.log(`🚫 Blocked user ${from} attempted to send message`);
      await sendTextMessage(
        from,
        `⛔ تم حظرك مؤقتاً بسبب إرسال رسائل كثيرة.\n\nسيتم رفع الحظر بعد ${rateLimitCheck.remainingTime} ثانية.\n\nيرجى الانتظار والتواصل بشكل طبيعي.`,
      );
      return res.sendStatus(200);
    } else {
      await sendTextMessage(
        from,
        "⚠️ يرجى الانتظار قليلاً قبل إرسال رسائل إضافية.",
      );
      return res.sendStatus(200);
    }
  }

  // Issue warning if needed
  if (rateLimitCheck.warning) {
    console.log(`⚠️ Warning ${rateLimitCheck.warningCount} issued to ${from}`);
    await sendTextMessage(
      from,
      `⚠️ تحذير ${rateLimitCheck.warningCount}/${RATE_LIMIT_CONFIG.MAX_WARNINGS}: يرجى التواصل بشكل طبيعي وعدم إرسال رسائل متتالية سريعة.\n\nإذا استمررت، سيتم حظرك مؤقتاً.`,
    );
  }

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

    console.log("📩 Message from:", from, "Text:", text);

    // ✅ PRIORITY 0: RESET/START DETECTION (HIGHEST PRIORITY!)
    if (isResetRequest(text)) {
      console.log("🔄 Reset request detected!");

      // Clear all user sessions
      delete tempBookings[from];
      delete cancelSessions[from];

      const lang = detectLanguage(text);
      const greeting =
        lang === "ar"
          ? "👋 مرحباً بك في عيادة ابتسامة!\n\nكيف يمكنني مساعدتك اليوم؟"
          : "👋 Hello! Welcome to Ibtisama Clinic!\n\nHow can I help you today?";

      await sendTextMessage(from, greeting);
      return res.sendStatus(200);
    }

    // ✅ PRIORITY 1: CANCEL DETECTION (MUST BE FIRST!)
    if (isCancelRequest(text) && !tempBookings[from]) {
      console.log("🚫 Cancel request detected!");

      cancelSessions[from] = true;

      // Clear any ongoing booking
      if (tempBookings[from]) {
        delete tempBookings[from];
      }

      await sendTextMessage(from, "📌 أرسل رقم الجوال المستخدم في الحجز:");
      return res.sendStatus(200);
    }

    // ✅ PRIORITY 2: User is in cancel flow - waiting for phone
    if (cancelSessions[from]) {
      const phone = text.replace(/\D/g, "");

      if (phone.length < 8) {
        await sendTextMessage(from, "⚠️ رقم الجوال غير صحيح. حاول مجددًا:");
        return res.sendStatus(200);
      }

      // Find booking
      const booking = await findBookingByPhone(phone);

      if (!booking) {
        await sendTextMessage(from, "❌ لا يوجد حجز مرتبط بهذا الرقم.");
        delete cancelSessions[from];
        return res.sendStatus(200);
      }

      // Cancel it
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
      return res.sendStatus(200);
    }

    // ✅ PRIORITY 3: Doctor request
    if (!tempBookings[from] && isDoctorRequest(text)) {
      await sendDoctorInfo(from);
      return res.sendStatus(200);
    }

    // ✅ PRIORITY 4: Start booking
    if (!tempBookings[from] && isBookingRequest(text)) {
      console.log("📅 Starting booking for:", from);
      tempBookings[from] = {};
      await sendAppointmentOptions(from);
      return res.sendStatus(200);
    }

    // ✅ PRIORITY 5: In booking flow - collect name
    if (tempBookings[from] && !tempBookings[from].name) {
      tempBookings[from].name = text;
      await sendTextMessage(from, "📱 أرسل رقم الجوال:");
      return res.sendStatus(200);
    }

    // ✅ PRIORITY 6: In booking flow - collect phone
    if (tempBookings[from] && !tempBookings[from].phone) {
      tempBookings[from].phone = text.replace(/\D/g, "");
      await sendServiceList(from);
      return res.sendStatus(200);
    }

    // ✅ PRIORITY 7: General question - send to AI
    if (!tempBookings[from]) {
      const reply = await askAI(text);
      await sendTextMessage(from, reply);
      return res.sendStatus(200);
    }
  }

  res.sendStatus(200);
});

// ✅ Webhook verification
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// ==============================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🚀 Server running on port", PORT));
