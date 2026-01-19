/**
 * helpers.js (FINAL — Supabase ONLY, No Google Sheets)
 */

const axios = require("axios");
const { askAI, validateNameWithAI } = require("./aiHelper");

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
async function sendAppointmentOptions(to, day) {
  const title = day ? `⏰ اختر الوقت ليوم ${day}:` : "⏰ اختر الوقت:";

  // IMPORTANT: keep your current payload style.
  // Example using buttons:
  const buttons = [
    { type: "reply", reply: { id: "slot_3 PM", title: "3 PM" } },
    { type: "reply", reply: { id: "slot_6 PM", title: "6 PM" } },
    { type: "reply", reply: { id: "slot_9 PM", title: "9 PM" } },
  ];

  return sendTextMessage(to, title, {
    interactive: {
      type: "button",
      body: { text: title },
      action: { buttons },
    },
  });
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

async function sendDayOptions(to) {
  const now = new Date();

  const days = Array.from({ length: 5 }).map((_, i) => {
    const d = new Date(now);
    d.setDate(now.getDate() + i);

    const iso = d.toISOString().slice(0, 10); // YYYY-MM-DD
    const weekdayAr = d.toLocaleDateString("ar", { weekday: "long" });

    const label =
      i === 0
        ? `اليوم (${iso})`
        : i === 1
          ? `بكرا (${iso})`
          : `${weekdayAr} (${iso})`;

    return {
      type: "reply",
      reply: { id: `day_${iso}`, title: label },
    };
  });

  // If your sendTextMessage supports interactive buttons payload:
  return sendTextMessage(to, "📅 اختر اليوم المناسب:", {
    interactive: {
      type: "button",
      body: { text: "اختر اليوم المناسب:" },
      action: { buttons: days },
    },
  });
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

  sendDayOptions,
  sendAppointmentOptions,
};
