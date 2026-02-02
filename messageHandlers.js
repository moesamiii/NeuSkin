/**
 * messageHandlers.js (FINAL FIX)
 *
 * This file only RE-EXPORTS functions from other modules.
 * The actual detection logic exists in detectionHelpers.js
 * and the media sending logic exists in mediaService.js
 */

const {
  // INTENT DETECTION
  isLocationRequest,
  isOffersRequest,
  isOffersConfirmation,
  isDoctorsRequest,
  isBookingRequest,
  isCancelRequest,

  // LANGUAGE & GREETING
  isEnglish,
  isGreeting,
  getGreeting,
} = require("./detectionHelpers");

const {
  // BANNED WORDS
  containsBanWords,
  sendBanWordsResponse,
} = require("./contentFilter");

const {
  // MEDIA SENDING
  sendLocationMessages,
  sendOffersImages,
  sendDoctorsImages,
  sendImageMessage,
  sendOffersValidity,
} = require("./mediaService");

const {
  // AUDIO TRANSCRIPTION
  transcribeAudio,
} = require("./transcriptionService");

// --------------------------------------------
// EXPORT EVERYTHING IN ONE CLEAN OBJECT
// --------------------------------------------
module.exports = {
  // Intent Detection
  isLocationRequest,
  isOffersRequest,
  isOffersConfirmation,
  isDoctorsRequest,
  isBookingRequest,
  isCancelRequest,
  isEnglish,
  isGreeting,
  getGreeting,

  // Content Filter
  containsBanWords,
  sendBanWordsResponse,

  // Media
  sendLocationMessages,
  sendOffersImages,
  sendDoctorsImages,
  sendImageMessage,
  sendOffersValidity,

  // Audio Transcription
  transcribeAudio,
};
