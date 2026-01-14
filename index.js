import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

// ==============================
// ✅ ROOT ROUTE
// ==============================
app.get("/", (req, res) => {
  res.send("WhatsApp Webhook is running 🚀");
});

// ==============================
// 1️⃣ VERIFY WEBHOOK (Meta)
// ==============================
app.get("/webhook", (req, res) => {
  const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

// ==============================
// 2️⃣ RECEIVE WHATSAPP MESSAGES
// ==============================
app.post("/webhook", async (req, res) => {
  try {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const message = changes?.value?.messages?.[0];

    if (!message) {
      return res.sendStatus(200);
    }

    const from = message.from;
    const text = message.text?.body?.toLowerCase();

    console.log("📩 Incoming WhatsApp message:", text);

    if (text === "hello") {
      await sendMessage(from, "Hi 👋 How can I help you?");
    }

    return res.sendStatus(200);
  } catch (error) {
    console.error("❌ WhatsApp error:", error);
    return res.sendStatus(200);
  }
});

// ==============================
// 3️⃣ SEND WHATSAPP MESSAGE
// ==============================
async function sendMessage(to, text) {
  const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
  const TOKEN = process.env.WHATSAPP_TOKEN;

  await axios.post(
    `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: "whatsapp",
      to,
      text: { body: text },
    },
    {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
    }
  );
}

// ==============================
// 🍬 WEBHOOK CANDY (WEBSITE / SUPABASE)
// ==============================
app.options("/webhook-candy", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  return res.status(200).end();
});

app.post("/webhook-candy", async (req, res) => {
  try {
    console.log("🔥 Candy webhook received");
    console.log("Body:", JSON.stringify(req.body, null, 2));

    const payload = req.body.record || req.body;
    const { name, phone, service } = payload;

    if (!name || !phone || !service) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const messageText = `📢 عميل جديد من الموقع:
👤 الاسم: ${name}
📞 الهاتف: ${phone}
💊 الخدمة: ${service}`;

    const response = await fetch(
      "https://whatsapp-test-rosy.vercel.app/api/sendWhatsApp",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Smile Clinic",
          phone: "962781685210",
          service: "Booking",
          appointment: messageText,
        }),
      }
    );

    const data = await response.json();

    console.log("✅ WhatsApp sent from Candy:", data);

    return res.status(200).json({
      success: true,
      whatsappResult: data,
    });
  } catch (err) {
    console.error("❌ Candy webhook error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ==============================
// 🚀 START SERVER
// ==============================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
