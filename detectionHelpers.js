/**
 * detectionHelpers.js (UPDATED WITH CANCEL DETECTION)
 */

const crypto = require("crypto");

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
function getGreeting(isEnglish = false) {
  const englishGreetings = [
    "👋 Hello! Welcome to *Ibtisama Clinic*! How can I assist you today?",
    "Hi there! 😊 How can I help you book an appointment or learn more about our services?",
    "Welcome to *Ibtisama Medical Clinic*! How can I support you today?",
    "Hey! 👋 Glad to see you at *Ibtisama Clinic*! What can I do for you today?",
    "✨ Hello and welcome to *Ibtisama Clinic*! Are you interested in our offers or booking a visit?",
    "Good day! 💚 How can I assist you with your dental or beauty needs today?",
    "😊 Hi! You've reached *Ibtisama Clinic*, your smile is our priority!",
    "👋 Hello there! Would you like to see our latest offers or book an appointment?",
    "Welcome! 🌸 How can I help you take care of your smile today?",
    "💬 Hi! How can I help you find the right service or offer at *Ibtisama Clinic*?",
  ];

  const arabicGreetings = [
    "👋 أهلاً وسهلاً في *عيادة ابتسامة الطبية*! كيف يمكنني مساعدتك اليوم؟",
    "مرحباً بك في عيادتنا 💚 هل ترغب بحجز موعد أو الاستفسار عن خدمة؟",
    "أهلاً بك 👋 يسعدنا تواصلك مع *عيادة ابتسامة*، كيف نقدر نخدمك اليوم؟",
    "🌸 حيّاك الله! وش أكثر خدمة حاب تستفسر عنها اليوم؟",
    "✨ أهلاً وسهلاً! هل ترغب بالتعرف على عروضنا أو حجز موعد؟",
    "💚 يسعدنا تواصلك مع *عيادة ابتسامة*! كيف ممكن نساعدك اليوم؟",
    "😊 مرحباً بك! تقدر تسأل عن أي خدمة أو عرض متوفر حالياً.",
    "👋 أهلين وسهلين فيك! وش الخدمة اللي حاب تعرف عنها أكثر؟",
    "🌷 يا مرحبا! كيف نقدر نساعدك اليوم في *عيادة ابتسامة*؟",
    "💬 أهلاً بك! هل ترغب بحجز موعد أو الاطلاع على عروضنا الحالية؟",
  ];

  const replies = isEnglish ? englishGreetings : arabicGreetings;
  return replies[getRandomIndex(replies.length)];
}

function isGreeting(text = "") {
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
// 🗺️ Location Detection Helper
// ---------------------------------------------
function isLocationRequest(text = "") {
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
    "place",
    "maps",
    "وينكم",
    "فينكم",
  ];
  return includesAny(keywords, text);
}

// ---------------------------------------------
// 🎁 Offers Detection Helper
// ---------------------------------------------
function isOffersRequest(text = "") {
  const keywords = [
    "عروض",
    "عرض",
    "خصم",
    "خصومات",
    "تخفيض",
    "باقات",
    "باكيج",
    "بكج",
    "عرض خاص",
    "عرض اليوم",
    "وش عروضكم",
    "فيه عروض",
    "ابي عرض",
    "عطوني العرض",
    "بكم",
    "كم السعر",
    "offer",
    "offers",
    "discount",
    "price",
    "deal",
  ];
  return includesAny(keywords, text);
}

function isOffersConfirmation(text = "") {
  if (!text) return false;
  const normalizedText = text
    .replace(/\u0640/g, "")
    .replace(/[^\u0600-\u06FFa-zA-Z0-9 ]/g, "")
    .trim()
    .toLowerCase();

  const patterns = [
    "ارسل",
    "رسل",
    "أرسل",
    "ابغى",
    "أبغى",
    "ابي",
    "أبي",
    "ايه",
    "إيه",
    "ايوه",
    "أيوه",
    "نعم",
    "ارسلي",
    "ابعث",
    "ارسلهم",
    "ارسله",
    "ارسل العرض",
    "yes",
    "yeah",
    "yup",
    "ok",
    "okay",
    "sure",
    "send",
    "send it",
    "send them",
    "show",
    "show me",
    "i want",
    "i need",
  ];

  return patterns.some((p) => normalizedText.includes(p));
}

// ---------------------------------------------
// 👨‍⚕️ Doctors
// ---------------------------------------------
function isDoctorsRequest(text = "") {
  const keywords = [
    "دكتور",
    "دكاترة",
    "طبيب",
    "أطباء",
    "doctor",
    "doctors",
    "dr",
  ];
  return includesAny(keywords, text);
}

// ---------------------------------------------
// 📅 Booking Detection
// ---------------------------------------------
function isBookingRequest(text = "") {
  const keywords = [
    "book",
    "booking",
    "appointment",
    "reserve",
    "حجز",
    "موعد",
    "احجز",
    "ابغى احجز",
  ];
  return includesAny(keywords, text);
}

// ---------------------------------------------
// ❗❗ NEW — CANCEL Booking Detection
// ---------------------------------------------
function isCancelRequest(text = "") {
  const keywords = [
    "cancel",
    "cancel booking",
    "cancel appointment",
    "الغاء",
    "إلغاء",
    "الغي",
    "ألغي",
    "ابغى الغي",
    "ابي الغي",
    "اريد الغاء",
    "الغاء الحجز",
    "بدي الغي",
    "ما بدي الموعد",
    "كنسل",
    "cancel my booking",
  ];
  return includesAny(keywords, text);
}

// ---------------------------------------------
// Language Detection
// ---------------------------------------------
function isEnglish(text = "") {
  const arabicPattern = /[\u0600-\u06FF]/;
  return !arabicPattern.test(text);
}

// ---------------------------------------------
module.exports = {
  isLocationRequest,
  isOffersRequest,
  isOffersConfirmation,
  isDoctorsRequest,
  isBookingRequest,
  isCancelRequest,
  isEnglish,
  isGreeting,
  getGreeting,
};
