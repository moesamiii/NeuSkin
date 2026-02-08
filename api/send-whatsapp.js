export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ success: false, message: "Method not allowed" });
  }

  try {
    const { phone, appointment, image, name } = req.body;

    console.log("Incoming payload:", req.body);

    // 🔴 مؤقتًا فقط للاختبار
    return res.status(200).json({
      success: true,
      message: "API is working",
      received: { phone, appointment, image, name },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
}
