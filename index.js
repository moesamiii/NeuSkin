import express from "express";
import axios from "axios";
import Groq from "groq-sdk";

const app = express();
app.use(express.json());

// ==============================
// 🤖 GROQ AI SETUP
// ==============================
const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

function detectLanguage(text) {
  const arabic = /[\u0600-\u06FF]/;
  return arabic.test(text) ? "ar" : "en";
}

async function askAI(userMessage) {
  try {
    const lang = detectLanguage(userMessage);

    const arabicPrompt = `أنت موظف خدمة عملاء ذكي وودود في "عيادة ابتسامة الطبيّة".
📍 الموقع: عمّان – عبدون، خلف بنك الإسكان، الطابق الأول.
🕒 مواعيد العمل: يوميًا من الساعة 2 ظهرًا حتى الساعة 10 مساءً (الجمعة مغلق).

تتحدث العربية الفصحى فقط، ومهمتك هي مساعدة العملاء في:
- الحجز أو تعديل الموعد.
- الاستفسار عن العروض.
- شرح الخدمات العلاجية.
- الإجابة عن الأسئلة العامة حول العيادة.

الخدمات المتاحة: تنظيف الأسنان، تبييض الأسنان، حشوات الأسنان، علاج العصب، تقويم الأسنان، خلع الأسنان، ابتسامة هوليوود، زراعة الأسنان، تركيبات الأسنان، علاج التهاب اللثة.

الأسعار تختلف حسب الحالة ويحدّدها الطبيب بعد الفحص.`;

    const englishPrompt = `You are a friendly customer service assistant at "Smile Medical Clinic".
📍 Location: Amman – Abdoun, behind Housing Bank, First Floor.
🕒 Working hours: Daily from 2:00 PM to 10:00 PM (Closed on Fridays).

Available services: Cleaning, Whitening, Fillings, Root canal, Braces, Extraction, Hollywood smile, Implants, Crowns/bridges, Gum treatment.

Prices vary depending on the case. The doctor will confirm after consultation.`;

    const completion = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: lang === "ar" ? arabicPrompt : englishPrompt,
        },
        { role: "user", content: userMessage },
      ],
      temperature: 0.7,
      max_completion_tokens: 512,
    });

    return completion.choices[0]?.message?.content || "عذرًا، لم أفهم سؤالك.";
  } catch (err) {
    console.error("❌ AI Error:", err.message);
    return "⚠️ حدث خطأ في نظام المساعد الذكي.";
  }
}

async function validateNameWithAI(name) {
  try {
    const prompt = `هل "${name}" يبدو اسم شخص حقيقي؟ أجب بـ "نعم" أو "لا" فقط.`;
    const completion = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
      max_completion_tokens: 10,
    });
    const reply =
      completion.choices?.[0]?.message?.content?.toLowerCase() || "";
    return reply.includes("نعم") || reply.includes("yes");
  } catch {
    return true;
  }
}

// ==============================
// 💬 WHATSAPP FUNCTIONS
// ==============================
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;

async function sendTextMessage(to, text) {
  try {
    await axios.post(
      `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
      { messaging_product: "whatsapp", to, text: { body: text } },
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err) {
    console.error("❌ Send error:", err.message);
  }
}

async function sendAppointmentOptions(to) {
  try {
    await axios.post(
      `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to,
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: "📅 اختر الموعد المناسب لك:" },
          action: {
            buttons: [
              { type: "reply", reply: { id: "slot_3pm", title: "3 PM" } },
              { type: "reply", reply: { id: "slot_6pm", title: "6 PM" } },
              { type: "reply", reply: { id: "slot_9pm", title: "9 PM" } },
            ],
          },
        },
      },
      { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } }
    );
  } catch (err) {
    console.error("❌ Button error:", err.message);
  }
}

