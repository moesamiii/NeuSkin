/**
 * mediaService.js
 *
 * Purpose:
 * - Send location messages with Google Maps link
 * - Send offer images with captions
 * - Send doctor images with names and specializations
 * - Send offers validity/expiration messages
 * - Handle WhatsApp image API calls
 *
 * All media-related messaging is centralized here
 */

const axios = require("axios");
const { sendTextMessage } = require("./helpers");

// Import static media assets from mediaAssets.js
const {
  CLINIC_NAME,
  CLINIC_LOCATION_LINK,
  OFFER_IMAGES,
  DOCTOR_IMAGES,
  DOCTOR_INFO,
} = require("./mediaAssets");

// ---------------------------------------------
// Environment Variables
// ---------------------------------------------
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;

// ---------------------------------------------
// 📍 Send Location Message
// ---------------------------------------------
async function sendLocationMessages(to, language = "ar") {
  await sendTextMessage(to, CLINIC_LOCATION_LINK);
  await new Promise((r) => setTimeout(r, 500));
  if (language === "en") {
    await sendTextMessage(
      to,
      `📍 This is our location at ${CLINIC_NAME}. You can open it in Google Maps 🗺️`
    );
  } else {
    await sendTextMessage(
      to,
      `📍 هذا هو موقع ${CLINIC_NAME}. يمكنك الضغط على الرابط لفتحه في خرائط جوجل 🗺️`
    );
  }
}

// ---------------------------------------------
// 📸 Send Image Message (WhatsApp API)
// ---------------------------------------------
async function sendImageMessage(to, imageUrl, caption = "") {
  try {
    const payload = {
      messaging_product: "whatsapp",
      to,
      type: "image",
      image: { link: imageUrl },
    };

    // Add caption if provided
    if (caption) {
      payload.image.caption = caption;
    }

    await axios.post(
      `https://graph.facebook.com/v21.0/${process.env.PHONE_NUMBER_ID}/messages`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err) {
    console.error(
      "❌ Failed to send image:",
      err.response?.data || err.message
    );
  }
}

// ---------------------------------------------
// 📅 Send Offers Validity (Smart Date Logic)
// ---------------------------------------------
async function sendOffersValidity(to) {
  const endDate = new Date("2025-11-30"); // <-- change this date only if needed
  const today = new Date();

  const diffTime = endDate - today;

  if (diffTime <= 0) {
    return sendTextMessage(
      to,
      "📅 انتهت عروضنا الحالية. تابعنا للعروض القادمة قريباً 🎉"
    );
  }

  const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  const daysText =
    days === 1
      ? "يوم واحد"
      : days === 2
      ? "يومين"
      : days >= 3 && days <= 10
      ? `${days} أيام`
      : `${days} يوماً`;

  await sendTextMessage(
    to,
    `📅 عروضنا مستمرة لمدة *${daysText}* حتى تاريخ *${endDate.toLocaleDateString(
      "ar-EG"
    )}*. هل ترغب أن أرسل لك جميع العروض؟`
  );
}

// ---------------------------------------------
// 🎁 Send Offers Images
// ---------------------------------------------
async function sendOffersImages(to, language = "ar") {
  try {
    await sendTextMessage(
      to,
      language === "en"
        ? "💊 Here are our offers and services:"
        : "💊 هذه عروضنا وخدماتنا الحالية:"
    );
    await new Promise((r) => setTimeout(r, 500));
    for (let i = 0; i < OFFER_IMAGES.length; i++) {
      await sendImageMessage(to, OFFER_IMAGES[i]);
      if (i < OFFER_IMAGES.length - 1)
        await new Promise((r) => setTimeout(r, 800));
    }
    await new Promise((r) => setTimeout(r, 500));
    await sendTextMessage(
      to,
      language === "en"
        ? "✨ For more details or to book an appointment, just let me know!"
        : "✨ لمزيد من التفاصيل أو لحجز موعد، أخبرني فقط!"
    );
  } catch (err) {
    console.error("❌ Offers images error:", err.message);
  }
}

// ---------------------------------------------
// 👨‍⚕️ Send Doctors Images WITH Names & Specializations
// ---------------------------------------------
async function sendDoctorsImages(to, language = "ar") {
  try {
    await sendTextMessage(
      to,
      language === "en"
        ? "👨‍⚕️ Meet our professional medical team:"
        : "👨‍⚕️ تعرف على فريقنا الطبي المتخصص:"
    );
    await new Promise((r) => setTimeout(r, 500));

    // Send each doctor image with their info as caption
    for (let i = 0; i < DOCTOR_IMAGES.length; i++) {
      const caption = `${DOCTOR_INFO[i].name}\n${DOCTOR_INFO[i].specialization}`;
      await sendImageMessage(to, DOCTOR_IMAGES[i], caption);
      if (i < DOCTOR_IMAGES.length - 1)
        await new Promise((r) => setTimeout(r, 800));
    }

    await new Promise((r) => setTimeout(r, 500));
    await sendTextMessage(
      to,
      language === "en"
        ? "✨ Our experienced doctors are here to provide you with the best care! To book an appointment, just let us know 😊"
        : "✨ أطباؤنا ذوو الخبرة هنا لتقديم أفضل رعاية لك! لحجز موعد، فقط أخبرنا 😊"
    );
  } catch (err) {
    console.error("❌ Doctors images error:", err.message);
  }
}

// --------------------------------------------
// Exports
// --------------------------------------------
module.exports = {
  sendLocationMessages,
  sendOffersImages,
  sendDoctorsImages,
  sendImageMessage,
  sendOffersValidity,
};
