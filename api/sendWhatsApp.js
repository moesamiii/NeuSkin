/**
 * sendWhatsApp.js
 * Vercel Serverless Function for sending WhatsApp appointment confirmations
 * Location: /api/sendWhatsApp.js
 */

import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  // ✅ Enable CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { name, phone, service, appointment, image } = req.body;

    // ✅ Validate required fields
    if (!name || !phone) {
      console.error("❌ Missing name or phone");
      return res.status(400).json({ error: "Missing name or phone" });
    }

    // ✅ Get WhatsApp credentials
    const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
    const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;

    if (!PHONE_NUMBER_ID || !WHATSAPP_TOKEN) {
      console.error("❌ Missing WhatsApp credentials");
      return res.status(500).json({ error: "Server configuration error" });
    }

    // ✅ Load clinic name from Supabase
    let clinicName = "Smile Clinic";

    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const supabase = createClient(
          process.env.SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY,
        );

        const { data } = await supabase
          .from("clinic_settings")
          .select("clinic_name")
          .eq("clinic_id", "default")
          .single();

        if (data?.clinic_name) {
          clinicName = data.clinic_name;
        }
      } catch (err) {
        console.warn("⚠️ Could not load clinic settings:", err.message);
      }
    }

    console.log("📤 Sending message to:", phone, "| Clinic:", clinicName);

    const messageText = `👋 مرحبًا ${name}!
تم حجز موعدك لخدمة ${service} في ${clinicName} 🦷
📅 ${appointment}`;

    const url = `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`;
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
    };

    // --------------------------------------------------
    // 🖼️ CASE 1: IMAGE MESSAGE
    // --------------------------------------------------
    if (image && image.startsWith("http")) {
      console.log("📷 Sending image message");

      const imagePayload = {
        messaging_product: "whatsapp",
        to: phone,
        type: "image",
        image: {
          link: image,
          caption: messageText,
        },
      };

      const imageResponse = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(imagePayload),
      });

      const imageData = await imageResponse.json();

      // ❌ Fallback to text if image fails
      if (!imageResponse.ok || imageData.error) {
        console.warn("⚠️ Image failed, fallback to text");

        const textPayload = {
          messaging_product: "whatsapp",
          to: phone,
          type: "text",
          text: {
            body: messageText + "\n\n📞 للحجز أو الاستفسار، تواصل معنا!",
          },
        };

        const textResponse = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(textPayload),
        });

        const textData = await textResponse.json();

        return res.status(200).json({
          success: true,
          fallback: true,
          messageId: textData.messages?.[0]?.id,
        });
      }

      // Send follow-up text
      const followupPayload = {
        messaging_product: "whatsapp",
        to: phone,
        type: "text",
        text: {
          body: "📞 للحجز أو الاستفسار، تواصل معنا الآن عبر واتساب!",
        },
      };

      await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(followupPayload),
      });

      return res.status(200).json({
        success: true,
        messageId: imageData.messages?.[0]?.id,
      });
    }

    // --------------------------------------------------
    // 💬 CASE 2: TEXT ONLY
    // --------------------------------------------------
    console.log("💬 Sending text message");

    const textPayload = {
      messaging_product: "whatsapp",
      to: phone,
      type: "text",
      text: {
        body: messageText + "\n\n📞 للحجز أو الاستفسار، تواصل معنا!",
      },
    };

    const textResponse = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(textPayload),
    });

    const textData = await textResponse.json();

    if (!textResponse.ok) {
      console.error("❌ Message failed:", textData);
      return res.status(500).json({ success: false, error: textData });
    }

    console.log("✅ Message sent successfully");

    return res.status(200).json({
      success: true,
      messageId: textData.messages?.[0]?.id,
    });
  } catch (error) {
    console.error("🚨 sendWhatsApp error:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}
