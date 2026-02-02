/**
 * messageHandlers.js
 *
 * All message handling functions in one file - works directly with index.js
 */

// ==============================
// 🎯 INTENT DETECTION
// ==============================

function isLocationRequest(text) {
  return /(موقع|عنوان|وين|فين|مكان|location|address|where)/i.test(text);
}

function isOffersRequest(text) {
  return /(عرض|عروض|تخفيض|خصم|offer|promotion|discount|deal)/i.test(text);
}

function isOffersConfirmation(text) {
  return /(نعم|yes|أكيد|طبعا|sure|yeah|اوكي|ok)/i.test(text);
}

function isDoctorsRequest(text) {
  return /(طبيب|اطباء|أطباء|الاطباء|الأطباء|دكتور|دكاترة|doctor|doctors)/i.test(
    text,
  );
}

function isBookingRequest(text) {
  return /(حجز|موعد|احجز|book|appointment|reserve)/i.test(text);
}

function isCancelRequest(text) {
  return /(الغاء|إلغاء|الغي|كنسل|cancel)/i.test(text);
}

// ==============================
// 🌍 LANGUAGE & GREETING
// ==============================

function isEnglish(text) {
  return !/[\u0600-\u06FF]/.test(text);
}

function isGreeting(text) {
  const greetings = [
    /^(مرحبا|مرحباً|هلا|السلام عليكم|صباح الخير|مساء الخير|اهلا|أهلا)/i,
    /^(hi|hello|hey|good morning|good evening|greetings)/i,
  ];
  return greetings.some((pattern) => pattern.test(text.trim()));
}

function getGreeting(text, clinicName = "عيادة ابتسامة") {
  const lang = /[\u0600-\u06FF]/.test(text) ? "ar" : "en";

  if (lang === "ar") {
    return `👋 مرحباً بك في ${clinicName}!\n\nكيف يمكنني مساعدتك اليوم؟`;
  } else {
    return `👋 Hello! Welcome to ${clinicName}!\n\nHow can I help you today?`;
  }
}

// ==============================
// 🚫 CONTENT FILTER
// ==============================

function containsBanWords(text) {
  const BANNED_WORDS = [/(spam|abuse)/i];
  return BANNED_WORDS.some((pattern) => pattern.test(text));
}

async function sendBanWordsResponse(to, sendTextMessage) {
  await sendTextMessage(to, "⚠️ يرجى الحفاظ على الاحترام في المحادثة.");
}

// ==============================
// 📍 LOCATION
// ==============================

async function sendLocationMessages(to, sendTextMessage, clinicSettings) {
  const clinicName = clinicSettings?.clinic_name || "عيادة ابتسامة";
  const message = `📍 موقع ${clinicName}\n\nالعنوان: [أضف العنوان]\nالهاتف: [أضف الهاتف]`;
  await sendTextMessage(to, message);
}

// ==============================
// 🎁 OFFERS
// ==============================

async function sendOffersImages(to, sendImageMessage, sendTextMessage) {
  await sendTextMessage(to, "🎁 عروضنا الحالية:");
  // Add your offer images here
}

async function sendOffersValidity(to, sendTextMessage) {
  await sendTextMessage(to, "⏰ العروض سارية حتى نهاية الشهر");
}

// ==============================
// 👨‍⚕️ DOCTORS
// ==============================

async function sendDoctorsImages(
  to,
  sendImageMessage,
  sendTextMessage,
  doctorImages,
  doctorInfo,
) {
  await sendTextMessage(to, "👨‍⚕️ فريق الأطباء لدينا:");

  for (let i = 0; i < doctorInfo.length; i++) {
    const doctor = doctorInfo[i];
    const caption = `${doctor.name}\n${doctor.specialization}`;
    await sendImageMessage(to, doctorImages[i], caption);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

// ==============================
// 📸 IMAGE MESSAGE
// ==============================

async function sendImageMessage(to, imageUrl, caption) {
  // This function is already in index.js, just re-export for consistency
  console.log(`Sending image to ${to}`);
}

// ==============================
// 🎙️ AUDIO
// ==============================

async function transcribeAudio(audioData) {
  throw new Error("Audio transcription not implemented");
}

// ==============================
// 📤 EXPORTS
// ==============================

module.exports = {
  // Intent Detection
  isLocationRequest,
  isOffersRequest,
  isOffersConfirmation,
  isDoctorsRequest,
  isBookingRequest,
  isCancelRequest,
  // Language & Greeting
  isEnglish,
  isGreeting,
  getGreeting,
  // Content Filter
  containsBanWords,
  sendBanWordsResponse,
  // Media
  sendLocationMessages,
  sendOffersImages,
  sendDoctorsImages,
  sendImageMessage,
  sendOffersValidity,
  // Audio
  transcribeAudio,
};
