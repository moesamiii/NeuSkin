/**
 * webhookProcessor.js
 * Voice message handling for the WhatsApp bot
 */

import axios from "axios";

const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;

// ==============================
// 🎙️ AUDIO TRANSCRIPTION
// ==============================
async function transcribeAudio(mediaId, from) {
  try {
    // 1. Get media URL from WhatsApp
    const mediaResponse = await axios.get(
      `https://graph.facebook.com/v19.0/${mediaId}`,
      {
        headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` },
      },
    );

    const mediaUrl = mediaResponse.data.url;

    // 2. Download the audio file
    const audioResponse = await axios.get(mediaUrl, {
      headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` },
      responseType: "arraybuffer",
    });

    const audioBuffer = Buffer.from(audioResponse.data);

    // 3. Send to Groq Whisper for transcription
    const Groq = (await import("groq-sdk")).default;
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const transcription = await groq.audio.transcriptions.create({
      file: new File([audioBuffer], "audio.ogg", { type: "audio/ogg" }),
      model: "whisper-large-v3",
      language: "ar", // Arabic by default, Whisper auto-detects if wrong
    });

    console.log(`🎙️ Transcription for ${from}:`, transcription.text);
    return transcription.text;
  } catch (err) {
    console.error("❌ Transcription error:", err.message);
    return null;
  }
}

// ==============================
// 🔧 HELPER FUNCTIONS
// ==============================

function normalizeArabicDigits(input = "") {
  return input
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

function isQuestion(text = "") {
  if (!text) return false;

  const questionWords = [
    "?",
    "كيف",
    "ليش",
    "متى",
    "أين",
    "وين",
    "شو",
    "what",
    "why",
    "how",
    "when",
    "where",
    "who",
  ];

  return (
    text.trim().endsWith("?") ||
    questionWords.some((w) => text.toLowerCase().includes(w.toLowerCase()))
  );
}

function isBookingRequest(text) {
  return /(حجز|موعد|احجز|book|appointment|reserve)/i.test(text);
}

function isCancelRequest(text) {
  return /(الغاء|إلغاء|الغي|كنسل|cancel)/i.test(text);
}

function isDoctorRequest(text) {
  return /(طبيب|اطباء|أطباء|الاطباء|الأطباء|دكتور|دكاترة|doctor|doctors)/i.test(
    text,
  );
}

// ==============================
// 📩 AUDIO MESSAGE HANDLER
// ==============================
async function handleAudioMessage(
  message,
  from,
  askAI,
  sendTextMessage,
  sendAppointmentOptions,
  sendServiceList,
  sendDoctorInfo,
  tempBookings,
) {
  try {
    const mediaId = message?.audio?.id;
    if (!mediaId) {
      console.log("❌ No media ID found in audio message");
      return;
    }

    console.log(
      `🎙️ Processing audio message from ${from}, media ID: ${mediaId}`,
    );

    // Transcribe the audio
    const transcript = await transcribeAudio(mediaId, from);

    if (!transcript) {
      await sendTextMessage(
        from,
        "⚠️ لم أتمكن من فهم الرسالة الصوتية، حاول مرة أخرى 🎙️",
      );
      return;
    }

    console.log(`✅ Transcribed: "${transcript}"`);

    // Send transcription confirmation to user
    await sendTextMessage(from, `🎙️ فهمت: "${transcript}"`);

    // Now process the transcript as if it was a text message

    // 1. Check if it's a cancel request
    if (isCancelRequest(transcript) && !tempBookings[from]) {
      // User will be handled by the cancel flow in index.js
      // We'll treat this as a text message
      return { type: "text", text: transcript };
    }

    // 2. Check if it's a doctor request
    if (!tempBookings[from] && isDoctorRequest(transcript)) {
      await sendDoctorInfo(from);
      return;
    }

    // 3. Check if it's a booking request
    if (!tempBookings[from] && isBookingRequest(transcript)) {
      console.log("📅 Starting booking from voice for:", from);
      tempBookings[from] = {};
      await sendAppointmentOptions(from);
      return;
    }

    // 4. If in booking flow - collect name
    if (tempBookings[from] && !tempBookings[from].name) {
      // Simple name validation - just check it's not a number or too short
      if (transcript.length < 2 || /^\d+$/.test(transcript)) {
        await sendTextMessage(from, "⚠️ أدخل اسمًا صحيحًا");
        return;
      }
      tempBookings[from].name = transcript;
      await sendTextMessage(from, "📱 أرسل رقم الجوال:");
      return;
    }

    // 5. If in booking flow - collect phone
    if (tempBookings[from] && !tempBookings[from].phone) {
      const normalized = normalizeArabicDigits(transcript);

      // Basic phone validation (adjust regex based on your country format)
      if (normalized.length < 8) {
        await sendTextMessage(from, "⚠️ رقم الجوال غير صحيح. حاول مجددًا:");
        return;
      }

      tempBookings[from].phone = normalized;
      await sendServiceList(from);
      return;
    }

    // 6. If it's a question, ask AI
    if (!tempBookings[from] && isQuestion(transcript)) {
      const answer = await askAI(transcript);
      await sendTextMessage(from, answer);
      return;
    }

    // 7. Default - send to AI
    if (!tempBookings[from]) {
      const reply = await askAI(transcript);
      await sendTextMessage(from, reply);
      return;
    }
  } catch (err) {
    console.error("❌ Audio processing error:", err);
    throw err;
  }
}

export { handleAudioMessage };
