// webhookCandy.js (place in root folder)

export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Only POST allowed
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    console.log("🔥 Webhook received!");
    console.log("Body:", JSON.stringify(req.body, null, 2));

    // Supabase sends data in "record" field
    const payload = req.body.record || req.body;
    const { name, phone, service } = payload;

    if (!name || !phone || !service) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Send WhatsApp message
    const messageText = `📢 عميل جديد من الموقع:
👤 الاسم: ${name}
📞 الهاتف: ${phone}
💊 الخدمة: ${service}`;

    const whatsappResponse = await fetch(
      "https://whatsapp-test-rosy.vercel.app/api/sendWhatsApp",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Smile Clinic",
          phone: "962781685210",
          service: "Booking",
          appointment: messageText,
        }),
      }
    );

    const whatsappData = await whatsappResponse.json();
    console.log("WhatsApp sent:", whatsappData);

    return res.status(200).json({
      success: true,
      message: "Webhook processed successfully",
      whatsappResult: whatsappData,
    });
  } catch (err) {
    console.error("ERROR:", err);
    return res.status(500).json({ error: err.message });
  }
}
