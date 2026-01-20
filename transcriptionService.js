/**
 * transcriptionService.js
 *
 * Purpose:
 * - Handle audio transcription using Groq Whisper API
 * - Fetch audio files from WhatsApp Media API
 * - Convert audio to text
 * - Return transcribed text ONLY
 */

import axios from "axios";
import FormData from "form-data";

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;

// ------------------------------------------------------
// 🎙️ MAIN — VOICE TRANSCRIPTION FUNCTION
// ------------------------------------------------------
async function transcribeAudio(mediaId, from) {
  try {
    // STEP 1 — GET MEDIA URL
    const mediaUrlResponse = await axios.get(
      `https://graph.facebook.com/v21.0/${mediaId}`,
      {
        headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` },
      },
    );

    const mediaUrl = mediaUrlResponse.data?.url;
    if (!mediaUrl) return null;

    // STEP 2 — DOWNLOAD MEDIA
    const audioResponse = await axios.get(mediaUrl, {
      responseType: "arraybuffer",
      headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` },
    });

    // STEP 3 — SEND TO GROQ WHISPER
    const form = new FormData();
    form.append("file", Buffer.from(audioResponse.data), {
      filename: "voice.ogg",
      contentType: "audio/ogg; codecs=opus",
    });
    form.append("model", "whisper-large-v3");
    form.append("language", "ar");
    form.append("response_format", "json");

    const result = await axios.post(
      "https://api.groq.com/openai/v1/audio/transcriptions",
      form,
      {
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          ...form.getHeaders(),
        },
      },
    );

    const text = result.data?.text?.trim() || null;

    if (text) {
      console.log("🎧 TRANSCRIBED:", text);
    }

    return text;
  } catch (err) {
    console.error(
      "❌ Voice transcription failed:",
      err.response?.data || err.message,
    );
    return null;
  }
}

export { transcribeAudio };
