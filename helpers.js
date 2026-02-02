/**
 * helpers.js - Compatible with index.js (ES Module version)
 * Simplified to work with in-memory storage (no Supabase)
 */

import axios from "axios";

// =============================================
// 🌍 ENVIRONMENT VARIABLES
// =============================================
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

// =============================================
// 💬 SEND WHATSAPP TEXT MESSAGE
// =============================================
export async function sendTextMessage(to, text) {
  try {
    console.log(`📤 Sending WhatsApp: ${to}`, text);

    await axios.post(
      `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
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
// 📸 SEND IMAGE MESSAGE
// =============================================
export async function sendImageMessage(to, imageUrl, caption = "") {
  try {
    const payload = {
      messaging_product: "whatsapp",
      to,
      type: "image",
      image: {
        link: imageUrl,
      },
    };

    if (caption) {
      payload.image.caption = caption;
    }

    await axios.post(
      `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (err) {
    console.error("❌ Image send error:", err.response?.data || err.message);
  }
}

// =============================================
// 📅 APPOINTMENT BUTTONS
// =============================================
export async function sendAppointmentOptions(to, clinicSettings) {
  try {
    // ✅ Get dynamic booking times or use defaults
    const bookingTimes = clinicSettings?.booking_times || [
      "3 PM",
      "6 PM",
      "9 PM",
    ];

    // ✅ Build buttons dynamically from settings
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
export async function sendServiceList(to) {
  try {
    await axios.post(
      `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
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
// 👨‍⚕️ SEND DOCTOR INFO
// =============================================
export async function sendDoctorInfo(to, doctorImages, doctorInfo) {
  await sendTextMessage(to, "👨‍⚕️ فريق الأطباء لدينا:");

  for (let i = 0; i < doctorInfo.length; i++) {
    const doctor = doctorInfo[i];
    const caption = `${doctor.name}\n${doctor.specialization}`;
    await sendImageMessage(to, doctorImages[i], caption);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

// ======================================================
// 🔥 CANCEL BOOKING HELPERS
// ======================================================
export async function askForCancellationPhone(to) {
  await sendTextMessage(
    to,
    "📌 أرسل رقم الجوال المستخدم في الحجز لإلغاء الموعد.",
  );
}

export async function processCancellation(
  to,
  phone,
  findBookingByPhone,
  cancelBooking,
) {
  try {
    const booking = await findBookingByPhone(phone);

    if (!booking) {
      await sendTextMessage(to, "❌ لا يوجد حجز مرتبط بهذا الرقم.");
      return;
    }

    await cancelBooking(booking.id);

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
// 🎯 INTENT DETECTION HELPERS
// =============================================
export function isBookingRequest(text) {
  return /(حجز|موعد|احجز|book|appointment|reserve)/i.test(text);
}

export function isCancelRequest(text) {
  return /(الغاء|إلغاء|الغي|كنسل|cancel)/i.test(text);
}

export function isDoctorRequest(text) {
  return /(طبيب|اطباء|أطباء|الاطباء|الأطباء|دكتور|دكاترة|doctor|doctors)/i.test(
    text,
  );
}

export function isResetRequest(text) {
  return /(reset|start|عيد من اول|ابدا من جديد|ابدأ من جديد|من البداية|بداية جديدة|restart|new chat|ابدا|ابدأ|عيد)/i.test(
    text,
  );
}

export function detectLanguage(text) {
  return /[\u0600-\u06FF]/.test(text) ? "ar" : "en";
}
