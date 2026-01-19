/**
 * helpers.js (FINAL – FULL VERSION, Supabase ONLY)
 */

const axios = require("axios");
const { askAI, validateNameWithAI } = require("./aiHelper");

// =============================================
// 🗄 SUPABASE — BOOKING + CANCEL
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
    console.log("📤 WhatsApp →", to, text);

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
// 📅 APPOINTMENT OPTIONS
// =============================================
async function sendAppointmentOptions(to) {
  try {
    await axios.post(
      `https://graph.facebook.com/v17.0/${PHONE_NUMBER_ID}/messages`,
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

// =============================================
// ❌ CANCEL BOOKING FLOW
// =============================================
async function askForCancellationPhone(to) {
  await sendTextMessage(
    to,
    "❌ لإلغاء الحجز، أرسل رقم الجوال المستخدم في الحجز:",
  );
}

async function processCancellation(to, phone) {
  try {
    const booking = await findLastBookingByPhone(phone);

    if (!booking) {
      await sendTextMessage(to, "❌ لا يوجد حجز مرتبط بهذا الرقم.");
      return;
    }

    if (booking.status === "cancelled") {
      await sendTextMessage(to, "ℹ️ هذا الحجز ملغي مسبقًا.");
      return;
    }

    const updated = await updateBookingStatus(booking.id, "cancelled");

    if (!updated) {
      await sendTextMessage(to, "⚠️ فشل إلغاء الحجز. حاول لاحقًا.");
      return;
    }

    await sendTextMessage(
      to,
      `✅ تم إلغاء الحجز بنجاح:\n\n👤 الاسم: ${booking.name}\n💊 الخدمة: ${booking.service}\n📅 الموعد: ${booking.appointment}`,
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

  // Supabase
  insertBookingToSupabase,

  // Cancellation
  askForCancellationPhone,
  processCancellation,
};
