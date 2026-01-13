// ==============================
// index.js (FINAL MERGED VERSION)
// ==============================

const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const path = require("path");
const { registerWebhookRoutes } = require("./webhookHandler");

const app = express();
app.use(bodyParser.json());

// ---------------------------------------------
// Environment Variables
// ---------------------------------------------
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "my_secret";
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

// ---------------------------------------------
// Startup logs
// ---------------------------------------------
console.log("🚀 Server starting...");
console.log("✅ VERIFY_TOKEN loaded:", !!VERIFY_TOKEN);
console.log("✅ WHATSAPP_TOKEN loaded:", !!WHATSAPP_TOKEN);
console.log("✅ PHONE_NUMBER_ID:", PHONE_NUMBER_ID || "❌ Missing");

// ---------------------------------------------
// Root Route
// ---------------------------------------------
app.get("/", (req, res) => {
  res.send("✅ WhatsApp Webhook is running 🚀");
});

// ---------------------------------------------
// Dashboard
// ---------------------------------------------
app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "dashboard.html"));
});

// ---------------------------------------------
// Fetch bookings (Supabase)
// ---------------------------------------------
app.get("/api/bookings", async (req, res) => {
  try {
    const { getAllBookingsFromSupabase } = require("./databaseHelper");
    const data = await getAllBookingsFromSupabase();
    res.json(data);
  } catch (err) {
    console.error("❌ Error fetching bookings:", err);
    res.status(500).json({ error: "Failed to fetch bookings" });
  }
});

// ---------------------------------------------
// Send WhatsApp Message (TEXT + IMAGE)
// ---------------------------------------------
app.post("/sendWhatsApp", async (req, res) => {
  try {
    const { name, phone, service, appointment, image } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ error: "Missing name or phone" });
    }

    const messageText =
      `👋 مرحبًا ${name}!\n` +
      `🦷 تم حجز موعدك لخدمة ${service}\n` +
      `📅 ${appointment}`;

    const url = `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`;
    const headers = {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
    };

    // IMAGE MESSAGE
    if (image && image.startsWith("http")) {
      await axios.post(
        url,
        {
          messaging_product: "whatsapp",
          to: phone,
          type: "image",
          image: {
            link: image,
            caption: messageText,
          },
        },
        { headers }
      );

      // Follow-up text
      await axios.post(
        url,
        {
          messaging_product: "whatsapp",
          to: phone,
          type: "text",
          text: { body: "📞 للحجز أو الاستفسار، تواصل معنا الآن!" },
        },
        { headers }
      );

      return res.json({ success: true, type: "image" });
    }

    // TEXT ONLY
    await axios.post(
      url,
      {
        messaging_product: "whatsapp",
        to: phone,
        type: "text",
        text: { body: messageText },
      },
      { headers }
    );

    res.json({ success: true, type: "text" });
  } catch (error) {
    console.error("🚨 WhatsApp Error:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to send message" });
  }
});

// ---------------------------------------------
// Register Webhook Routes
// ---------------------------------------------
registerWebhookRoutes(app, VERIFY_TOKEN);

// ---------------------------------------------
// Start Server
// ---------------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});

module.exports = app;
