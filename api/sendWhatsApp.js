/**
 * sendWhatsApp.js
 *
 * Express-compatible WhatsApp sender
 * Supports:
 * - Text messages
 * - Image messages with caption
 * - Fallback to text if image fails
 */

import { createClient } from "@supabase/supabase-js";

// ✅ Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// ✅ Global variable to store clinic settings
let clinicSettings = null;

// ✅ Load clinic settings from database
async function loadClinicSettings() {
  try {
    const { data, error } = await supabase
      .from("clinic_settings")
      .select("*")
      .eq("clinic_id", "default")
      .single();

    if (error) {
      console.error("❌ Error loading clinic settings:", error);
      return;
    }

    clinicSettings = data;
    console.log("✅ Clinic settings loaded:", clinicSettings?.clinic_name);
  } catch (err) {
    console.error("❌ Exception loading clinic settings:", err.message);
  }
}

// ✅ Load settings on module initialization
loadClinicSettings();

async function sendWhatsApp(req, res) {
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

  const { name, phone, service, appointment, image } = req.body || {};

  if (!name || !phone) {
    return res.status(400).json({ error: "Missing name or phone" });
  }

  // ✅ Get dynamic clinic name or use default
  const clinicName = clinicSettings?.clinic_name || "Smile Clinic";

  const messageText = `👋 مرحبًا ${name}!
تم حجز موعدك لخدمة ${service} في ${clinicName} 🦷
📅 ${appointment}`;

  const url = `https://graph.facebook.com/v21.0/${process.env.PHONE_NUMBER_ID}/messages`;
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
  };

  try {
    // --------------------------------------------------
    // 🖼️ CASE 1 — IMAGE MESSAGE
    // --------------------------------------------------
    if (image && image.startsWith("http")) {
      console.log("📤 Sending image message:", image);

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

      if (!imageResponse.ok || imageData.error) {
        console.error("❌ Image failed, fallback to text:", imageData);

        const textPayload = {
          messaging_product: "whatsapp",
          to: phone,
          type: "text",
          text: {
            body:
              messageText +
              "\n\n📞 للحجز أو الاستفسار، تواصل معنا الآن عبر واتساب!",
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
          textData,
          imageError: imageData,
        });
      }

      // Follow-up text
      const followupPayload = {
        messaging_product: "whatsapp",
        to: phone,
        type: "text",
        text: {
          body: "📞 للحجز أو الاستفسار، تواصل معنا الآن عبر واتساب!",
        },
      };

      const followupResponse = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(followupPayload),
      });

      const followupData = await followupResponse.json();

      return res.status(200).json({
        success: true,
        imageData,
        followupData,
        message: "Image and follow-up text sent successfully",
      });
    }

    // --------------------------------------------------
    // 💬 CASE 2 — TEXT ONLY
    // --------------------------------------------------
    const textPayload = {
      messaging_product: "whatsapp",
      to: phone,
      type: "text",
      text: {
        body:
          messageText +
          "\n\n📞 للحجز أو الاستفسار، تواصل معنا الآن عبر واتساب!",
      },
    };

    const textResponse = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(textPayload),
    });

    const textData = await textResponse.json();

    if (!textResponse.ok) {
      console.error("❌ Text message failed:", textData);
      return res.status(500).json({ success: false, error: textData });
    }

    return res.status(200).json({
      success: true,
      textData,
      message: "Text message sent successfully",
    });
  } catch (error) {
    console.error("🚨 sendWhatsApp error:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

export { sendWhatsApp };
