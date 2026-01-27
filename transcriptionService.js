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
    console.log(`🎙️ Starting transcription for media ID: ${mediaId}`);

    // STEP 1 — GET MEDIA URL
    const mediaUrlResponse = await axios.get(
      `https://graph.facebook.com/v21.0/${mediaId}`,
      {
        headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` },
      },
    );

    const mediaUrl = mediaUrlResponse.data?.url;

    if (!mediaUrl) {
      console.error("❌ No media URL found");
      return null;
    }

    console.log(`✅ Media URL obtained: ${mediaUrl.substring(0, 50)}...`);

    // STEP 2 — DOWNLOAD MEDIA (WITH FIX)
    const audioResponse = await axios.get(mediaUrl, {
      responseType: "arraybuffer",
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Accept-Encoding": "identity", // ✅ Disable compression
      },
      decompress: false, // ✅ Disable auto-decompression
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    console.log(`✅ Audio downloaded: ${audioResponse.data.byteLength} bytes`);

    // STEP 3 — SEND TO GROQ WHISPER
    const form = new FormData();
    form.append("file", Buffer.from(audioResponse.data), {
      filename: "voice.ogg",
      contentType: "audio/ogg; codecs=opus",
    });
    form.append("model", "whisper-large-v3");
    form.append("language", "ar");
    form.append("response_format", "json");

    console.log(`📤 Sending to Groq Whisper API...`);

    const result = await axios.post(
      "https://api.groq.com/openai/v1/audio/transcriptions",
      form,
      {
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          ...form.getHeaders(),
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      },
    );

    const text = result.data?.text?.trim() || null;

    if (text) {
      console.log("🎧 TRANSCRIBED:", text);
    } else {
      console.warn("⚠️ Transcription returned empty");
    }

    return text;
  } catch (err) {
    console.error("❌ Voice transcription failed:");
    console.error("Error message:", err.message);

    if (err.response) {
      console.error("Response status:", err.response.status);
      console.error("Response data:", err.response.data);
    }

    if (err.code) {
      console.error("Error code:", err.code);
    }

    return null;
  }
}

export { transcribeAudio };
