/**
 * webhookHandler.js
 *
 * SAME FILE – ESM FIX ONLY
 *
 * Responsibilities:
 * - Verify webhook
 * - Receive WhatsApp messages
 * - Detect intents
 * - Handle booking flow
 * - Handle audio transcription
 */

import {
  askAI,
  sendTextMessage,
  sendAppointmentOptions,
  askForCancellationPhone,
  processCancellation,
} from "./helpers.js";

// media functions
import {
  sendLocationMessages,
  sendOffersImages,
  sendDoctorsImages,
  sendOffersValidity,
} from "./mediaService.js";

// ban words
import { containsBanWords, sendBanWordsResponse } from "./contentFilter.js";

// detection helpers
import {
  isLocationRequest,
  isOffersRequest,
  isOffersConfirmation,
  isDoctorsRequest,
  isBookingRequest,
  isCancelRequest,
  isEnglish,
  isGreeting,
  getGreeting,
} from "./messageHandlers.js";

import { handleAudioMessage } from "./webhookProcessor.js";

import {
  getSession,
  handleInteractiveMessage,
  handleTextMessage,
} from "./bookingFlowHandler.js";

// ---------------------------------------------
// REGISTER WHATSAPP WEBHOOK ROUTES
// ---------------------------------------------
function registerWebhookRoutes(app, VERIFY_TOKEN) {
  // ---------------------------------
  // GET — Verify Webhook
  // ---------------------------------
  app.get("/webhook", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode && token === VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }

    return res.sendStatus(403);
  });

  // ---------------------------------
  // POST — Receive WhatsApp Events
  // ---------------------------------
  app.post("/webhook", async (req, res) => {
    try {
      const body = req.body;

      const message =
        body.entry?.[0]?.changes?.[0]?.value?.messages?.[0] || null;

      if (!message) return res.sendStatus(200);

      const from = message.from;
      const text = message.text?.body?.trim() || null;

      const session = getSession(from);
      const tempBookings = (global.tempBookings = global.tempBookings || {});

      // 🎙️ AUDIO
      if (message.type === "audio") {
        await handleAudioMessage(message, from);
        return res.sendStatus(200);
      }

      // 🎛️ INTERACTIVE
      if (message.type === "interactive") {
        await handleInteractiveMessage(message, from, tempBookings);
        return res.sendStatus(200);
      }

      // Ignore non-text
      if (!text) return res.sendStatus(200);

      // 👋 GREETING
      if (isGreeting(text)) {
        const reply = getGreeting(isEnglish(text));
        await sendTextMessage(from, reply);
        return res.sendStatus(200);
      }

      // 🚫 BAN WORDS
      if (containsBanWords(text)) {
        const lang = isEnglish(text) ? "en" : "ar";
        await sendBanWordsResponse(from, lang);

        delete tempBookings[from];
        session.waitingForCancelPhone = false;

        return res.sendStatus(200);
      }

      // 🌍 LOCATION
      if (isLocationRequest(text)) {
        const lang = isEnglish(text) ? "en" : "ar";
        await sendLocationMessages(from, lang);
        return res.sendStatus(200);
      }

      // 🎁 OFFERS
      if (isOffersRequest(text)) {
        session.waitingForOffersConfirmation = true;

        const lang = isEnglish(text) ? "en" : "ar";
        await sendOffersValidity(from, lang);
        return res.sendStatus(200);
      }

      if (session.waitingForOffersConfirmation) {
        if (isOffersConfirmation(text)) {
          session.waitingForOffersConfirmation = false;

          const lang = isEnglish(text) ? "en" : "ar";
          await sendOffersImages(from, lang);
          return res.sendStatus(200);
        }

        session.waitingForOffersConfirmation = false;
      }

      // 👨‍⚕️ DOCTORS
      if (isDoctorsRequest(text)) {
        const lang = isEnglish(text) ? "en" : "ar";
        await sendDoctorsImages(from, lang);
        return res.sendStatus(200);
      }

      // ❗ CANCEL BOOKING
      if (isCancelRequest(text)) {
        session.waitingForCancelPhone = true;
        delete tempBookings[from];

        await askForCancellationPhone(from);
        return res.sendStatus(200);
      }

      if (session.waitingForCancelPhone) {
        const phone = text.replace(/\D/g, "");

        if (phone.length < 8) {
          await sendTextMessage(from, "⚠️ رقم الجوال غير صحيح. حاول مرة أخرى:");
          return res.sendStatus(200);
        }

        session.waitingForCancelPhone = false;
        await processCancellation(from, phone);
        return res.sendStatus(200);
      }

      // 🗓️ BOOKING FLOW
      await handleTextMessage(text, from, tempBookings);

      return res.sendStatus(200);
    } catch (err) {
      console.error("❌ Webhook Handler Error:", err);
      return res.sendStatus(500);
    }
  });
}

export { registerWebhookRoutes };
