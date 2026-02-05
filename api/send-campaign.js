import axios from "axios";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { name, phone, service, appointment, image } = req.body;

    console.log("📤 Campaign request received in serverless function:");
    console.log("- Phone:", phone);
    console.log("- Message:", appointment);

    // Validate
    if (!phone || !appointment) {
      return res.status(400).json({
        success: false,
        error: "Phone and message are required",
      });
    }

    // Format phone number
    let formattedPhone = phone.replace(/[\s\-\(\)]/g, "");
    if (formattedPhone.startsWith("+")) {
      formattedPhone = formattedPhone.substring(1);
    }

    console.log("📱 Formatted phone:", formattedPhone);

    // WhatsApp credentials from environment
    const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
    const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;

    // Prepare message
    const messagePayload = {
      messaging_product: "whatsapp",
      to: formattedPhone,
    };

    if (image && image.trim()) {
      messagePayload.type = "image";
      messagePayload.image = {
        link: image,
        caption: appointment,
      };
      console.log("📸 Sending image message");
    } else {
      messagePayload.type = "text";
      messagePayload.text = {
        body: appointment,
      };
      console.log("💬 Sending text message");
    }

    // Send to WhatsApp
    const whatsappResponse = await axios.post(
      `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
      messagePayload,
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
      },
    );

    console.log("✅ WhatsApp API response:", whatsappResponse.data);

    return res.status(200).json({
      success: true,
      messageId: whatsappResponse.data.messages?.[0]?.id,
      phone: formattedPhone,
    });
  } catch (error) {
    console.error("❌ Campaign error:", error.message);

    if (error.response) {
      console.error("WhatsApp API error:", error.response.data);
      return res.status(error.response.status).json({
        success: false,
        error: error.response.data?.error?.message || "WhatsApp API error",
        details: error.response.data,
      });
    }

    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}
