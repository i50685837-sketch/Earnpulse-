"use strict";

require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

/*
|--------------------------------------------------------------------------
| APP
|--------------------------------------------------------------------------
*/

const app = express();

const PORT =
  process.env.PORT || 3000;


/*
|--------------------------------------------------------------------------
| DATABASE
|--------------------------------------------------------------------------
*/

const MONGO_URI =
  process.env.MONGO_URI;


/*
|--------------------------------------------------------------------------
| BASIC CONFIG
|--------------------------------------------------------------------------
*/

if (!MONGO_URI) {

  console.error(
    "❌ MONGO_URI is missing from .env"
  );

  process.exit(1);

}


/*
|--------------------------------------------------------------------------
| MIDDLEWARE
|--------------------------------------------------------------------------
*/

app.use(
  cors({
    origin: true,
    credentials: true
  })
);


app.use(
  express.json({
    limit: "1mb"
  })
);


app.use(
  express.urlencoded({
    extended: true,
    limit: "1mb"
  })
);


/*
|--------------------------------------------------------------------------
| SECURITY / REQUEST LOG
|--------------------------------------------------------------------------
*/

app.disable("x-powered-by");


app.use(
  (req, res, next) => {

    const start =
      Date.now();

    res.on(
      "finish",
      () => {

        const duration =
          Date.now() - start;

        console.log(
          `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`
        );

      }
    );

    next();

  }
);


/*
|--------------------------------------------------------------------------
| STATIC FILES
|--------------------------------------------------------------------------
*/

const publicPath =
  path.join(
    __dirname,
    "public"
  );


app.use(
  express.static(
    publicPath
  )
);


/*
|--------------------------------------------------------------------------
| DATABASE MODELS
|--------------------------------------------------------------------------
*/

const User =
  require("./models/User");

const Wallet =
  require("./models/Wallet");

const Payment =
  require("./models/Payment");


/*
|--------------------------------------------------------------------------
| ROUTES
|--------------------------------------------------------------------------
*/

const authRoutes =
  require("./routes/auth");

const paymentRoutes =
  require("./routes/payment");

const walletRoutes =
  require("./routes/wallet");

const profileRoutes =
  require("./routes/profile");


/*
|--------------------------------------------------------------------------
| API ROUTES
|--------------------------------------------------------------------------
*/

app.use(
  "/api/auth",
  authRoutes
);


app.use(
  "/api/payment",
  paymentRoutes
);


app.use(
  "/api/wallet",
  walletRoutes
);


app.use(
  "/api/profile",
  profileRoutes
);


/*
|--------------------------------------------------------------------------
| HOME
|--------------------------------------------------------------------------
*/

app.get(
  "/",
  (req, res) => {

    res.sendFile(
      path.join(
        publicPath,
        "login.html"
      )
    );

  }
);


/*
|--------------------------------------------------------------------------
| HEALTH CHECK
|--------------------------------------------------------------------------
*/

app.get(
  "/api/health",
  (req, res) => {

    res.status(200).json({

      success: true,

      service:
        "EarnPulse API",

      status:
        "online",

      database:
        mongoose.connection.readyState === 1
          ? "connected"
          : "disconnected",

      time:
        new Date().toISOString()

    });

  }
);


/*
|--------------------------------------------------------------------------
| API INFORMATION
|--------------------------------------------------------------------------
*/

app.get(
  "/api",
  (req, res) => {

    res.json({

      success: true,

      name:
        "EarnPulse API",

      version:
        "1.0.0",

      endpoints: {

        authentication: [
          "POST /api/auth/register",
          "POST /api/auth/login"
        ],

        wallet: [
          "GET /api/wallet"
        ],

        payment: [
          "POST /api/payment/stkpush",
          "POST /api/payment/callback"
        ],

        profile: [
          "GET /api/profile"
        ]

      }

    });

  }
);


/*
|--------------------------------------------------------------------------
| DATABASE STARTUP
|--------------------------------------------------------------------------
*/

async function connectDatabase() {

  try {

    console.log(
      "🔄 Connecting to MongoDB..."
    );


    await mongoose.connect(
      MONGO_URI,
      {
        serverSelectionTimeoutMS: 10000
      }
    );


    console.log(
      "✅ MongoDB connected"
    );


    /*
    |--------------------------------------------------------------------------
    | DATABASE EVENTS
    |--------------------------------------------------------------------------
    */

    mongoose.connection.on(
      "error",
      (error) => {

        console.error(
          "❌ MongoDB error:",
          error.message
        );

      }
    );


    mongoose.connection.on(
      "disconnected",
      () => {

        console.warn(
          "⚠️ MongoDB disconnected"
        );

      }
    );


    mongoose.connection.on(
      "reconnected",
      () => {

        console.log(
          "✅ MongoDB reconnected"
        );

      }
    );


  } catch (error) {

    console.error(
      "❌ MongoDB connection failed:"
    );

    console.error(
      error.message
    );

    process.exit(1);

  }

}


