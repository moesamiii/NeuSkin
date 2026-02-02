// clinicBotReplies.js

const { createClient } = require("@supabase/supabase-js");
const crypto = require("crypto");

// 🔹 Supabase client (SERVER SIDE)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY, // ⚠️ SERVICE ROLE KEY
);

// 🔹 Normalize text
function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[!?.،]/g, "")
    .trim();
}

// 🔹 Keywords
const keywords = {
  greeting: ["مرحبا", "اهلا", "السلام", "hi", "hello", "hey"],
  schedule: ["مواعيد", "اوقات", "دوام", "opening", "hours", "schedule"],
  price: ["سعر", "الفلوس", "كشف", "تكلفة", "price", "cost", "fees"],
  location: ["موقع", "وين", "address", "location", "map", "place"],
  thanks: ["شكرا", "thx", "thanks", "thank you", "مشكور"],
  booking: ["حجز", "موعد", "booking", "appointment", "reserve"],
  doctor: ["دكتور", "طبيب", "doctor", "dentist", "dermatologist"],
  offers: ["خصم", "عرض", "offer", "discount", "promo"],
};

// 🔹 FAQs (static – later يمكن نقلها للـ DB)
const faqs = [
  {
    q: ["هل يوجد تنظيف اسنان", "teeth cleaning", "teeth polish"],
    a: "🦷 نعم، نقدم خدمة تنظيف وتلميع الأسنان بأحدث الأجهزة.",
  },
  {
    q: ["هل تقبلون تأمين", "insurance"],
    a: "💳 نعم، نقبل أغلب شركات التأمين الطبي.",
  },
];

// 🔹 Random picker
function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

// 🔹 MAIN FUNCTION
async function getReply(text) {
  const lower = normalize(text);
  const isEnglish = /[a-z]/i.test(text);

  // 🔹 Load clinic settings
  const { data: settings, error } = await supabase
    .from("clinic_settings")
    .select("*")
    .eq("clinic_id", "default")
    .single();

  if (error || !settings) {
    console.error("❌ Clinic settings not found", error);
    return isEnglish
      ? "Sorry, clinic information is not available right now."
      : "عذراً، بيانات العيادة غير متوفرة حالياً.";
  }

  // ---------- STEP 1: SCORING ----------
  const scores = {
    greeting: keywords.greeting.filter((w) => lower.includes(w)).length,
    schedule: keywords.schedule.filter((w) => lower.includes(w)).length,
    price: keywords.price.filter((w) => lower.includes(w)).length,
    location: keywords.location.filter((w) => lower.includes(w)).length,
    thanks: keywords.thanks.filter((w) => lower.includes(w)).length,
    booking: keywords.booking.filter((w) => lower.includes(w)).length,
    doctor: keywords.doctor.filter((w) => lower.includes(w)).length,
    offers: keywords.offers.filter((w) => lower.includes(w)).length,
  };

  // ---------- STEP 2: Pick intent ----------
  let topIntent = null;
  let maxScore = 0;
  for (const [key, value] of Object.entries(scores)) {
    if (value > maxScore) {
      maxScore = value;
      topIntent = key;
    }
  }

  // ---------- STEP 3: Resolve conflicts ----------
  if (scores.doctor > 0 && scores.offers > 0) {
    topIntent = "offers";
  }

  // ---------- STEP 4: RESPONSES ----------
  switch (topIntent) {
    case "greeting": {
      const greetingsEn = [
        `👋 Hello! Welcome to *${settings.clinic_name}*!`,
        `Hi 😊 You’ve reached *${settings.clinic_name}*. How can I help?`,
      ];
      const greetingsAr = [
        `👋 أهلاً وسهلاً في *${settings.clinic_name}*!`,
        `مرحباً بك في *${settings.clinic_name}* 💚 كيف نساعدك؟`,
      ];
      return isEnglish ? pickRandom(greetingsEn) : pickRandom(greetingsAr);
    }

    case "schedule":
      return isEnglish
        ? `🕒 ${settings.working_hours_en}`
        : `🕒 ${settings.working_hours_ar}`;

    case "price":
      return isEnglish ? `💰 ${settings.price_en}` : `💰 ${settings.price_ar}`;

    case "location":
      return isEnglish
        ? `📍 ${settings.location_en}`
        : `📍 ${settings.location_ar}`;

    case "booking":
      return isEnglish
        ? `📅 Please choose a time: ${settings.booking_times.join(", ")}`
        : `📅 اختر الوقت المناسب: ${settings.booking_times.join("، ")}`;

    case "doctor":
      return isEnglish
        ? "👨‍⚕️ We have qualified specialists in dentistry and cosmetic treatments."
        : "👨‍⚕️ لدينا أطباء مختصون في الأسنان والعلاجات التجميلية.";

    case "offers":
      if (!settings.offers_enabled) {
        return isEnglish
          ? "Currently there are no offers."
          : "لا توجد عروض حالياً.";
      }
      return isEnglish ? settings.offers_en : settings.offers_ar;

    case "thanks":
      return isEnglish
        ? pickRandom(["You're welcome 😊", "Happy to help 💚"])
        : pickRandom(["على الرحب والسعة 💚", "يسعدنا خدمتك 😊"]);

    default:
      for (const faq of faqs) {
        if (faq.q.some((w) => lower.includes(w))) {
          return faq.a;
        }
      }

      return isEnglish
        ? "🤖 You can ask about appointments, prices, location, or offers."
        : "🤖 يمكنك السؤال عن المواعيد، الأسعار، الموقع، أو العروض.";
  }
}

module.exports = getReply;
