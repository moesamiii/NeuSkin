/**
 * webhookHandler.js
 *
 * Handles WhatsApp webhook verification and message processing
 * Integrated with index.js structure
 */

// ==============================
// 🔧 HELPER FUNCTIONS FROM INDEX.JS
// ==============================

function isBookingRequest(text) {
  return /(حجز|موعد|احجز|book|appointment|reserve)/i.test(text);
}

function isCancelRequest(text) {
  return /(الغاء|إلغاء|الغي|كنسل|cancel)/i.test(text);
}

function isDoctorRequest(text) {
  return /(طبيب|اطباء|أطباء|الاطباء|الأطباء|دكتور|دكاترة|doctor|doctors)/i.test(
    text,
  );
}

function isResetRequest(text) {
  return /(reset|start|عيد من اول|ابدا من جديد|ابدأ من جديد|من البداية|بداية جديدة|restart|new chat|ابدا|ابدأ|عيد)/i.test(
    text,
  );
}

function isGreeting(text) {
  const greetings = [
    /^(hi|hello|hey|مرحبا|السلام عليكم|اهلا|هلا|صباح الخير|مساء الخير)/i,
  ];
  return greetings.some((pattern) => pattern.test(text.trim()));
}

function getGreeting(isEnglish, clinicName) {
  if (isEnglish) {
    return `👋 Hello! Welcome to ${clinicName}!\n\nHow can I help you today?`;
  }
  return `👋 مرحباً بك في ${clinicName}!\n\nكيف يمكنني مساعدتك اليوم؟`;
}

function detectLanguage(text) {
  return /[\u0600-\u06FF]/.test(text) ? "ar" : "en";
}

// ==============================
// 📩 WEBHOOK ROUTES
// ==============================

