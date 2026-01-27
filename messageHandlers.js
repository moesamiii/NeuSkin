/**
 * messageHandlers.js (FINAL FIX - ES6 VERSION)
 *
 * This file only RE-EXPORTS functions from other modules.
 * The actual detection logic exists in detectionHelpers.js
 * and the media sending logic exists in mediaService.js
 */

// INTENT DETECTION
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
} from "./detectionHelpers.js";

// BANNED WORDS
import { containsBanWords, sendBanWordsResponse } from "./contentFilter.js";

// MEDIA SENDING
import {
  sendLocationMessages,
  sendOffersImages,
  sendDoctorsImages,
  sendImageMessage,
  sendOffersValidity,
} from "./mediaService.js";

// AUDIO TRANSCRIPTION
import { transcribeAudio } from "./transcriptionService.js";

// --------------------------------------------
// EXPORT EVERYTHING
// --------------------------------------------
export {
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
