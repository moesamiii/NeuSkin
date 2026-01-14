// clinicBotReplies.js

function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[!?.،]/g, "")
    .trim();
}

// 🔹 كلمات مفتاحية رئيسية
const keywords = {
  greeting: ["مرحبا", "اهلا", "السلام", "hi", "hello", "hey"],
  schedule: [
    "مواعيد",
    "اوقات",
    "دوام",
    "opening",
    "hours",
    "schedule",
    "work time",
  ],
  price: ["سعر", "الفلوس", "كشف", "تكلفة", "price", "cost", "fees"],
  location: ["موقع", "وين", "address", "location", "map", "place"],
  thanks: ["شكرا", "thx", "thanks", "thank you", "مشكور"],
  booking: ["حجز", "موعد", "booking", "appointment", "reserve"],
  doctor: ["دكتور", "طبيب", "doctor", "dentist", "dermatologist"],
  offers: ["خصم", "عرض", "offer", "discount", "promo"],
};

// 🔹 أسئلة متكرّرة
const faqs = [
  {
    q: ["هل يوجد تنظيف اسنان", "teeth cleaning", "teeth polish"],
    a: "🦷 نعم، نقدم خدمة تنظيف وتلميع الأسنان بأحدث الأجهزة وبإشراف أطباء مختصين.",
  },
  {
    q: ["هل يوجد طبيبة نساء", "gynecologist", "lady doctor"],
    a: "👩‍⚕️ نعم، لدينا طبيبة نساء وولادة متخصصة، ويمكن حجز موعد بسهولة عبر الواتساب.",
  },
  {
    q: ["هل عندكم خصم", "offers", "discount", "promotion"],
    a: "🎉 نعم! لدينا عروض موسمية مميزة على الكشف والعلاجات، تواصل معنا لمعرفة التفاصيل الحالية.",
  },
  {
    q: ["مين الاطباء", "who is the doctor", "specialist"],
    a: "👨‍⚕️ لدينا نخبة من الأطباء في تخصصات الجلدية، الأسنان، والتجميل. أخبرني ما التخصص الذي تبحث عنه؟",
  },
  {
    q: ["هل تقبلون تأمين", "insurance"],
    a: "💳 نعم، نقبل أغلب شركات التأمين الطبي. يمكنك إرسال اسم شركتك لنتأكد منها.",
  },
];

// 🔹 ردود عشوائية لإضفاء طبيعية
function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

// 🔹 الرد الذكي (نسخة محسّنة لمنع الخلط بين العروض والأطباء)
function getReply(text) {
  const lower = normalize(text);
  const isEnglish = /[a-z]/i.test(text);

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

  // ---------- STEP 2: Pick the strongest intent ----------
  let topIntent = null;
  let maxScore = 0;
  for (const [key, value] of Object.entries(scores)) {
    if (value > maxScore) {
      maxScore = value;
      topIntent = key;
    }
  }

  // ---------- STEP 3: Resolve conflicts ----------
  // If both doctor & offers are present, prefer "offers"
  if (scores.doctor > 0 && scores.offers > 0) {
    topIntent = "offers";
  }

  // ---------- STEP 4: Respond based on final intent ----------
  switch (topIntent) {
    case "greeting": {
      const crypto = require("crypto");
      const randomIndex = (max) =>
        parseInt(crypto.randomBytes(2).toString("hex"), 16) % max;
      const englishGreetings = [
        "👋 Hello! Welcome to *Ibtisama Clinic*! How can I assist you today?",
        "Hi there! 😊 How can I help you book an appointment or learn more about our services?",
        "Welcome to Ibtisama Medical Clinic! How can I support you today?",
        "Hey! 👋 Glad to see you at *Ibtisama Clinic*! What can I do for you today?",
        "✨ Hello and welcome to *Ibtisama Clinic*! Are you interested in our offers or booking a visit?",
        "Good day! 💚 How can I assist you with your dental or beauty needs today?",
        "😊 Hi! You’ve reached *Ibtisama Clinic*, your smile is our priority!",
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
      const listToPickFrom = isEnglish ? englishGreetings : arabicGreetings;
      return listToPickFrom[randomIndex(listToPickFrom.length)];
    }

    case "schedule":
      return isEnglish
        ? "🕒 Our clinic hours are from *9 AM to 9 PM*, Saturday to Thursday. We’re closed on Fridays."
        : "🕒 مواعيد العمل: يومياً من *9 صباحاً إلى 9 مساءً* (الجمعة مغلق).";

    case "price":
      return isEnglish
        ? "💰 The consultation fee is *150 SAR*, including full check-up and medical advice."
        : "💰 تكلفة الكشف هي *150 ريال* وتشمل الاستشارة والفحص الكامل.";

    case "location":
      return isEnglish
        ? "📍 Our clinic is located in *Amman – Abdoun, behind Housing Bank, 1st Floor*.\nGoogle Maps: https://maps.google.com"
        : "📍 موقع العيادة: *عمّان – عبدون، خلف بنك الإسكان، الطابق الأول*.\nGoogle Maps: https://maps.google.com";

    case "thanks":
      return isEnglish
        ? pickRandom([
            "You're most welcome! 😊",
            "Happy to help! 💚",
            "Glad to assist — have a great day!",
          ])
        : pickRandom([
            "🙏 العفو! نتمنى لك يوماً جميلاً وصحة دائمة 💚",
            "🌿 على الرحب والسعة! نحن هنا دائماً لخدمتك.",
            "😊 شكراً لتواصلك معنا، ونتمنى لك يوماً طيباً.",
          ]);

    case "booking":
      return isEnglish
        ? "📅 Great! Let's book your appointment. Please tell me your preferred time (e.g., 3 PM, 6 PM, or 9 PM)."
        : "📅 رائع! لنبدأ بالحجز، من فضلك اختر الوقت الذي يناسبك (مثلاً: 3 مساءً، 6 مساءً، أو 9 مساءً).";

    case "doctor":
      return isEnglish
        ? "👨‍⚕️ We have a team of specialists in dermatology, dentistry, and cosmetic treatments. Which type of doctor are you looking for?"
        : "👨‍⚕️ لدينا أطباء مختصون في الجلدية، الأسنان، والعلاجات التجميلية. أي تخصص ترغب بمعرفته؟";

    case "offers":
      return isEnglish
        ? "🎉 Yes! We currently have special offers on first-time consultations and cosmetic treatments!"
        : "🎉 نعم، لدينا عروض مميزة حالياً على الكشف الأول والعلاجات التجميلية!";

    default:
      // ✅ البحث في الأسئلة المتكررة
      for (const faq of faqs) {
        if (faq.q.some((w) => lower.includes(w))) {
          return faq.a;
        }
      }

      // ✅ الرد الافتراضي
      return isEnglish
        ? `🤖 I received your message: “${text}”\n\nYou can ask me about *appointments 🕒, prices 💰, location 📍,* or *booking 📅*.`
        : `🤖 استلمت رسالتك: “${text}”\n\nيمكنك سؤالي عن: *المواعيد 🕒، الأسعار 💰، الموقع 📍، أو الحجز 📅*.`;
  }
}

module.exports = getReply;
