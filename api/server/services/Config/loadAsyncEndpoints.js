const path = require('path');
const { logger } = require('@librechat/data-schemas');
const { loadServiceKey, isUserProvided } = require('@librechat/api');
const { config } = require('./EndpointService');

async function loadAsyncEndpoints() {
  let serviceKey, googleUserProvides;
  const { googleKey } = config;

  /** Check if GOOGLE_KEY is provided at all(including 'user_provided') */
  const isGoogleKeyProvided = googleKey && googleKey.trim() !== '';

  const geminiApiKey = process.env.GEMINI_API_KEY?.trim?.() ?? '';
  const isGeminiApiKeyProvided = geminiApiKey.length > 0;

  if (isGoogleKeyProvided) {
    /** If GOOGLE_KEY is provided, check if it's user_provided */
    googleUserProvides = isUserProvided(googleKey);
  } else {
    /** Only attempt to load service key if GOOGLE_KEY is not provided */
    const serviceKeyPath =
      process.env.GOOGLE_SERVICE_KEY_FILE || path.join(__dirname, '../../..', 'data', 'auth.json');

    try {
      serviceKey = await loadServiceKey(serviceKeyPath);
    } catch (error) {
      logger.error('Error loading service key', error);
      serviceKey = null;
    }
  }

  /** Expose Google (Gemini) in the UI when GOOGLE_KEY, GEMINI_API_KEY, or a Vertex service key is configured */
  const googleEnabled =
    Boolean(serviceKey) || isGoogleKeyProvided || isGeminiApiKeyProvided;
  const google = googleEnabled ? { userProvide: googleUserProvides === true } : false;

  return { google };
}

module.exports = loadAsyncEndpoints;
