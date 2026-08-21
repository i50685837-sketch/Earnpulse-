// services/mpesaService.js

const axios = require("axios");
const {
  mpesaConfig
} = require("../config/mpesa");

let cachedToken = null;
let tokenExpiresAt = 0;

async function getAccessToken() {
  const now = Date.now();

  // Reuse token until shortly before expiry
  if (cachedToken && now < tokenExpiresAt - 60000) {
    return cachedToken;
  }

  const auth = Buffer.from(
    `${mpesaConfig.consumerKey}:${mpesaConfig.consumerSecret}`
  ).toString("base64");

  const response = await axios.get(
    mpesaConfig.oauthUrl,
    {
      headers: {
        Authorization: `Basic ${auth}`
      },
      timeout: 10000
    }
  );

  cachedToken = response.data.access_token;

  const expiresIn =
    Number(response.data.expires_in) || 3599;

  tokenExpiresAt =
    Date.now() + expiresIn * 1000;

  return cachedToken;
}

function normalizePhone(phone) {
  let number = String(phone || "")
    .replace(/\s+/g, "")
    .replace(/-/g, "");

  if (number.startsWith("+254")) {
    number = number.substring(1);
  }

  if (number.startsWith("07") ||
      number.startsWith("01")) {
    number = "254" + number.substring(1);
  }

  if (!/^254[17][0-9]{8}$/.test(number)) {
    throw new Error(
      "Invalid Kenyan M-Pesa phone number"
    );
  }

  return number;
}

function normalizeAmount(amount) {
  const value = Number(amount);

  if (!Number.isFinite(value)) {
    throw new Error("Invalid payment amount");
  }

  const result = Math.floor(value);

  if (result < 1) {
    throw new Error(
      "Payment amount must be at least KES 1"
    );
  }

  return result;
}

function generateTimestamp() {
  const date = new Date();

  const parts = new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone: "Africa/Nairobi",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }
  ).formatToParts(date);

  const get = type =>
    parts.find(p => p.type === type)?.value;

  return (
    get("year") +
    get("month") +
    get("day") +
    get("hour") +
    get("minute") +
    get("second")
  );
}

async function stkPush({
  phone,
  amount,
  accountReference = "EarnPesa",
  transactionDesc = "EarnPesa Deposit"
}) {
  const token = await getAccessToken();

  const phoneNumber =
    normalizePhone(phone);

  const paymentAmount =
    normalizeAmount(amount);

  const timestamp =
    generateTimestamp();

  const password = Buffer.from(
    `${mpesaConfig.shortcode}${mpesaConfig.passkey}${timestamp}`
  ).toString("base64");

  const payload = {
    BusinessShortCode:
      mpesaConfig.shortcode,

    Password: password,

    Timestamp: timestamp,

    TransactionType:
      "CustomerPayBillOnline",

    Amount: paymentAmount,

    PartyA: phoneNumber,

    PartyB:
      mpesaConfig.shortcode,

    PhoneNumber:
      phoneNumber,

    CallBackURL:
      mpesaConfig.callbackUrl,

    AccountReference:
      String(accountReference)
        .substring(0, 12),

    TransactionDesc:
      String(transactionDesc)
        .substring(0, 13)
  };

  const response = await axios.post(
    mpesaConfig.stkPushUrl,
    payload,
    {
      headers: {
        Authorization:
          `Bearer ${token}`,

        "Content-Type":
          "application/json"
      },

      timeout: 15000
    }
  );

  return response.data;
}

module.exports = {
  getAccessToken,
  stkPush,
  normalizePhone,
  normalizeAmount
};
