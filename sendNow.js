/**
 * sendNow.js
 *
 * Standalone script to send a WhatsApp message immediately.
 * Used for:
 * - Testing
 * - Campaigns
 * - Manual notifications
 *
 * ⚠️ Not an Express route
 */

import axios from "axios";

// ✅ Read environment variables
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

// ✅ Target recipient and message
const to = "962785050875"; // international format, no '+'
const message =
  "مرحبًا 👋 اليوم لدينا عروض خاصة! 🎉 خصومات حصرية لفترة محدودة 💥";

// --------------------------------------------------
// 🚀 Send WhatsApp message
// --------------------------------------------------
async function sendMessage() {
  try {
    if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
      throw new Error(
        "❌ Missing WHATSAPP_TOKEN or PHONE_NUMBER_ID. Check environment variables.",
      );
    }

    const url = `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`;

    const payload = {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: message },
    };

    const headers = {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
    };

    console.log("🚀 Sending message to:", to);

    const response = await axios.post(url, payload, { headers });

    console.log("✅ Message sent successfully!");
    console.log("Response:", JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error("❌ Error while sending message:");

    if (error.response) {
      console.error(JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
  }
}

// --------------------------------------------------
// ▶️ Run immediately when file is executed
// --------------------------------------------------
sendMessage();
