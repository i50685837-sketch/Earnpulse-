// config/mpesa.js

require("dotenv").config();

const isProduction =
  process.env.MPESA_ENV === "production";

const mpesaConfig = {
  environment: isProduction
    ? "production"
    : "sandbox",

  consumerKey:
    process.env.MPESA_CONSUMER_KEY,

  consumerSecret:
    process.env.MPESA_CONSUMER_SECRET,

  shortcode:
    process.env.MPESA_SHORTCODE,

  passkey:
    process.env.MPESA_PASSKEY,

  callbackUrl:
    process.env.MPESA_CALLBACK_URL,

  accountReference:
    process.env.MPESA_ACCOUNT_REFERENCE ||
    "EarnPesa",

  transactionDescription:
    process.env.MPESA_TRANSACTION_DESC ||
    "EarnPesa Payment",

  oauthUrl: isProduction
    ? "https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials"
    : "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",

  stkPushUrl: isProduction
    ? "https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest"
    : "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest"
};

function validateConfig() {
  const required = {
    MPESA_CONSUMER_KEY:
      mpesaConfig.consumerKey,

    MPESA_CONSUMER_SECRET:
      mpesaConfig.consumerSecret,

    MPESA_SHORTCODE:
      mpesaConfig.shortcode,

    MPESA_PASSKEY:
      mpesaConfig.passkey,

    MPESA_CALLBACK_URL:
      mpesaConfig.callbackUrl
  };

  const missing = Object.entries(required)
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(
      `Missing M-Pesa configuration: ${missing.join(", ")}`
    );
  }
}

module.exports = {
  mpesaConfig,
  validateConfig
};
