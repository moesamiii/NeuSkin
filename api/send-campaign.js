export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = req.body;

  console.log("Campaign payload:", body);

  // هنا لاحقاً تربط WhatsApp API أو أي خدمة
  return res.status(200).json({
    success: true,
    message: "Message sent (test)",
  });
}