function registerWebhookRoutes(
  app,
  VERIFY_TOKEN,
  {
    askAI,
    sendTextMessage,
    sendAppointmentOptions,
    sendServiceList,
    sendDoctorInfo,
    findBookingByPhone,
    cancelBooking,
    insertBookingToSupabase,
    handleAudioMessage,
    tempBookings,
    cancelSessions,
    clinicSettings,
    isDuplicateMessage,
    checkRateLimit,
    isMessageBeingProcessed,
    markMessageProcessed,
  },
) {
  // ---------------------------------
  // GET — Verify Webhook
  // ---------------------------------
  app.get("/webhook", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    console.log("🔍 Webhook verification request:");
    console.log("Mode:", mode);
    console.log("Token received:", token);
    console.log("Token expected:", VERIFY_TOKEN);
    console.log("Challenge:", challenge);

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("✅ Webhook verification successful!");
      return res.status(200).send(challenge);
    } else {
      console.log("❌ Webhook verification failed!");
      return res.sendStatus(403);
    }
  });

  // ---------------------------------
  // POST — Receive WhatsApp Events
  // ---------------------------------
  app.post("/webhook", async (req, res) => {
    const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!message) return res.sendStatus(200);

    const from = message.from;
    const messageId = message.id;

    // ✅ CHECK IF MESSAGE IS ALREADY BEING PROCESSED
    if (isMessageBeingProcessed(from, messageId)) {
      console.log(
        `🔄 Message ${messageId} from ${from} is already being processed - ignoring duplicate`,
      );
      return res.sendStatus(200);
    }

    try {
      // ✅ DUPLICATE MESSAGE DETECTION
      if (message.type === "text") {
        const text = message.text.body;

        if (isDuplicateMessage(from, text)) {
          console.log(
            `🔁 Duplicate message from ${from}: "${text}" - ignoring`,
          );
          markMessageProcessed(from, messageId);
          return res.sendStatus(200);
        }
      }

      // ✅ RATE LIMIT CHECK
      const rateLimitCheck = checkRateLimit(from);

      if (!rateLimitCheck.allowed) {
        console.log(`⚠️ Rate limited user ${from} - silently ignoring`);
        markMessageProcessed(from, messageId);
        return res.sendStatus(200);
      }

      // ✅ VOICE MESSAGE HANDLING
      if (message.type === "audio") {
        console.log("🎙️ Voice message received from", from);
        try {
          await handleAudioMessage(
            message,
            from,
            askAI,
            sendTextMessage,
            sendAppointmentOptions,
            sendServiceList,
            sendDoctorInfo,
            tempBookings,
            cancelSessions,
          );
          markMessageProcessed(from, messageId);
          return res.sendStatus(200);
        } catch (err) {
          console.error("❌ Voice handling error:", err.message);
          await sendTextMessage(
            from,
            "⚠️ عذراً، حدث خطأ في معالجة الرسالة الصوتية.",
          );
          markMessageProcessed(from, messageId);
          return res.sendStatus(200);
        }
      }

      // ---------------- BUTTONS ----------------
      if (message.type === "interactive") {
        const id =
          message.interactive?.list_reply?.id ||
          message.interactive?.button_reply?.id;

        if (id.startsWith("slot_")) {
          tempBookings[from] = {
            appointment: id.replace("slot_", "").toUpperCase(),
          };
          await sendTextMessage(from, "👍 أرسل اسمك:");
          markMessageProcessed(from, messageId);
          return res.sendStatus(200);
        }

        if (id.startsWith("service_")) {
          const booking = tempBookings[from];
          booking.service = id.replace("service_", "");

          await insertBookingToSupabase(booking);

          await sendTextMessage(
            from,
            `✅ تم تأكيد الحجز:\n👤 ${booking.name}\n📱 ${booking.phone}\n💊 ${booking.service}\n📅 ${booking.appointment}`,
          );

          delete tempBookings[from];
          markMessageProcessed(from, messageId);
          return res.sendStatus(200);
        }
      }

      // ---------------- TEXT ----------------
      if (message.type === "text") {
        const text = message.text.body;

        console.log("📩 Message from:", from, "Text:", text);

        // ✅ PRIORITY 0: RESET/START DETECTION (HIGHEST PRIORITY!)
        if (isResetRequest(text)) {
          console.log("🔄 Reset request detected!");

          // Clear all user sessions
          delete tempBookings[from];
          delete cancelSessions[from];

          const lang = detectLanguage(text);
          const clinicName =
            clinicSettings?.clinic_name ||
            (lang === "ar" ? "عيادة ابتسامة" : "Ibtisama Clinic");

          const greeting =
            lang === "ar"
              ? `👋 مرحباً بك في ${clinicName}!\n\nكيف يمكنني مساعدتك اليوم؟`
              : `👋 Hello! Welcome to ${clinicName}!\n\nHow can I help you today?`;

          await sendTextMessage(from, greeting);
          markMessageProcessed(from, messageId);
          return res.sendStatus(200);
        }

        // ✅ GREETING
        if (isGreeting(text)) {
          const lang = detectLanguage(text);
          const clinicName =
            clinicSettings?.clinic_name ||
            (lang === "ar" ? "عيادة ابتسامة" : "Ibtisama Clinic");
          const reply = getGreeting(lang === "en", clinicName);
          await sendTextMessage(from, reply);
          markMessageProcessed(from, messageId);
          return res.sendStatus(200);
        }

        // ✅ PRIORITY 1: CANCEL DETECTION (MUST BE FIRST!)
        if (isCancelRequest(text) && !tempBookings[from]) {
          console.log("🚫 Cancel request detected!");

          cancelSessions[from] = true;

          // Clear any ongoing booking
          if (tempBookings[from]) {
            delete tempBookings[from];
          }

          await sendTextMessage(from, "📌 أرسل رقم الجوال المستخدم في الحجز:");
          markMessageProcessed(from, messageId);
          return res.sendStatus(200);
        }

        // ✅ PRIORITY 2: User is in cancel flow - waiting for phone
        if (cancelSessions[from]) {
          const phone = text.replace(/\D/g, "");

          if (phone.length < 8) {
            await sendTextMessage(from, "⚠️ رقم الجوال غير صحيح. حاول مجددًا:");
            markMessageProcessed(from, messageId);
            return res.sendStatus(200);
          }

          // Find booking
          const booking = await findBookingByPhone(phone);

          if (!booking) {
            await sendTextMessage(from, "❌ لا يوجد حجز مرتبط بهذا الرقم.");
            delete cancelSessions[from];
            markMessageProcessed(from, messageId);
            return res.sendStatus(200);
          }

          // Cancel it
          const success = await cancelBooking(booking.id);

          if (success) {
            await sendTextMessage(
              from,
              `🟣 تم إلغاء الحجز:\n👤 ${booking.name}\n💊 ${booking.service}\n📅 ${booking.appointment}`,
            );
          } else {
            await sendTextMessage(from, "⚠️ حدث خطأ أثناء الإلغاء.");
          }

          delete cancelSessions[from];
          markMessageProcessed(from, messageId);
          return res.sendStatus(200);
        }

        // ✅ PRIORITY 3: Doctor request
        if (!tempBookings[from] && isDoctorRequest(text)) {
          await sendDoctorInfo(from);
          markMessageProcessed(from, messageId);
          return res.sendStatus(200);
        }

        // ✅ PRIORITY 4: Start booking
        if (!tempBookings[from] && isBookingRequest(text)) {
          console.log("📅 Starting booking for:", from);
          tempBookings[from] = {};
          await sendAppointmentOptions(from);
          markMessageProcessed(from, messageId);
          return res.sendStatus(200);
        }

        // ✅ PRIORITY 5: In booking flow - collect name
        if (tempBookings[from] && !tempBookings[from].name) {
          tempBookings[from].name = text;
          await sendTextMessage(from, "📱 أرسل رقم الجوال:");
          markMessageProcessed(from, messageId);
          return res.sendStatus(200);
        }

        // ✅ PRIORITY 6: In booking flow - collect phone
        if (tempBookings[from] && !tempBookings[from].phone) {
          tempBookings[from].phone = text.replace(/\D/g, "");
          await sendServiceList(from);
          markMessageProcessed(from, messageId);
          return res.sendStatus(200);
        }

        // ✅ PRIORITY 7: General question - send to AI
        if (!tempBookings[from]) {
          const reply = await askAI(text);
          await sendTextMessage(from, reply);
          markMessageProcessed(from, messageId);
          return res.sendStatus(200);
        }
      }

      markMessageProcessed(from, messageId);
    } catch (error) {
      console.error("❌ Error processing message:", error);
      markMessageProcessed(from, messageId);
    }

    res.sendStatus(200);
  });
}

export { registerWebhookRoutes };
