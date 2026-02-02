/**
 * detectionHelpers.js - Compatible with index.js (ES Module version)
 */

import crypto from "crypto";

// In-memory clinic settings (matches index.js)
let clinicSettings = {
  clinic_name: "عيادة ابتسامة",
  booking_times: ["3 PM", "6 PM", "9 PM"],
};

// Allow updating settings from index.js
export function setClinicSettings(settings) {
  clinicSettings = settings;
}

// ---------------------------------------------
// 🔧 Helper Functions
// ---------------------------------------------
function includesAny(list, text) {
  const lower = String(text || "").toLowerCase();
  return list.some((word) => lower.includes(word));
}

function getRandomIndex(length) {
  const randomBuffer = crypto.randomBytes(2);
  const randomNumber = parseInt(randomBuffer.toString("hex"), 16);
  return randomNumber % length;
}

// ---------------------------------------------
// 👋 Greeting Detector and Random Response
// ---------------------------------------------
export function getGreeting(isEnglish = false) {
  const clinicName = clinicSettings?.clinic_name || "عيادة ابتسامة";

  const englishGreetings = [
    `👋 Hello! Welcome to *${clinicName}*! How can I assist you today?`,
    `Hi there! 😊 How can I help you book an appointment or learn more about our services?`,
    `Welcome to *${clinicName}*! How can I support you today?`,
    `Hey! 👋 Glad to see you at *${clinicName}*! What can I do for you today?`,
    `✨ Hello and welcome to *${clinicName}*! Are you interested in our offers or booking a visit?`,
    `Good day! 💚 How can I assist you with your dental needs today?`,
    `😊 Hi! You've reached *${clinicName}*, your smile is our priority!`,
    `👋 Hello there! Would you like to see our latest offers or book an appointment?`,
    `Welcome! 🌸 How can I help you take care of your smile today?`,
    `💬 Hi! How can I help you find the right service or offer at *${clinicName}*?`,
  ];

  const arabicGreetings = [
    `👋 أهلاً وسهلاً في *${clinicName}*! كيف يمكنني مساعدتك اليوم؟`,
    `مرحباً بك في عيادتنا 💚 هل ترغب بحجز موعد أو الاستفسار عن خدمة؟`,
    `أهلاً بك 👋 يسعدنا تواصلك مع *${clinicName}*، كيف نقدر نخدمك اليوم؟`,
    `🌸 حيّاك الله! وش أكثر خدمة حاب تستفسر عنها اليوم؟`,
    `✨ أهلاً وسهلاً! هل ترغب بالتعرف على عروضنا أو حجز موعد؟`,
    `💚 يسعدنا تواصلك مع *${clinicName}*! كيف ممكن نساعدك اليوم؟`,
    `😊 مرحباً بك! تقدر تسأل عن أي خدمة أو عرض متوفر حالياً.`,
    `👋 أهلين وسهلين فيك! وش الخدمة اللي حاب تعرف عنها أكثر؟`,
    `🌷 يا مرحبا! كيف نقدر نساعدك اليوم في *${clinicName}*؟`,
    `💬 أهلاً بك! هل ترغب بحجز موعد أو الاطلاع على عروضنا الحالية؟`,
  ];

  const replies = isEnglish ? englishGreetings : arabicGreetings;
  return replies[getRandomIndex(replies.length)];
}

export function isGreeting(text = "") {
  const greetingsKeywords = [
    "hi",
    "hello",
    "hey",
    "morning",
    "evening",
    "good",
    "welcome",
    "هلا",
    "مرحبا",
    "السلام",
    "اهلا",
    "أهلاً",
    "اهلين",
    "هاي",
    "شلونك",
    "صباح",
    "مساء",
  ];
  return includesAny(greetingsKeywords, text);
}

// ---------------------------------------------
// 🗺️ Location Detection
// ---------------------------------------------
export function isLocationRequest(text = "") {
  const keywords = [
    "موقع",
    "مكان",
    "عنوان",
    "وين",
    "فين",
    "أين",
    "location",
    "where",
    "address",
    "maps",
    "وينكم",
    "فينكم",
  ];
  return includesAny(keywords, text);
}

// ---------------------------------------------
// 🎁 Offers Detection
// ---------------------------------------------
export function isOffersRequest(text = "") {
  const keywords = [
    "عروض",
    "عرض",
    "خصم",
    "خصومات",
    "تخفيض",
    "باقات",
    "باكيج",
    "بكج",
    "offer",
    "offers",
    "discount",
    "deal",
  ];
  return includesAny(keywords, text);
}

export function isOffersConfirmation(text = "") {
  const normalizedText = String(text || "")
    .replace(/\u0640/g, "")
    .replace(/[^\u0600-\u06FFa-zA-Z0-9 ]/g, "")
    .toLowerCase();

  const patterns = [
    "ارسل",
    "رسل",
    "ابي",
    "ابغى",
    "نعم",
    "ايه",
    "ايوه",
    "yes",
    "ok",
    "send",
    "show",
  ];
  return patterns.some((p) => normalizedText.includes(p));
}

// ---------------------------------------------
// 👨‍⚕️ Doctors Detection
// ---------------------------------------------
export function isDoctorsRequest(text = "") {
  const keywords = [
    "الأطباء",
    "اطباء",
    "أطباء",
    "الدكاترة",
    "دكاترة",
    "دكتور",
    "طبيب",
    "طاقم طبي",
    "فريق طبي",
    "doctor",
    "doctors",
    "dr",
  ];
  return includesAny(keywords, text);
}

// ---------------------------------------------
// 📅 Booking Detection
// ---------------------------------------------
export function isBookingRequest(text = "") {
  const keywords = [
    "حجز",
    "احجز",
    "موعد",
    "ابي احجز",
    "ابغى احجز",
    "book",
    "booking",
    "appointment",
    "reserve",
  ];
  return includesAny(keywords, text);
}

// ---------------------------------------------
// ❌ Cancel Booking Detection
// ---------------------------------------------
export function isCancelRequest(text = "") {
  const keywords = [
    "الغاء",
    "إلغاء",
    "الغي",
    "كنسل",
    "cancel",
    "cancel booking",
    "cancel appointment",
    "ابغى الغي",
    "ابي الغي",
  ];
  return includesAny(keywords, text);
}

// ---------------------------------------------
// 🔄 Reset Detection
// ---------------------------------------------
export function isResetRequest(text = "") {
  const keywords = [
    "reset",
    "start",
    "restart",
    "begin",
    "عيد من اول",
    "ابدا من جديد",
    "ابدأ من جديد",
    "من البداية",
    "بداية جديدة",
  ];
  return includesAny(keywords, text);
}

// ---------------------------------------------
// 🌐 Language Detection
// ---------------------------------------------
export function isEnglish(text = "") {
  const arabicPattern = /[\u0600-\u06FF]/;
  return !arabicPattern.test(text);
}

export function detectLanguage(text = "") {
  return /[\u0600-\u06FF]/.test(text) ? "ar" : "en";
}
