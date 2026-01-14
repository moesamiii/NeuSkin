/**
 * contentFilter.js
 *
 * Purpose:
 * - Detect inappropriate content (ban words in English and Arabic)
 * - Normalize Arabic text to handle WhatsApp invisible characters
 * - Send appropriate response when ban words are detected
 *
 * This keeps content moderation logic separate and maintainable
 */

const { sendTextMessage } = require("./helpers");

// ---------------------------------------------
// 🚫 Ban Words List (English + Arabic)
// ---------------------------------------------
const BAN_WORDS = {
  english: [
    "fuck",
    "fck",
    "fuk",
    "shit",
    "sht",
    "bitch",
    "btch",
    "ass",
    "dick",
    "cock",
    "pussy",
    "cunt",
    "whore",
    "slut",
    "bastard",
    "damn",
    "hell",
    "sex",
    "porn",
    "nude",
    "naked",
    "boobs",
    "breast",
    "penis",
    "vagina",
    "anal",
    "orgasm",
    "masturbate",
    "rape",
    "molest",
    "abuse",
    "sexual",
    "erotic",
    "xxx",
    "nsfw",
    "horny",
    "sexy",
    "hentai",
    "cumming",
    "nigger",
    "nigga",
    "negro",
    "coon",
    "kike",
    "spic",
    "chink",
    "gook",
    "wetback",
    "towelhead",
    "raghead",
    "camel jockey",
    "beaner",
    "paki",
    "curry",
    "cracker",
    "whitey",
    "honky",
    "redskin",
    "savage",
    "colored",
    "oriental",
    "muzzie",
    "terrorist",
    "terrorism",
    "jihad",
    "isis",
    "bomb",
    "explosion",
    "murder",
    "suicide bomber",
    "attack",
    "massacre",
    "extremist",
    "radical",
    "militant",
    "weapon",
    "shoot",
    "knife",
    "stab",
    "violence",
    "threat",
    "hostage",
    "kidnap",
    "al qaeda",
    "alqaeda",
    "taliban",
    "execute",
    "behead",
  ],
  arabic: [
    "كس",
    "عرص",
    "شرموط",
    "قحبة",
    "خول",
    "زب",
    "طيز",
    "نيك",
    "متناك",
    "لعنة",
    "جنس",
    "سكس",
    "عاهرة",
    "زانية",
    "حقير",
    "وسخ",
    "قذر",
    "منيوك",
    "ابن كلب",
    "ابن حرام",
    "كلب",
    "حمار",
    "يا حيوان",
    "يا كلب",
    "خرا",
    "تفو",
    "يخرب بيتك",
    "وقح",
    "قليل ادب",
    "سافل",
    "منيك",
    "كسمك",
    "عرصة",
    "شرموطة",
    "زبي",
    "متناكة",
    "يلعن",
    "كسختك",
    "امشم",
    "مشم",
    "امك",
    "أمك",
    "ابوك",
    "أبوك",
    "اختك",
    "أختك",
    "مرتك",
    "زوجتك",
    "ولاياك",
    "عمتك",
    "خالتك",
    "زنجي",
    "يهودي نجس",
    "صهيوني",
    "كافر نجس",
    "نصراني قذر",
    "رافضي",
    "مجوسي",
    "وثني",
    "ملحد قذر",
    "عنصري",
    "دونية",
    "عرق حقير",
    "سلالة حقيرة",
    "إرهاب",
    "إرهابي",
    "داعش",
    "القاعدة",
    "قنبلة",
    "انفجار",
    "اقتل",
    "ذبح",
    "سلاح",
    "مسدس",
    "رصاص",
    "سكين",
    "طعن",
    "تفجير",
    "انتحاري",
    "هجوم",
    "مذبحة",
    "متطرف",
    "راديكالي",
    "مسلح",
    "عنف",
    "تهديد",
    "رهينة",
    "اختطاف",
    "خطف",
    "تدمير",
    "اعدام",
    "طالبان",
    "فجر",
  ],
};

// ---------------------------------------------
// 🔧 Arabic Normalizer (fix WhatsApp invisible chars)
// ---------------------------------------------
function normalizeArabic(text = "") {
  return text
    .replace(/\u200F/g, "")
    .replace(/\u200E/g, "")
    .replace(/\u0640/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------
// 🚫 Ban Words Detection
// ---------------------------------------------
function containsBanWords(text = "") {
  if (!text || typeof text !== "string") return false;

  const lower = text.toLowerCase();
  const normalizedArabic = normalizeArabic(text);

  // English words with strict boundaries
  for (const word of BAN_WORDS.english) {
    const regex = new RegExp(`\\b${word}\\b`, "i");
    if (regex.test(lower)) return true;
  }

  // Arabic detection (normalized)
  for (const word of BAN_WORDS.arabic) {
    if (normalizedArabic.includes(word)) return true;
  }

  return false;
}

// ---------------------------------------------
// 🚫 Send Ban Words Response
// ---------------------------------------------
async function sendBanWordsResponse(to) {
  try {
    await sendTextMessage(
      to,
      "Sorry for your frustration 🙏 Please avoid inappropriate words."
    );
  } catch (err) {
    console.error("❌ Ban words response error:", err.message);
  }
}

// --------------------------------------------
// Exports
// --------------------------------------------
module.exports = {
  containsBanWords,
  sendBanWordsResponse,
  normalizeArabic,
};
