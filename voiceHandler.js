// voiceHandler.js
import axios from "axios";
import { ElevenLabsClient } from "elevenlabs";
import FormData from "form-data";

const elevenLabsClient = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
});

const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;

// ==============================
// 🎙️ TEXT-TO-SPEECH
// ==============================

export async function convertTextToSpeech(text, lang = "ar") {
  try {
    console.log("🎤 Converting text to speech:", text.substring(0, 50));

    // Choose voice based on language
    const voiceId =
      lang === "ar"
        ? "pFZP5JQG7iQjIQuC4Bku" // Arabic voice
        : "21m00Tcm4TlvDq8ikWAM"; // English voice

    const audio = await elevenLabsClient.generate({
      voice: voiceId,
      text: text,
      model_id: "eleven_multilingual_v2",
    });

    // Convert stream to buffer
    const chunks = [];
    for await (const chunk of audio) {
      chunks.push(chunk);
    }

    const audioBuffer = Buffer.concat(chunks);
    console.log("✅ Audio generated, size:", audioBuffer.length, "bytes");
    return audioBuffer;
  } catch (err) {
    console.error("❌ ElevenLabs error:", err.message);
    return null;
  }
}

// ==============================
// 📤 SEND VOICE MESSAGE
// ==============================
export async function sendVoiceMessage(to, audioBuffer) {
  try {
    console.log("📤 Uploading audio to WhatsApp...");

    // Create form data
    const form = new FormData();
    form.append("file", audioBuffer, {
      filename: "voice.mp3",
      contentType: "audio/mpeg",
    });
    form.append("messaging_product", "whatsapp");

    // Upload to WhatsApp
    const uploadResponse = await axios.post(
      `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/media`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        },
      },
    );

    const mediaId = uploadResponse.data.id;
    console.log("✅ Audio uploaded, media ID:", mediaId);

    // Send voice message
    await axios.post(
      `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to,
        type: "audio",
        audio: {
          id: mediaId,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        },
      },
    );

    console.log("✅ Voice message sent successfully to", to);
    return true;
  } catch (err) {
    console.error("❌ Voice send error:", err.response?.data || err.message);
    return false;
  }
}

// ==============================
// 🎧 PROCESS VOICE MESSAGE
// ==============================
export async function handleVoiceMessage(message, from, askAI) {
  const audioId = message.audio.id;

  try {
    console.log("🎧 Processing voice message from", from);

    // Get media URL
    const mediaResponse = await axios.get(
      `https://graph.facebook.com/v19.0/${audioId}`,
      {
        headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` },
      },
    );

    const audioUrl = mediaResponse.data.url;
    console.log("📥 Audio URL retrieved");

    // Download the audio file
    const audioFile = await axios.get(audioUrl, {
      headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` },
      responseType: "arraybuffer",
    });

    console.log("✅ Audio downloaded, size:", audioFile.data.length, "bytes");

    // TODO: Add speech-to-text here
    // For now, using a default message
    const transcribedText = "مرحبا"; // Placeholder

    console.log("💬 Transcribed text:", transcribedText);

    // Get AI response
    const aiResponse = await askAI(transcribedText);
    console.log("🤖 AI response:", aiResponse.substring(0, 50));

    // Detect language
    const lang = /[\u0600-\u06FF]/.test(aiResponse) ? "ar" : "en";

    // Convert to speech
    const audioBuffer = await convertTextToSpeech(aiResponse, lang);

    if (audioBuffer) {
      const success = await sendVoiceMessage(from, audioBuffer);
      return success;
    } else {
      console.log("⚠️ Fallback to text message");
      // Fallback to text
      await axios.post(
        `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
        {
          messaging_product: "whatsapp",
          to: from,
          text: { body: aiResponse },
        },
        {
          headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` },
        },
      );
      return true;
    }
  } catch (err) {
    console.error(
      "❌ Voice processing error:",
      err.response?.data || err.message,
    );
    throw err;
  }
}
