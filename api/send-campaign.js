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

    let formattedPhone = phone.replace(/\D/g, "");
    if (formattedPhone.startsWith("0")) {
      formattedPhone = "962" + formattedPhone.slice(1);
    }

    const response = await axios.post(
      `https://graph.facebook.com/v19.0/${process.env.PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: formattedPhone,
        type: image ? "image" : "text",
        ...(image
          ? { image: { link: image, caption: appointment } }
          : { text: { body: appointment } }),
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
      },
    );

    return res.status(200).json({
      success: true,
      id: response.data.messages?.[0]?.id,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.response?.data || err.message,
    });
  }
}
