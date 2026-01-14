/**
 * bookingSteps.js (FINAL — Supabase ONLY)
 *
 * Responsibilities:
 * - Handle booking steps (name, phone, service)
 * - Validate each step
 * - Allow side questions (AI answer, then return to flow)
 * - Detect service using fuzzy + AI fallback
 */

const {
  askAI,
  validateNameWithAI,
  sendTextMessage,
  sendServiceList,
  insertBookingToSupabase, // ✔ Supabase ONLY
} = require("./helpers");

/**
 * Detect if message is a side question during booking
 */
function isSideQuestion(text = "") {
  if (!text) return false;
  const t = text.trim().toLowerCase();

  return (
    t.endsWith("?") ||
    t.includes("كم") ||
    t.includes("price") ||
    t.includes("how") ||
    t.includes("مدة") ||
    t.includes("ليش") ||
    t.includes("why") ||
    t.startsWith("هل ") ||
    t.startsWith("شو ") ||
    t.startsWith("what ")
  );
}

/**
 * ------------------------------
 * STEP 1 — Handle name input
 * ------------------------------
 */
async function handleNameStep(text, from, tempBookings) {
  if (isSideQuestion(text)) {
    const answer = await askAI(text);
    await sendTextMessage(from, answer);
    await sendTextMessage(from, "نكمّل الحجز؟ أرسل اسمك 😊");
    return;
  }

  const userName = text.trim();
  const isValid = await validateNameWithAI(userName);

  if (!isValid) {
    await sendTextMessage(
      from,
      "⚠️ الرجاء إدخال اسم حقيقي مثل: أحمد، محمد علي، سارة..."
    );
    return;
  }

  tempBookings[from].name = userName;

  await sendTextMessage(from, "📱 ممتاز! الآن أرسل رقم جوالك:");
}

/**
 * ------------------------------
 * STEP 2 — Handle phone input
 * ------------------------------
 */
async function handlePhoneStep(text, from, tempBookings) {
  if (isSideQuestion(text)) {
    const answer = await askAI(text);
    await sendTextMessage(from, answer);
    await sendTextMessage(from, "تمام! الآن أرسل رقم جوالك:");
    return;
  }

  const normalized = text
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

  const isValid = /^07\d{8}$/.test(normalized);

  if (!isValid) {
    await sendTextMessage(
      from,
      "⚠️ الرجاء إدخال رقم أردني صحيح مثل: 07XXXXXXXX"
    );
    return;
  }

  tempBookings[from].phone = normalized;

  await sendServiceList(from);
  await sendTextMessage(
    from,
    "💊 يرجى اختيار الخدمة من القائمة المنسدلة أعلاه:"
  );
}

/**
 * ------------------------------
 * STEP 3 — Handle service selection
 * ------------------------------
 */
async function handleServiceStep(text, from, tempBookings) {
  if (isSideQuestion(text)) {
    const answer = await askAI(text);
    await sendTextMessage(from, answer);
    await sendTextMessage(from, "نرجع للحجز… ما هي الخدمة المطلوبة؟");
    return;
  }

  const booking = tempBookings[from];
  const userService = text.trim();

  const SERVICE_KEYWORDS = {
    "تنظيف الأسنان": ["تنظيف", "clean", "كلين", "كلينينج", "تنضيف"],
    "تبييض الأسنان": ["تبييض", "تبيض", "whitening"],
    "حشو الأسنان": ["حشو", "حشوة", "fill", "filling"],
    "زراعة الأسنان": ["زراعة", "implant", "زرع"],
    "ابتسامة هوليود": ["ابتسامة", "هوليود", "smile"],
    "تقويم الأسنان": ["تقويم", "braces"],
    "خلع الأسنان": ["خلع", "extraction"],
    "جلسة ليزر بشرة": ["ليزر", "جلسة", "بشرة", "laser"],
    فيلر: ["فيلر", "filler"],
    بوتوكس: ["بوتوكس", "botox"],
  };

  const FORBIDDEN_WORDS = [
    "أنف",
    "بطن",
    "ظهر",
    "رجل",
    "يد",
    "عين",
    "أذن",
    "وجه",
    "شعر",
    "رقبة",
    "تصفير",
    "تحمير",
    "تزريق",
    "تخصير",
    "تسويد",
  ];

  const normalized = userService
    .replace(/[^\u0600-\u06FFa-zA-Z0-9\s]/g, "")
    .toLowerCase();

  if (FORBIDDEN_WORDS.some((w) => normalized.includes(w))) {
    await sendTextMessage(
      from,
      "⚠️ الخدمة غير مرتبطة بالأسنان أو البشرة. اختر خدمة صحيحة."
    );
    await sendServiceList(from);
    return;
  }

  // Fuzzy match
  let matchedService = null;

  for (const [service, words] of Object.entries(SERVICE_KEYWORDS)) {
    if (
      words.some((kw) => normalized.includes(kw.toLowerCase())) ||
      normalized.includes(service.replace(/\s/g, ""))
    ) {
      matchedService = service;
      break;
    }
  }

  // AI fallback
  if (!matchedService) {
    try {
      const aiCheck = await askAI(
        `هل "${userService}" خدمة تتعلق بطب الأسنان أو البشرة؟ أجب بـ نعم أو لا فقط`
      );
      if (aiCheck.toLowerCase().includes("نعم")) {
        await sendTextMessage(from, "💬 وضّح أكثر نوع الخدمة؟");
        return;
      }
    } catch {}
  }

  if (!matchedService) {
    await sendTextMessage(
      from,
      `⚠️ لا يمكن تحديد "${userService}".\nاختر من القائمة.`
    );
    await sendServiceList(from);
    return;
  }

  // ============================================
  // ✔ SERVICE MATCHED → SAVE TO SUPABASE ONLY
  // ============================================
  booking.service = matchedService;

  await insertBookingToSupabase(booking);

  await sendTextMessage(
    from,
    `✅ تم حفظ حجزك بنجاح:\n👤 ${booking.name}\n📱 ${booking.phone}\n💊 ${booking.service}\n📅 ${booking.appointment}`
  );

  delete tempBookings[from];
}

module.exports = {
  isSideQuestion,
  handleNameStep,
  handlePhoneStep,
  handleServiceStep,
};
