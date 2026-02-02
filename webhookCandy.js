// webhookCandy.js (place in root folder)
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
  } catch (err) {
    console.error("❌ Exception loading clinic settings:", err.message);
  }
}

export default async function handler(req, res) {
  // ✅ Load settings if not already loaded
  if (!clinicSettings) {
    await loadClinicSettings();
  }

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

    // ✅ Get dynamic clinic name or use default
    const clinicName = clinicSettings?.clinic_name || "Smile Clinic";

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
          name: clinicName,
          phone: "962781685210",
          service: "Booking",
          appointment: messageText,
        }),
      },
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
