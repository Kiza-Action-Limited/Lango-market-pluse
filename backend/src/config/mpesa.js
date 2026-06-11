const axios = require('axios');

const MPESA_BASE_URL = process.env.MPESA_ENV === 'production'
  ? 'https://api.safaricom.co.ke'
  : 'https://sandbox.safaricom.co.ke';

let tokenCache = { token: null, expiresAt: 0 };

const getTimestamp = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
};

const normalizeMpesaPhone = (phoneNumber) => String(phoneNumber || '')
  .trim()
  .replace(/^\+/, '')
  .replace(/^0/, '254');

const getAccessToken = async () => {
  if (tokenCache.token && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token;
  }

  const consumerKey = process.env.MPESA_CONSUMER_KEY;
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');

  try {
    const response = await axios.get(
      `${MPESA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
      { headers: { Authorization: `Basic ${auth}` } }
    );

    tokenCache = {
      token: response.data.access_token,
      expiresAt: Date.now() + 3540000,
    };

    return tokenCache.token;
  } catch (error) {
    console.error('M-Pesa token error:', error.response?.data || error.message);
    throw new Error('Failed to generate M-Pesa access token');
  }
};

const stkPush = async (phoneNumber, amount, accountReference, transactionDesc) => {
  const token = await getAccessToken();
  const timestamp = getTimestamp();
  const password = Buffer.from(
    `${process.env.MPESA_SHORTCODE}${process.env.MPESA_PASSKEY}${timestamp}`
  ).toString('base64');

  const payload = {
    BusinessShortCode: process.env.MPESA_SHORTCODE,
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: Math.ceil(Number(amount)),
    PartyA: normalizeMpesaPhone(phoneNumber),
    PartyB: process.env.MPESA_SHORTCODE,
    PhoneNumber: normalizeMpesaPhone(phoneNumber),
    CallBackURL: process.env.MPESA_STK_CALLBACK_URL || `${process.env.BASE_URL}/webhooks/mpesa/callback`,
    AccountReference: accountReference,
    TransactionDesc: transactionDesc,
  };

  try {
    const response = await axios.post(
      `${MPESA_BASE_URL}/mpesa/stkpush/v1/processrequest`,
      payload,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  } catch (error) {
    console.error('STK Push error:', error.response?.data || error.message);
    throw new Error('STK Push failed');
  }
};

const queryStatus = async (checkoutRequestID) => {
  const token = await getAccessToken();
  const timestamp = getTimestamp();
  const password = Buffer.from(
    `${process.env.MPESA_SHORTCODE}${process.env.MPESA_PASSKEY}${timestamp}`
  ).toString('base64');

  const payload = {
    BusinessShortCode: process.env.MPESA_SHORTCODE,
    Password: password,
    Timestamp: timestamp,
    CheckoutRequestID: checkoutRequestID,
  };

  try {
    const response = await axios.post(
      `${MPESA_BASE_URL}/mpesa/stkpushquery/v1/query`,
      payload,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  } catch (error) {
    console.error('Query status error:', error.response?.data || error.message);
    throw new Error('Failed to query transaction status');
  }
};

const b2cPayment = async ({ phoneNumber, amount, remarks, occasion, originatorConversationId }) => {
  const token = await getAccessToken();
  const payload = {
    OriginatorConversationID: originatorConversationId,
    InitiatorName: process.env.MPESA_INITIATOR_NAME,
    SecurityCredential: process.env.MPESA_INITIATOR_CREDENTIAL,
    CommandID: 'BusinessPayment',
    Amount: Math.ceil(Number(amount)),
    PartyA: process.env.MPESA_SHORTCODE,
    PartyB: normalizeMpesaPhone(phoneNumber),
    Remarks: remarks || 'Lango MarketPulse payout',
    QueueTimeOutURL: process.env.MPESA_B2C_TIMEOUT_URL,
    ResultURL: process.env.MPESA_B2C_RESULT_URL,
    Occasion: occasion || 'Escrow release',
  };

  try {
    const response = await axios.post(
      `${MPESA_BASE_URL}/mpesa/b2c/v1/paymentrequest`,
      payload,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  } catch (error) {
    console.error('B2C payout error:', error.response?.data || error.message);
    throw new Error('B2C payout failed');
  }
};

const extractStkMetadata = (stkCallback = {}) => {
  const items = stkCallback.CallbackMetadata?.Item || [];
  const metadata = items.reduce((acc, item) => {
    acc[item.Name] = item.Value;
    return acc;
  }, {});

  return {
    amount: metadata.Amount,
    mpesaReceiptNumber: metadata.MpesaReceiptNumber,
    transactionDate: metadata.TransactionDate,
    phoneNumber: metadata.PhoneNumber,
  };
};

module.exports = {
  MPESA_BASE_URL,
  getAccessToken,
  stkPush,
  queryStatus,
  b2cPayment,
  extractStkMetadata,
  normalizeMpesaPhone,
};
