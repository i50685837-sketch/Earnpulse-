const express = require("express");

const router = express.Router();

const {
  initiateStkPush,
  handleCallback
} = require("../controllers/paymentController");

/*
|--------------------------------------------------------------------------
| M-Pesa STK Push
|--------------------------------------------------------------------------
|
| POST /api/payment/stkpush
|
| Body:
| {
|   "phone": "0712345678",
|   "amount": 100,
|   "accountReference": "EarnPesa",
|   "transactionDesc": "EarnPesa Deposit"
| }
|
*/

router.post(
  "/stkpush",
  initiateStkPush
);

/*
|--------------------------------------------------------------------------
| Safaricom M-Pesa Callback
|--------------------------------------------------------------------------
|
| POST /api/payment/callback
|
| Safaricom sends the STK transaction result
| to this endpoint.
|
*/

router.post(
  "/callback",
  handleCallback
);

module.exports = router;
