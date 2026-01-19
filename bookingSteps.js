/**
 * bookingSteps.js (SMART UX VERSION)
 *
 * Goals:
 * - Smooth booking without frustration
 * - Fewer rejections
 * - Clear guidance at each step
 * - Allow questions without breaking the flow
 */

const {
  askAI,
  validateNameWithAI,
  sendTextMessage,
  sendServiceList,
  insertBookingToSupabase,
} = require("./helpers");

// ---------------------------------------------
// 🧠 Detect side questions (soft detection)
// ---------------------------------------------
function isSideQuestion(text = "") {
  const t = text.trim().toLowerCase();
  return (
    t.endsWith("?") || /(كم|ليش|هل|شو|متى|كيف|price|how|why|when|what)/i.test(t)
  );
}

// ---------------------------------------------
// ✍️ STEP 1 — NAME
// ---------------------------------------------
async function handleNameStep(text, from, tempBookings) {
  const name = text.trim();

  // Allow side questions
  if (isSideQuestion(text)) {
    await sendTextMessage(from, await askAI(text));
    await sendTextMessage(from, "نكمّل الحجز 😊 أرسل اسمك:");
    return;
  }

  // Very short names → reject gently
  if (name.length < 2) {
    await sendTextMessage(from, "🌸 اكتب اسمك الكامل لو سمحت:");
    return;
  }

  // AI validation (soft)
  const isValid = await validateNameWithAI(name);
  if (!isValid) {
    await sendTextMessage(
      from,
      "🙂 الاسم غير واضح. مثال: أحمد خالد، سارة محمد",
    );
    return;
  }

  tempBookings[from].name = name;
  await sendTextMessage(from, "📱 تمام! الآن أرسل رقم الجوال:");
}

// ---------------------------------------------
// 📞 STEP 2 — PHONE
// ---------------------------------------------
async function handlePhoneStep(text, from, tempBookings) {
  if (isSideQuestion(text)) {
    await sendTextMessage(from, await askAI(text));
    await sendTextMessage(from, "نكمّل الحجز 📱 أرسل رقم الجوال:");
    return;
  }

  const phone = normalizePhone(text);

  if (!/^07\d{8}$/.test(phone)) {
    await sendTextMessage(from, "⚠️ رقم الجوال غير صحيح.\nمثال: 07XXXXXXXX");
    return;
  }

  tempBookings[from].phone = phone;

  await sendTextMessage(from, "💊 اختر الخدمة من القائمة 👇");
  await sendServiceList(from);
}

// ---------------------------------------------
// 💊 STEP 3 — SERVICE
// ---------------------------------------------
async function handleServiceStep(text, from, tempBookings) {
  if (isSideQuestion(text)) {
    await sendTextMessage(from, await askAI(text));
    await sendTextMessage(from, "نكمّل الحجز 💊 اختر الخدمة:");
    return;
  }

  const service = detectService(text);

  if (!service) {
    await sendTextMessage(
      from,
      "❓ لم أفهم الخدمة المطلوبة.\nاختر من القائمة 👇",
    );
    await sendServiceList(from);
    return;
  }

  const booking = tempBookings[from];
  booking.service = service;

  // ✅ SAVE
  await insertBookingToSupabase(booking);

  await sendTextMessage(
    from,
    `✅ تم تأكيد حجزك بنجاح 🎉
👤 ${booking.name}
📱 ${booking.phone}
💊 ${booking.service}
📅 ${booking.appointment}`,
  );

  delete tempBookings[from];
}

// ---------------------------------------------
// 🔎 SERVICE DETECTION (SMART + SIMPLE)
// ---------------------------------------------
function detectService(text = "") {
  const normalized = text
    .replace(/[^\u0600-\u06FFa-zA-Z0-9\s]/g, "")
    .toLowerCase();

  const SERVICES = [
    { name: "تنظيف الأسنان", keys: ["تنظيف", "clean"] },
    { name: "تبييض الأسنان", keys: ["تبييض", "whitening"] },
    { name: "حشو الأسنان", keys: ["حشو", "حشوة", "filling"] },
    { name: "تقويم الأسنان", keys: ["تقويم", "braces"] },
    { name: "خلع الأسنان", keys: ["خلع", "extraction"] },
    { name: "زراعة الأسنان", keys: ["زراعة", "implant"] },
    { name: "ابتسامة هوليود", keys: ["ابتسامة", "هوليود", "smile"] },
  ];

  for (const service of SERVICES) {
    if (
      service.keys.some((k) => normalized.includes(k)) ||
      normalized.includes(service.name.replace(/\s/g, ""))
    ) {
      return service.name;
    }
  }

  return null;
}

// ---------------------------------------------
// 🔢 Normalize phone numbers (Arabic & English)
// ---------------------------------------------
function normalizePhone(text = "") {
  return text
    .replace(/[^\d٠-٩]/g, "")
    .replace(/٠/g, "0")
    .replace(/١/g, "1")
    .replace(/٢/g, "2")
    .replace(/٣/g, "3")
    .replace(/٤/g, "4")
    .replace(/٥/g, "5")
    .replace(/٦/g, "6")
    .replace(/٧/g, "7")
    .replace(/٨/g, "8")
    .replace(/٩/g, "9");
}

// ---------------------------------------------
module.exports = {
  isSideQuestion,
  handleNameStep,
  handlePhoneStep,
  handleServiceStep,
};
