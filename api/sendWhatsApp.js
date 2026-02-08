/**
 * api/send-whatsapp.js
 *
 * Unified WhatsApp sender for both campaigns and appointments
 * Handles text and image messages with automatic fallback
 */
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  // ✅ Enable CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // ✅ GET endpoint for testing
  if (req.method === "GET") {
    return res.status(200).json({
      status: "active",
      message: "WhatsApp API is running",
      timestamp: new Date().toISOString(),
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { name, phone, service, appointment, image } = req.body;

    // ✅ Validate required fields
    if (!phone || !appointment) {
      console.error("❌ Missing required fields:", { phone, appointment });
      return res.status(400).json({
        success: false,
        error: "Phone and appointment are required",
      });
    }

    // ✅ Get WhatsApp credentials
    const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
    const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;

    if (!PHONE_NUMBER_ID || !WHATSAPP_TOKEN) {
      console.error("❌ Missing WhatsApp credentials");
      return res.status(500).json({
        success: false,
        error: "Server configuration error: Missing WhatsApp credentials",
      });
    }

    // ✅ Load clinic name from Supabase (optional)
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

    // ✅ Build message text - FIXED SYNTAX ERROR
    const messageText = name
      ? `👋 مرحبًا ${name}!\n${service ? `لخدمة ${service} في ${clinicName} 🦷\n` : ""}📅 ${appointment}`
      : appointment;

    const url = `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`;
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
    };

    // --------------------------------------------------
    // 🖼️ CASE 1: IMAGE MESSAGE
    // --------------------------------------------------
    if (image && image.startsWith("http")) {
      console.log("📷 Sending image message:", image);

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
        console.warn("⚠️ Image failed, fallback to text:", imageData);

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
          console.error("❌ Text fallback also failed:", textData);
          return res.status(500).json({
            success: false,
            error: textData,
          });
        }

        return res.status(200).json({
          success: true,
          fallback: true,
          messageId: textData.messages?.[0]?.id,
        });
      }

      console.log("✅ Image sent successfully");

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
      console.error("❌ Text message failed:", textData);
      return res.status(500).json({
        success: false,
        error: textData,
      });
    }

    console.log("✅ Text sent successfully");

    return res.status(200).json({
      success: true,
      messageId: textData.messages?.[0]?.id,
    });
  } catch (error) {
    console.error("🚨 Fatal error:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
}
