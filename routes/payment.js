"use strict";

const express = require("express");
const router = express.Router();

/*
|--------------------------------------------------------------------------
| M-PESA SERVICE
|--------------------------------------------------------------------------
|
| Update this path/name if your project uses a different service file.
|--------------------------------------------------------------------------
*/

const mpesaService =
  require("../services/mpesaService");


/*
|--------------------------------------------------------------------------
| AUTH MIDDLEWARE
|--------------------------------------------------------------------------
|
| Update the path if your authentication middleware is elsewhere.
|--------------------------------------------------------------------------
*/

const auth =
  require("../middleware/auth");


/*
|--------------------------------------------------------------------------
| VALIDATE PHONE
|--------------------------------------------------------------------------
*/

function normalizePhone(phone) {

  phone =
    String(phone || "")
      .trim()
      .replace(/\s+/g, "");

  if (phone.startsWith("+254")) {
    phone = phone.substring(1);
  }

  if (
    phone.startsWith("07") ||
    phone.startsWith("01")
  ) {
    phone =
      "254" +
      phone.substring(1);
  }

  return phone;
}


/*
|--------------------------------------------------------------------------
| STK PUSH
|--------------------------------------------------------------------------
|
| POST /api/payment/stkpush
|
| Body:
|
| {
|   "phoneNumber": "0712345678",
|   "amount": 100
| }
|--------------------------------------------------------------------------
*/

router.post(
  "/stkpush",
  auth,
  async (req, res) => {

    try {

      const {
        phoneNumber,
        amount
      } = req.body;


      /*
      |--------------------------------------------------------------------------
      | VALIDATION
      |--------------------------------------------------------------------------
      */

      const phone =
        normalizePhone(
          phoneNumber
        );

      const paymentAmount =
        Number(amount);


      if (
        !/^254(7|1)\d{8}$/.test(
          phone
        )
      ) {

        return res.status(400).json({

          success: false,

          message:
            "Enter a valid Kenyan M-Pesa phone number."

        });

      }


      if (
        !Number.isFinite(
          paymentAmount
        ) ||
        paymentAmount <= 0
      ) {

        return res.status(400).json({

          success: false,

          message:
            "Enter a valid payment amount."

        });

      }


      /*
      |--------------------------------------------------------------------------
      | START STK PUSH
      |--------------------------------------------------------------------------
      */

      const result =
        await mpesaService.stkPush({

          phoneNumber:
            phone,

          amount:
            paymentAmount,

          accountReference:
            `EARNPULSE-${req.user._id}`,

          transactionDesc:
            "EarnPulse Wallet Deposit"

        });


      /*
      |--------------------------------------------------------------------------
      | RESPONSE
      |--------------------------------------------------------------------------
      */

      return res.status(200).json({

        success: true,

        message:
          result.message ||
          "STK Push sent successfully. Check your M-Pesa phone.",

        data:
          result

      });


    } catch (error) {

      console.error(
        "❌ STK Push error:",
        error.message
      );


      return res.status(500).json({

        success: false,

        message:
          error.message ||
          "Unable to initiate M-Pesa payment."

      });

    }

  }
);


/*
|--------------------------------------------------------------------------
| M-PESA CALLBACK
|--------------------------------------------------------------------------
|
| POST /api/payment/callback
|
| IMPORTANT:
| Do not credit the wallet merely because STK Push was initiated.
| Credit only after the callback/payment status confirms success.
|--------------------------------------------------------------------------
*/

router.post(
  "/callback",
  async (req, res) => {

    try {

      console.log(
        "📥 M-Pesa callback received"
      );

      console.log(
        JSON.stringify(
          req.body,
          null,
          2
        )
      );


      /*
      |--------------------------------------------------------------------------
      | ACKNOWLEDGE CALLBACK
      |--------------------------------------------------------------------------
      */

      return res.status(200).json({

        ResultCode: 0,

        ResultDesc:
          "Callback received successfully"

      });


    } catch (error) {

      console.error(
        "❌ M-Pesa callback error:",
        error.message
      );


      return res.status(200).json({

        ResultCode: 0,

        ResultDesc:
          "Callback received"

      });

    }

  }
);


/*
|--------------------------------------------------------------------------
| EXPORT
|--------------------------------------------------------------------------
*/

module.exports =
  router;
