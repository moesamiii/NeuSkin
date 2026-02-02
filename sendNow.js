/**
 * sendNow.js
 *
 * Standalone script to send a WhatsApp message immediately
 * Compatible with index.js WhatsApp setup
 *
 * Run with:
 * node sendNow.js
 */

import axios from "axios";

// ==============================
// ENV
// ==============================
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
  console.error("❌ Missing WHATSAPP_TOKEN or PHONE_NUMBER_ID");
  process.exit(1);
}

// ==============================
// MESSAGE CONFIG
// ==============================
const TO = "962785050875"; // no +
const MESSAGE =
  "مرحبًا 👋 اليوم لدينا عروض خاصة! 🎉 خصومات حصرية لفترة محدودة 💥";

// ==============================
// SEND MESSAGE
// ==============================
async function sendNow() {
  try {
    const url = `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`;

    const payload = {
      messaging_product: "whatsapp",
      to: TO,
      text: {
        body: MESSAGE,
      },
    };

    await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    console.log("✅ Message sent successfully to", TO);
  } catch (err) {
    console.error("❌ Failed to send message");
    console.error(err.response?.data || err.message);
  }
}

// ==============================
// RUN
// ==============================
sendNow();
