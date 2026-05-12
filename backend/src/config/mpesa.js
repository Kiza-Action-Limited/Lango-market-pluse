const axios = require('axios');

/**
 * Generates OAuth access token for M-Pesa API.
 * @returns {Promise<string>} Access token
 */
const getAccessToken = async () => {
  const consumerKey = process.env.MPESA_CONSUMER_KEY;
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');

  try {
    const response = await axios.get(
      'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
      {
        headers: { Authorization: `Basic ${auth}` },
      }
    );
    return response.data.access_token;
  } catch (error) {
    console.error('M-Pesa token error:', error.response?.data || error.message);
    throw new Error('Failed to generate M-Pesa access token');
  }
};

/**
 * Initiate STK Push (Lipa Na M-Pesa Online)
 * @param {string} phoneNumber - Customer phone number (2547XXXXXXXX)
 * @param {number} amount - Amount to charge
 * @param {string} accountReference - Order ID or reference
 * @param {string} transactionDesc - Description
 * @returns {Promise<object>} STK push response
 */
const stkPush = async (phoneNumber, amount, accountReference, transactionDesc) => {
  const token = await getAccessToken();
  const timestamp = getTimestamp();
  const password = Buffer.from(
    `${process.env.MPESA_SHORTCODE}${process.env.MPESA_PASSKEY}${timestamp}`
  ).toString('base64');

  const data = {
    BusinessShortCode: process.env.MPESA_SHORTCODE,
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: amount,
    PartyA: phoneNumber,
    PartyB: process.env.MPESA_SHORTCODE,
    PhoneNumber: phoneNumber,
    CallBackURL: `${process.env.BASE_URL}/webhooks/mpesa/callback`,
    AccountReference: accountReference,
    TransactionDesc: transactionDesc,
  };

  try {
    const response = await axios.post(
      'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
      data,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  } catch (error) {
    console.error('STK Push error:', error.response?.data || error.message);
    throw new Error('STK Push failed');
  }
};

/**
 * Query the status of an STK push transaction.
 * @param {string} checkoutRequestID - From stkPush response
 * @returns {Promise<object>} Query result
 */
const queryStatus = async (checkoutRequestID) => {
  const token = await getAccessToken();
  const timestamp = getTimestamp();
  const password = Buffer.from(
    `${process.env.MPESA_SHORTCODE}${process.env.MPESA_PASSKEY}${timestamp}`
  ).toString('base64');

  const data = {
    BusinessShortCode: process.env.MPESA_SHORTCODE,
    Password: password,
    Timestamp: timestamp,
    CheckoutRequestID: checkoutRequestID,
  };

  try {
    const response = await axios.post(
      'https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query',
      data,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  } catch (error) {
    console.error('Query status error:', error.response?.data || error.message);
    throw new Error('Failed to query transaction status');
  }
};

/**
 * Helper: Generate timestamp in format YYYYMMDDHHmmss
 */
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

module.exports = {
  getAccessToken,
  stkPush,
  queryStatus,
};