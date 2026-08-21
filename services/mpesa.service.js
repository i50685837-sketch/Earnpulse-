const axios = require('axios');
const logger = require('../utils/logger');

const {
  MPESA_ENV,                 // 'sandbox' | 'production'
  MPESA_CONSUMER_KEY,
  MPESA_CONSUMER_SECRET,
  MPESA_SHORTCODE,            // Paybill/Till (STK)
  MPESA_PASSKEY,               // Lipa Na M-Pesa passkey (STK)
  MPESA_STK_CALLBACK_URL,      // https://yourdomain.com/api/wallet/mpesa/stk-callback
  MPESA_INITIATOR_NAME,        // B2C initiator username
  MPESA_INITIATOR_PASSWORD,    // B2C initiator password (plaintext, gets encrypted below)
  MPESA_B2C_SHORTCODE,         // B2C-enabled shortcode (may differ from paybill)
  MPESA_B2C_RESULT_URL,        // https://yourdomain.com/api/wallet/mpesa/b2c-result
  MPESA_B2C_TIMEOUT_URL,       // https://yourdomain.com/api/wallet/mpesa/b2c-timeout
  MPESA_CERT_PATH               // path to Daraja public cert (.cer) for encrypting initiator password
} = process.env;

const BASE_URL = MPESA_ENV === 'production'
  ? 'https://api.safaricom.co.ke'
  : 'https://sandbox.safaricom.co.ke';

/* ------------------------------------------------------------------ */
/*  OAuth token — cached in memory until near expiry                  */
/* ------------------------------------------------------------------ */
let cachedToken = null;
let tokenExpiresAt = 0;

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  const auth = Buffer.from(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`).toString('base64');

  const { data } = await axios.get(
    `${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { Authorization: `Basic ${auth}` } }
  );

  cachedToken = data.access_token;
  // Daraja tokens last 3600s — refresh 60s early to be safe
  tokenExpiresAt = Date.now() + (Number(data.expires_in) - 60) * 1000;

  return cachedToken;
}

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return (
    d.getFullYear().toString() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

/* ------------------------------------------------------------------ */
/*  STK Push (Lipa Na M-Pesa Online) — for deposits                   */
/* ------------------------------------------------------------------ */
exports.stkPush = async ({ phone, amount, accountReference, transactionDesc }) => {
  const token = await getAccessToken();
  const ts = timestamp();
  const password = Buffer.from(`${MPESA_SHORTCODE}${MPESA_PASSKEY}${ts}`).toString('base64');

  const payload = {
    BusinessShortCode: MPESA_SHORTCODE,
    Password: password,
    Timestamp: ts,
    TransactionType: 'CustomerPayBillOnline',
    Amount: amount,
    PartyA: phone,
    PartyB: MPESA_SHORTCODE,
    PhoneNumber: phone,
    CallBackURL: MPESA_STK_CALLBACK_URL,
    AccountReference: accountReference.slice(0, 12), // Daraja caps this at 12 chars
    TransactionDesc: transactionDesc
  };

  try {
    const { data } = await axios.post(`${BASE_URL}/mpesa/stkpush/v1/processrequest`, payload, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return data; // { MerchantRequestID, CheckoutRequestID, ResponseCode, ResponseDescription, CustomerMessage }
  } catch (err) {
    logger.error('stkPush request failed', err.response?.data || err.message);
    throw new Error(err.response?.data?.errorMessage || 'STK push request failed');
  }
};

/* ------------------------------------------------------------------ */
/*  STK query — optional fallback if callback is delayed/lost         */
/* ------------------------------------------------------------------ */
exports.stkQuery = async (checkoutRequestId) => {
  const token = await getAccessToken();
  const ts = timestamp();
  const password = Buffer.from(`${MPESA_SHORTCODE}${MPESA_PASSKEY}${ts}`).toString('base64');

  const payload = {
    BusinessShortCode: MPESA_SHORTCODE,
    Password: password,
    Timestamp: ts,
    CheckoutRequestID: checkoutRequestId
  };

  try {
    const { data } = await axios.post(`${BASE_URL}/mpesa/stkpushquery/v1/query`, payload, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return data; // { ResultCode, ResultDesc, ... }
  } catch (err) {
    logger.error('stkQuery failed', err.response?.data || err.message);
    throw new Error('STK status query failed');
  }
};

/* ------------------------------------------------------------------ */
/*  Encrypt initiator password with Daraja's public certificate       */
/*  Required for every B2C request (SecurityCredential field)         */
/* ------------------------------------------------------------------ */
function encryptInitiatorPassword() {
  const fs = require('fs');
  const crypto = require('crypto');

  const cert = fs.readFileSync(MPESA_CERT_PATH, 'utf8');
  const buffer = Buffer.from(MPESA_INITIATOR_PASSWORD, 'utf8');
  const encrypted = crypto.publicEncrypt(
    { key: cert, padding: crypto.constants.RSA_PKCS1_PADDING },
    buffer
  );
  return encrypted.toString('base64');
}

/* ------------------------------------------------------------------ */
/*  B2C Payment — for withdrawals                                     */
/* ------------------------------------------------------------------ */
exports.b2cPayment = async ({ phone, amount, remarks, occasionRef }) => {
  const token = await getAccessToken();

  const payload = {
    InitiatorName: MPESA_INITIATOR_NAME,
    SecurityCredential: encryptInitiatorPassword(),
    CommandID: 'BusinessPayment',
    Amount: amount,
    PartyA: MPESA_B2C_SHORTCODE,
    PartyB: phone,
    Remarks: remarks.slice(0, 100),
    QueueTimeOutURL: MPESA_B2C_TIMEOUT_URL,
    ResultURL: MPESA_B2C_RESULT_URL,
    Occasion: (occasionRef || '').slice(0, 100)
  };

  try {
    const { data } = await axios.post(`${BASE_URL}/mpesa/b2c/v1/paymentrequest`, payload, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return data; // { ConversationID, OriginatorConversationID, ResponseCode, ResponseDescription }
  } catch (err) {
    logger.error('b2cPayment request failed', err.response?.data || err.message);
    throw new Error(err.response?.data?.errorMessage || 'B2C payment request failed');
  }
};
    
