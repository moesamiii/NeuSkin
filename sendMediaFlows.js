/**
 * sendMediaFlows.js
 *
 * Media flows (offers, doctors, booking buttons)
 * Compatible with index.js WhatsApp setup
 */

import axios from "axios";
import { sendTextMessage, sendServiceList } from "./helpers.js";
import { OFFER_IMAGES, DOCTOR_IMAGES } from "./mediaAssets.js";
import { sendImageMessage } from "./messageHandlers.js";

// ==============================
// ENV
// ==============================
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;

// ==============================
// Helper: delay
// ==============================
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ==============================
// Booking Start Button
// ==============================
async function sendBookingStartButton(to, language = "ar") {
  try {
    const bodyText =
      language === "en"
        ? "📅 Ready to book your appointment? Click below to start!"
        : "📅 جاهز لحجز موعدك؟ اضغط بالأسفل للبدء!";

    const buttonText = language === "en" ? "Start Booking" : "بدء الحجز";

    await axios.post(
      `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to,
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: bodyText },
          action: {
            buttons: [
              {
                type: "reply",
                reply: {
                  id: "start_booking_flow",
                  title: buttonText,
                },
              },
            ],
          },
        },
      },
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (err) {
    // fallback
    await sendTextMessage(
      to,
      language === "en"
        ? "📅 Ready to book your appointment?"
        : "📅 جاهز لحجز موعدك؟",
    );
    await delay(600);
    await sendServiceList(to);
  }
}

// ==============================
// Start Booking Intro
// ==============================
async function sendStartBookingButton(to, language = "ar") {
  await sendTextMessage(
    to,
    language === "en"
      ? "🎉 I can help you book an appointment."
      : "🎉 يمكنني مساعدتك في حجز موعد.",
  );

  await delay(700);
  await sendBookingStartButton(to, language);
}

// ==============================
// Offers Flow
// ==============================
async function sendOffersImages(to, language = "ar") {
  await sendTextMessage(
    to,
    language === "en" ? "💊 Our current offers:" : "💊 عروضنا الحالية:",
  );

  await delay(600);

  for (let i = 0; i < OFFER_IMAGES.length; i++) {
    await sendImageMessage(to, OFFER_IMAGES[i]);
    if (i < OFFER_IMAGES.length - 1) await delay(900);
  }

  await delay(900);
  await sendBookingStartButton(to, language);
}

// ==============================
// Doctors Flow
// ==============================
async function sendDoctorsImages(to, language = "ar") {
  await sendTextMessage(
    to,
    language === "en" ? "👨‍⚕️ Our medical team:" : "👨‍⚕️ فريقنا الطبي:",
  );

  await delay(600);

  for (let i = 0; i < DOCTOR_IMAGES.length; i++) {
    await sendImageMessage(to, DOCTOR_IMAGES[i]);
    if (i < DOCTOR_IMAGES.length - 1) await delay(900);
  }

  await delay(900);
  await sendBookingStartButton(to, language);
}

// ==============================
// Booking Flow Entry
// ==============================
async function handleBookingFlow(to, language = "ar") {
  await sendTextMessage(
    to,
    language === "en"
      ? "🎉 Please choose a service:"
      : "🎉 يرجى اختيار الخدمة:",
  );

  await delay(600);
  await sendServiceList(to);
}

// ==============================
// Quick Booking Button
// ==============================
async function sendQuickBookingButton(to, language = "ar") {
  try {
    const bodyText =
      language === "en"
        ? "💫 Book quickly using the button below"
        : "💫 احجز بسرعة باستخدام الزر أدناه";

    const buttonText = language === "en" ? "Book Now" : "احجز الآن";

    await axios.post(
      `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to,
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: bodyText },
          action: {
            buttons: [
              {
                type: "reply",
                reply: {
                  id: "quick_booking",
                  title: buttonText,
                },
              },
            ],
          },
        },
      },
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (err) {
    await handleBookingFlow(to, language);
  }
}

// ==============================
// EXPORTS
// ==============================
export {
  sendOffersImages,
  sendDoctorsImages,
  handleBookingFlow,
  sendStartBookingButton,
  sendBookingStartButton,
  sendQuickBookingButton,
};
