import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

export default async function handler(req, res) {
  // Keep connection open
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  console.log("🔥 Vercel function started. Listening for new bookings...");

  // Subscribe to Realtime
  const channel = supabase
    .channel("serverless-listener")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "web_bookings" },
      async (payload) => {
        console.log("📥 New booking:", payload.new);

        const messageText = `
        NEW BOOKING:
        Name: ${payload.new.name}
        Phone: ${payload.new.phone}
        Service: ${payload.new.service}
        `;

        // Send WhatsApp via your API
        await fetch("https://whatsapp-test-rosy.vercel.app/sendWhatsApp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Smile Clinic",
            phone: "962785050875",
            service: "Booking",
            appointment: messageText,
          }),
        });

        console.log("📤 WhatsApp sent!");
      },
    )
    .subscribe();

  // Keep alive
  res.write("event: ping\ndata: listening\n\n");
}
