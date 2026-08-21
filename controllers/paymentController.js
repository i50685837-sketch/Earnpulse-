// controllers/paymentController.js

const {
  stkPush,
  normalizePhone,
  normalizeAmount
} = require("../services/mpesaService");

/*
|--------------------------------------------------------------------------
| Initiate M-Pesa STK Push
|--------------------------------------------------------------------------
| POST /api/payment/stkpush
|--------------------------------------------------------------------------
*/

async function initiateStkPush(req, res) {
  try {
    const {
      phone,
      amount,
      accountReference,
      transactionDesc
    } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required"
      });
    }

    if (
      amount === undefined ||
      amount === null ||
      amount === ""
    ) {
      return res.status(400).json({
        success: false,
        message: "Amount is required"
      });
    }

    const cleanPhone =
      normalizePhone(phone);

    const cleanAmount =
      normalizeAmount(amount);

    const result = await stkPush({
      phone: cleanPhone,
      amount: cleanAmount,
      accountReference:
        accountReference || "EarnPesa",
      transactionDesc:
        transactionDesc || "EarnPesa Deposit"
    });

    /*
     * Safaricom normally returns:
     *
     * ResponseCode
     * ResponseDescription
     * MerchantRequestID
     * CheckoutRequestID
     * CustomerMessage
     */

    if (
      result.ResponseCode !== undefined &&
      String(result.ResponseCode) !== "0"
    ) {
      return res.status(400).json({
        success: false,
        message:
          result.ResponseDescription ||
          "STK Push was not accepted",
        data: result
      });
    }

    return res.status(200).json({
      success: true,

      message:
        result.CustomerMessage ||
        "STK Push sent. Check your phone.",

      checkoutRequestId:
        result.CheckoutRequestID || null,

      merchantRequestId:
        result.MerchantRequestID || null,

      responseCode:
        result.ResponseCode,

      data: result
    });

  } catch (error) {

    console.error(
      "M-PESA STK ERROR:",
      error.response?.data ||
      error.message
    );

    return res.status(500).json({
      success: false,

      message:
        error.response?.data?.errorMessage ||
        error.response?.data?.ResponseDescription ||
        error.message ||
        "Unable to start M-Pesa payment"
    });
  }
}

/*
|--------------------------------------------------------------------------
| Safaricom Callback
|--------------------------------------------------------------------------
| POST /api/payment/callback
|--------------------------------------------------------------------------
*/

async function handleCallback(req, res) {
  try {
    const callback =
      req.body?.Body?.stkCallback;

    console.log(
      "M-PESA CALLBACK RECEIVED"
    );

    if (!callback) {
      console.log(
        "Invalid M-Pesa callback"
      );

      return res.status(200).json({
        ResultCode: 0,
        ResultDesc: "Accepted"
      });
    }

    const {
      MerchantRequestID,
      CheckoutRequestID,
      ResultCode,
      ResultDesc,
      CallbackMetadata
    } = callback;

    console.log({
      MerchantRequestID,
      CheckoutRequestID,
      ResultCode,
      ResultDesc
    });

    /*
    |--------------------------------------------------------------------------
    | Successful payment
    |--------------------------------------------------------------------------
    */

    if (Number(ResultCode) === 0) {

      const items =
        CallbackMetadata?.Item || [];

      const payment = {};

      for (const item of items) {
        if (item.Name) {
          payment[item.Name] =
            item.Value;
        }
      }

      const amount =
        payment.Amount || null;

      const receipt =
        payment.MpesaReceiptNumber ||
        null;

      const phone =
        payment.PhoneNumber ||
        null;

      const transactionDate =
        payment.TransactionDate ||
        null;

      console.log(
        "================================"
      );

      console.log(
        "M-PESA PAYMENT SUCCESS"
      );

      console.log(
        "Checkout:",
        CheckoutRequestID
      );

      console.log(
        "Amount:",
        amount
      );

      console.log(
        "Receipt:",
        receipt
      );

      console.log(
        "Phone:",
        phone
      );

      console.log(
        "Transaction Date:",
        transactionDate
      );

      console.log(
        "================================"
      );

      /*
       * IMPORTANT:
       *
       * This is where your database should be
       * updated.
       *
       * DO NOT credit a wallet when /stkpush
       * is called.
       *
       * Credit only after ResultCode === 0.
       *
       * Also make CheckoutRequestID and
       * MpesaReceiptNumber unique to prevent
       * duplicate wallet credits.
       */

    } else {

      console.log(
        "M-PESA PAYMENT FAILED/CANCELLED"
      );

      console.log(
        "Reason:",
        ResultDesc
      );
    }

    /*
     * Always acknowledge the callback.
     */

    return res.status(200).json({
      ResultCode: 0,
      ResultDesc: "Accepted"
    });

  } catch (error) {

    console.error(
      "M-PESA CALLBACK ERROR:",
      error.message
    );

    /*
     * Safaricom callback should receive
     * an acknowledgement response.
     */

    return res.status(200).json({
      ResultCode: 0,
      ResultDesc: "Accepted"
    });
  }
}

module.exports = {
  initiateStkPush,
  handleCallback
};
