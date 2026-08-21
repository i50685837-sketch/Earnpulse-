"use strict";

const jwt = require("jsonwebtoken");

const JWT_SECRET =
  process.env.JWT_SECRET;


/*
|--------------------------------------------------------------------------
| Authentication Middleware
|--------------------------------------------------------------------------
| Protects routes such as:
|
| GET  /api/wallet
| GET  /api/profile
| POST /api/payment/stkpush
|
| The client must send:
|
| Authorization: Bearer YOUR_TOKEN
|--------------------------------------------------------------------------
*/

module.exports = function auth(req, res, next) {

  try {

    /*
    |--------------------------------------------------------------------------
    | Check JWT secret
    |--------------------------------------------------------------------------
    */

    if (!JWT_SECRET) {

      console.error(
        "❌ JWT_SECRET is missing from environment variables."
      );

      return res.status(500).json({

        success: false,

        message:
          "Server authentication configuration is missing."

      });

    }


    /*
    |--------------------------------------------------------------------------
    | Get Authorization Header
    |--------------------------------------------------------------------------
    */

    const authHeader =
      req.headers.authorization;


    if (!authHeader) {

      return res.status(401).json({

        success: false,

        message:
          "Authentication required."

      });

    }


    /*
    |--------------------------------------------------------------------------
    | Validate Bearer Token
    |--------------------------------------------------------------------------
    */

    if (
      !authHeader.startsWith("Bearer ")
    ) {

      return res.status(401).json({

        success: false,

        message:
          "Invalid authorization format."

      });

    }


    /*
    |--------------------------------------------------------------------------
    | Extract Token
    |--------------------------------------------------------------------------
    */

    const token =
      authHeader
        .split(" ")[1];


    if (!token) {

      return res.status(401).json({

        success: false,

        message:
          "Authentication token is missing."

      });

    }


    /*
    |--------------------------------------------------------------------------
    | Verify JWT
    |--------------------------------------------------------------------------
    */

    const decoded =
      jwt.verify(
        token,
        JWT_SECRET
      );


    /*
    |--------------------------------------------------------------------------
    | Validate User ID
    |--------------------------------------------------------------------------
    */

    const userId =
      decoded.id ||
      decoded.userId;


    if (!userId) {

      return res.status(401).json({

        success: false,

        message:
          "Invalid authentication token."

      });

    }


    /*
    |--------------------------------------------------------------------------
    | Attach User Information
    |--------------------------------------------------------------------------
    |
    | Controllers can now use:
    |
    | req.user.id
    |
    |--------------------------------------------------------------------------
    */

    req.user = {

      id: userId,

      userId: userId

    };


    /*
    |--------------------------------------------------------------------------
    | Continue
    |--------------------------------------------------------------------------
    */

    next();


  } catch (error) {

    console.error(
      "AUTH MIDDLEWARE ERROR:",
      error.message
    );


    /*
    |--------------------------------------------------------------------------
    | Expired Token
    |--------------------------------------------------------------------------
    */

    if (
      error.name ===
      "TokenExpiredError"
    ) {

      return res.status(401).json({

        success: false,

        message:
          "Your session has expired. Please login again."

      });

    }


    /*
    |--------------------------------------------------------------------------
    | Invalid Token
    |--------------------------------------------------------------------------
    */

    if (
      error.name ===
      "JsonWebTokenError"
    ) {

      return res.status(401).json({

        success: false,

        message:
          "Invalid authentication token."

      });

    }


    /*
    |--------------------------------------------------------------------------
    | General Error
    |--------------------------------------------------------------------------
    */

    return res.status(401).json({

      success: false,

      message:
        "Authentication failed."

    });

  }

};
