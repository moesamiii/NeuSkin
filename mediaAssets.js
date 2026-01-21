/**
 * mediaAssets.js
 *
 * Purpose:
 * - Centralized storage for static media assets used across the bot.
 * - Keeps large lists (image URLs) separate from message-processing logic.
 *
 * Exports:
 * - OFFER_IMAGES (array of direct image links)
 * - DOCTOR_IMAGES (array of objects with url, name, and specialization)
 * - DOCTOR_INFO (array of doctor details)
 *
 * Usage:
 * - require('./mediaAssets') from messageHandlers.js or any other module that wants to send media.
 *
 * Note:
 * - Clinic name and location are now loaded from database (clinic_settings table)
 * - This file contains only static media data — no functions or network calls.
 */

const OFFER_IMAGES = [
  // Offer / services images (Google Drive direct links)
  "https://drive.google.com/uc?export=view&id=104QzzCy2U5ujhADK_SD0dGldowwlgVU2",
  "https://drive.google.com/uc?export=view&id=19EsrCSixVa_8trbzFF5lrZJqcue0quDW",
  "https://drive.google.com/uc?export=view&id=17jaUTvf_S2nqApqMlRc3r8q97uPulvDx",
];

const DOCTOR_IMAGES = [
  // Doctors images (Google Drive direct links)
  "https://drive.google.com/uc?export=view&id=1aHoA2ks39qeuMk9WMZOdotOod-agEonm",
  "https://drive.google.com/uc?export=view&id=1Oe2UG2Gas6UY0ORxXtUYvTJeJZ8Br2_R",
  "https://drive.google.com/uc?export=view&id=1_4eDWRuVme3YaLLoeFP_10LYHZyHyjUT",
];

// Doctor information corresponding to each image
const DOCTOR_INFO = [
  {
    name: "د. دلال محمد العجمي",
    specialization: "طبيب أسنان عام",
  },
  {
    name: "د. عبدالله سعيد الأسمري",
    specialization: "ستشاري تقويم الأسنان والوجه والفكين",
  },
  {
    name: "د. حمد أحمد الحازمي",
    specialization: "استشاري تقويم الأسنان والوجه والفكين",
  },
];

module.exports = {
  OFFER_IMAGES,
  DOCTOR_IMAGES,
  DOCTOR_INFO,
};
