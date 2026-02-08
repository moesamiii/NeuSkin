/**
 * send-campaign.js
 * Vercel Serverless Function for sending WhatsApp campaigns
 * Location: /api/send-campaign.js
 */

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
    if (!phone || !appointment) {
      console.error("❌ Missing required fields:", { phone, appointment });
      return res.status(400).json({
        success: false,
        error: "Phone and appointment are required",
      });
    }

    // ✅ Get WhatsApp credentials from environment
    const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
    const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;

    if (!PHONE_NUMBER_ID || !WHATSAPP_TOKEN) {
      console.error("❌ Missing environment variables");
      return res.status(500).json({
        success: false,
        error: "Server configuration error: Missing WhatsApp credentials",
      });
    }

    console.log("📤 Sending campaign message to:", phone);

    // ✅ Build message text
    const messageText = name
      ? `👋 مرحبًا ${name}!\n${service ? `خدمة: ${service}\n` : ""}📅 ${appointment}`
      : appointment;

    const url = `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`;
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
    };

    // --------------------------------------------------
    // 🖼️ CASE 1: Send IMAGE with caption
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

      // ❌ If image fails, fallback to text
      if (!imageResponse.ok || imageData.error) {
        console.warn("⚠️ Image failed, sending text instead:", imageData);

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
    // 💬 CASE 2: Send TEXT ONLY
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
    console.error("🚨 Campaign error:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}
