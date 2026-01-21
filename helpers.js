/**
 * helpers.js (FINAL — Supabase ONLY, No Google Sheets)
 */

const axios = require("axios");
const { askAI, validateNameWithAI } = require("./aiHelper");
const { createClient } = require("@supabase/supabase-js");

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
// 🗄 SUPABASE — ALL BOOKING LOGIC HERE
// =============================================
const {
  findLastBookingByPhone,
  updateBookingStatus,
  insertBookingToSupabase,
} = require("./databaseHelper");

// =============================================
// 🌍 ENVIRONMENT VARIABLES
// =============================================
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

// =============================================
// 💬 SEND WHATSAPP TEXT MESSAGE
// =============================================
async function sendTextMessage(to, text) {
  try {
    console.log(`📤 Sending WhatsApp: ${to}`, text);

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
  } catch (err) {
    console.error("❌ WhatsApp send error:", err.response?.data || err.message);
  }
}

// =============================================
// 📅 APPOINTMENT BUTTONS
// =============================================
async function sendAppointmentOptions(to) {
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
  }
}

// =============================================
// 💊 SERVICE LIST
// =============================================
async function sendServiceList(to) {
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
  }
}

// ======================================================
// 🔥 CANCEL BOOKING
// ======================================================
async function askForCancellationPhone(to) {
  await sendTextMessage(
    to,
    "📌 أرسل رقم الجوال المستخدم بالحجز لإلغاء الموعد.",
  );
}

async function processCancellation(to, phone) {
  try {
    const booking = await findLastBookingByPhone(phone);

    if (!booking) {
      await sendTextMessage(to, "❌ لا يوجد حجز مرتبط بهذا الرقم.");
      return;
    }

    await updateBookingStatus(booking.id, "Canceled");

    await sendTextMessage(
      to,
      `🟣 تم إلغاء الحجز:\n👤 ${booking.name}\n💊 ${booking.service}\n📅 ${booking.appointment}`,
    );
  } catch (err) {
    console.error("❌ Cancel error:", err.message);
    await sendTextMessage(to, "⚠️ حدث خطأ أثناء الإلغاء. حاول لاحقًا.");
  }
}

// =============================================
// 📤 EXPORTS
// =============================================
module.exports = {
  // AI
  askAI,
  validateNameWithAI,

  // WhatsApp
  sendTextMessage,
  sendAppointmentOptions,
  sendServiceList,

  // Supabase ONLY
  insertBookingToSupabase,

  // Cancellation
  askForCancellationPhone,
  processCancellation,
};
