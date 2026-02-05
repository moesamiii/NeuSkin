import axios from "axios";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { phone, appointment, image } = req.body;

    if (!phone || !appointment) {
      return res.status(400).json({
        success: false,
        error: "Phone and message are required",
      });
    }

    // 🔢 Normalize phone (WhatsApp needs digits only, no +)
    let formattedPhone = phone.replace(/\D/g, "");
    if (formattedPhone.startsWith("00")) {
      formattedPhone = formattedPhone.substring(2);
    }
    if (formattedPhone.startsWith("0")) {
      formattedPhone = "962" + formattedPhone.substring(1);
    }

    const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
    const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;

    if (!PHONE_NUMBER_ID || !WHATSAPP_TOKEN) {
      return res.status(500).json({
        success: false,
        error: "WhatsApp credentials missing",
      });
    }

    const payload = {
      messaging_product: "whatsapp",
      to: formattedPhone,
    };

    if (image && image.trim()) {
      payload.type = "image";
      payload.image = {
        link: image,
        caption: appointment,
      };
    } else {
      payload.type = "text";
      payload.text = {
        body: appointment,
      };
    }

    const response = await axios.post(
      `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
      },
    );

    return res.status(200).json({
      success: true,
      messageId: response.data.messages?.[0]?.id || null,
      phone: formattedPhone,
    });
  } catch (error) {
    if (error.response) {
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