/*
|--------------------------------------------------------------------------
| CREATE WALLET FOR EXISTING USERS
|--------------------------------------------------------------------------
|
| This is optional protection for accounts created before the wallet
| system was added.
|--------------------------------------------------------------------------
*/

async function ensureWalletForUsers() {

  try {

    const users =
      await User.find({})
        .select("_id");


    let created =
      0;


    for (
      const user of users
    ) {

      const existing =
        await Wallet.findOne({
          userId: user._id
        });


      if (!existing) {

        await Wallet.create({

          userId:
            user._id,

          balance:
            0,

          totalDeposits:
            0,

          totalWithdrawals:
            0,

          activated:
            false

        });


        created++;

      }

    }


    if (created > 0) {

      console.log(
        `✅ Created ${created} missing wallet(s)`
      );

    }

  } catch (error) {

    console.error(
      "⚠️ Wallet initialization error:",
      error.message
    );

  }

}


/*
|--------------------------------------------------------------------------
| 404 HANDLER
|--------------------------------------------------------------------------
*/

app.use(
  (req, res, next) => {

    /*
     * API request
     */

    if (
      req.originalUrl.startsWith(
        "/api/"
      )
    ) {

      return res.status(404).json({

        success: false,

        message:
          "API route not found",

        path:
          req.originalUrl

      });

    }


    /*
     * Browser request
     */

    res.status(404).send(
      `
      <!DOCTYPE html>

      <html>

      <head>

        <meta charset="UTF-8">

        <meta
          name="viewport"
          content="width=device-width,initial-scale=1"
        >

        <title>EarnPulse • 404</title>

        <style>

          body{
            margin:0;
            min-height:100vh;
            display:flex;
            align-items:center;
            justify-content:center;
            background:#071a14;
            color:white;
            font-family:Arial;
            text-align:center;
          }

          .box{
            padding:30px;
          }

          h1{
            font-size:60px;
            margin:0 0 10px;
          }

          a{
            color:#19c978;
            text-decoration:none;
          }

        </style>

      </head>

      <body>

        <div class="box">

          <h1>404</h1>

          <p>
            Page not found.
          </p>

          <a href="/">
            Return to EarnPulse
          </a>

        </div>

      </body>

      </html>
      `
    );

  }
);


/*
|--------------------------------------------------------------------------
| GLOBAL ERROR HANDLER
|--------------------------------------------------------------------------
*/

app.use(
  (
    error,
    req,
    res,
    next
  ) => {

    console.error(
      "🔥 SERVER ERROR:"
    );

    console.error(
      error
    );


    if (res.headersSent) {

      return next(error);

    }


    const status =
      error.status ||
      500;


    res.status(status).json({

      success: false,

      message:
        status === 500
          ? "Internal server error"
          : error.message

    });

  }
);


/*
|--------------------------------------------------------------------------
| GRACEFUL SHUTDOWN
|--------------------------------------------------------------------------
*/

async function shutdown(
  signal
) {

  console.log(
    `\n${signal} received. Shutting down...`
  );


  try {

    await mongoose.connection.close();

    console.log(
      "✅ MongoDB connection closed"
    );


    process.exit(0);

  } catch (error) {

    console.error(
      "❌ Shutdown error:",
      error.message
    );

    process.exit(1);

  }

}


process.on(
  "SIGINT",
  () => shutdown("SIGINT")
);


process.on(
  "SIGTERM",
  () => shutdown("SIGTERM")
);


/*
|--------------------------------------------------------------------------
| UNHANDLED ERRORS
|--------------------------------------------------------------------------
*/

process.on(
  "unhandledRejection",
  (reason) => {

    console.error(
      "❌ Unhandled Promise Rejection:"
    );

    console.error(
      reason
    );

  }
);


process.on(
  "uncaughtException",
  (error) => {

    console.error(
      "❌ Uncaught Exception:"
    );

    console.error(
      error
    );

  }
);


/*
|--------------------------------------------------------------------------
| START SERVER
|--------------------------------------------------------------------------
*/

async function startServer() {

  await connectDatabase();

  await ensureWalletForUsers();


  app.listen(
    PORT,
    "0.0.0.0",
    () => {

      console.log("");
      console.log(
        "===================================="
      );

      console.log(
        "        EARNPULSE SERVER"
      );

      console.log(
        "===================================="
      );

      console.log(
        `🚀 Port: ${PORT}`
      );

      console.log(
        `🌐 Local: http://localhost:${PORT}`
      );

      console.log(
        `❤️ Health: http://localhost:${PORT}/api/health`
      );

      console.log(
        `📡 API: http://localhost:${PORT}/api`
      );

      console.log(
        "💳 M-Pesa routes loaded"
      );

      console.log(
        "🔐 Authentication routes loaded"
      );

      console.log(
        "💰 Wallet routes loaded"
      );

      console.log(
        "===================================="
      );

      console.log("");

    }
  );

}


/*
|--------------------------------------------------------------------------
| BOOT
|--------------------------------------------------------------------------
*/

startServer();