async function sendServiceList(to) {
  try {
    await axios.post(
      `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to,
        type: "interactive",
        interactive: {
          type: "list",
          header: { type: "text", text: "💊 اختر الخدمة المطلوبة" },
          body: { text: "اختر نوع الخدمة من القائمة:" },
          action: {
            button: "عرض الخدمات",
            sections: [
              {
                title: "الخدمات الأساسية",
                rows: [
                  { id: "service_فحص عام", title: "فحص عام" },
                  { id: "service_تنظيف الأسنان", title: "تنظيف الأسنان" },
                  { id: "service_تبييض الأسنان", title: "تبييض الأسنان" },
                  { id: "service_حشو الأسنان", title: "حشو الأسنان" },
                ],
              },
              {
                title: "الخدمات المتقدمة",
                rows: [
                  { id: "service_علاج الجذور", title: "علاج الجذور" },
                  { id: "service_تركيب التركيبات", title: "التركيبات" },
                  { id: "service_تقويم الأسنان", title: "تقويم الأسنان" },
                  { id: "service_خلع الأسنان", title: "خلع الأسنان" },
                ],
              },
            ],
          },
        },
      },
      { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } }
    );
  } catch (err) {
    console.error("❌ Service list error:", err.message);
  }
}

// ==============================
// 🧠 BOOKING STATE & DETECTION
// ==============================
const tempBookings = {};

function isBookingRequest(text) {
  const t = (text || "").toLowerCase();
  const keywords = [
    "حجز",
    "احجز",
    "موعد",
    "book",
    "appointment",
    "reserve",
    "اريد احجز",
    "ابي احجز",
  ];
  return keywords.some((k) => t.includes(k));
}

function isCancelRequest(text) {
  const t = (text || "").toLowerCase();
  const keywords = ["الغاء", "إلغاء", "cancel", "الغي", "امسح"];
  return keywords.some((k) => t.includes(k));
}

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
    const messageType = message.type;

    console.log("📩 Message received:", { from, type: messageType });

    // ========== HANDLE INTERACTIVE (BUTTONS) ==========
    if (messageType === "interactive") {
      const interactiveType = message.interactive?.type;
      const id =
        interactiveType === "list_reply"
          ? message.interactive?.list_reply?.id
          : message.interactive?.button_reply?.id;

      console.log("🔘 Interactive:", id);

      // APPOINTMENT SLOT SELECTED
      if (id?.startsWith("slot_")) {
        const appointment = id.replace("slot_", "").toUpperCase();
        tempBookings[from] = { appointment };
        await sendTextMessage(from, "👍 تم اختيار الموعد! الآن أرسل اسمك:");
        return res.sendStatus(200);
      }

      // SERVICE SELECTED
      if (id?.startsWith("service_")) {
        const serviceName = id.replace("service_", "");
        const booking = tempBookings[from];

        if (!booking || !booking.phone) {
          await sendTextMessage(from, "⚠️ يجب إكمال خطوات الحجز أولاً.");
          return res.sendStatus(200);
        }

        booking.service = serviceName;

        // TODO: Save to Supabase here if needed
        // await insertBookingToSupabase(booking);

        await sendTextMessage(
          from,
          `✅ تم حفظ حجزك بنجاح:\n👤 ${booking.name}\n📱 ${booking.phone}\n💊 ${booking.service}\n📅 ${booking.appointment}`
        );

        delete tempBookings[from];
        return res.sendStatus(200);
      }

      return res.sendStatus(200);
    }

    // ========== HANDLE TEXT MESSAGES ==========
    if (messageType === "text") {
      const text = message.text?.body;

      if (!text) {
        return res.sendStatus(200);
      }

      console.log("💬 Text message:", text);

      // CHECK IF USER WANTS TO BOOK
      if (!tempBookings[from] && isBookingRequest(text)) {
        await sendAppointmentOptions(from);
        return res.sendStatus(200);
      }

      // CHECK IF USER WANTS TO CANCEL
      if (isCancelRequest(text)) {
        await sendTextMessage(
          from,
          "📌 أرسل رقم الجوال المستخدم بالحجز لإلغاء الموعد."
        );
        return res.sendStatus(200);
      }

      // BOOKING FLOW: WAITING FOR NAME
      if (tempBookings[from] && !tempBookings[from].name) {
        const isValid = await validateNameWithAI(text);
        if (!isValid) {
          await sendTextMessage(
            from,
            "⚠️ الرجاء إدخال اسم حقيقي مثل: أحمد، محمد علي، سارة..."
          );
          return res.sendStatus(200);
        }
        tempBookings[from].name = text.trim();
        await sendTextMessage(from, "📱 ممتاز! الآن أرسل رقم جوالك:");
        return res.sendStatus(200);
      }

      // BOOKING FLOW: WAITING FOR PHONE
      if (tempBookings[from] && !tempBookings[from].phone) {
        const normalized = text.replace(/[^\d]/g, "");
        if (!/^07\d{8}$/.test(normalized)) {
          await sendTextMessage(
            from,
            "⚠️ الرجاء إدخال رقم أردني صحيح مثل: 07XXXXXXXX"
          );
          return res.sendStatus(200);
        }
        tempBookings[from].phone = normalized;
        await sendServiceList(from);
        return res.sendStatus(200);
      }

      // DEFAULT: AI RESPONSE
      const aiResponse = await askAI(text);
      await sendTextMessage(from, aiResponse);

      return res.sendStatus(200);
    }

    return res.sendStatus(200);
  } catch (error) {
    console.error("❌ WhatsApp error:", error);
    return res.sendStatus(200);
  }
});

// ==============================
// 🚀 START SERVER
// ==============================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
