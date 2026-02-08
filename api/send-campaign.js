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
        error: "phone and appointment are required",
      });
    }

    const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
    const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;

    const payload = {
      messaging_product: "whatsapp",
      to: phone, // ✅ USE DYNAMIC PHONE FROM REQUEST
    };

    if (image) {
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
      messageId: response.data.messages?.[0]?.id,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.response?.data || err.message,
    });
  }
}
