import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

// ✅ ROOT ROUTE (PUT IT HERE)
app.get("/", (req, res) => {
  res.send("WhatsApp Webhook is running 🚀");
});

// ==============================
// 1️⃣ VERIFY WEBHOOK (Meta step)
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
// 2️⃣ RECEIVE MESSAGES
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

    console.log("Incoming message:", text);

    if (text === "hello") {
      await sendMessage(from, "Hi 👋 How can I help you?");
    }

    res.sendStatus(200);
  } catch (error) {
    console.error(error);
    res.sendStatus(200);
  }
});

// ==============================
// 3️⃣ SEND MESSAGE FUNCTION
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

app.listen(3000, () => {
  console.log("Webhook running on port 3000");
});
