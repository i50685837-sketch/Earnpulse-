// server.js

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");

const {
  validateConfig
} = require("./config/mpesa");

const paymentRoutes =
  require("./routes/payment");

const app = express();

const PORT =
  process.env.PORT || 3000;

/*
|--------------------------------------------------------------------------
| DATABASE
|--------------------------------------------------------------------------
*/

async function connectDatabase() {
  if (!process.env.MONGO_URI) {
    throw new Error(
      "MONGO_URI is missing from .env"
    );
  }

  await mongoose.connect(
    process.env.MONGO_URI,
    {
      serverSelectionTimeoutMS: 10000
    }
  );

  console.log("✅ MongoDB Connected");
}

/*
|--------------------------------------------------------------------------
| MIDDLEWARE
|--------------------------------------------------------------------------
*/

app.use(
  cors({
    origin: "*",
    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS"
    ],
    allowedHeaders: [
      "Content-Type",
      "Authorization"
    ]
  })
);

app.use(
  express.json({
    limit: "1mb"
  })
);

app.use(
  express.urlencoded({
    extended: true
  })
);

/*
|--------------------------------------------------------------------------
| STATIC FRONTEND
|--------------------------------------------------------------------------
*/

app.use(
  express.static(
    path.join(__dirname, "public")
  )
);

/*
|--------------------------------------------------------------------------
| HEALTH CHECK
|--------------------------------------------------------------------------
*/

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    server: "EarnPesa",
    status: "online",
    database:
      mongoose.connection.readyState === 1
        ? "connected"
        : "disconnected",
    mpesa:
      process.env.MPESA_ENV ||
      "sandbox",
    time: new Date().toISOString()
  });
});

/*
|--------------------------------------------------------------------------
| M-PESA ROUTES
|--------------------------------------------------------------------------
*/

app.use(
  "/api/payment",
  paymentRoutes
);

/*
|--------------------------------------------------------------------------
| API HOME
|--------------------------------------------------------------------------
*/

app.get("/api", (req, res) => {
  res.json({
    success: true,
    message: "EarnPesa API",
    endpoints: {
      health: "GET /api/health",
      stkPush:
        "POST /api/payment/stkpush",
      mpesaCallback:
        "POST /api/payment/callback"
    }
  });
});

/*
|--------------------------------------------------------------------------
| FRONTEND HOME
|--------------------------------------------------------------------------
*/

app.get("/", (req, res) => {
  const indexPath =
    path.join(
      __dirname,
      "public",
      "index.html"
    );

  res.sendFile(indexPath, err => {
    if (err) {
      res.json({
        success: true,
        message:
          "EarnPesa backend is running."
      });
    }
  });
});

/*
|--------------------------------------------------------------------------
| 404
|--------------------------------------------------------------------------
*/

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.originalUrl
  });
});

/*
|--------------------------------------------------------------------------
| ERROR HANDLER
|--------------------------------------------------------------------------
*/

app.use(
  (err, req, res, next) => {
    console.error(
      "SERVER ERROR:",
      err
    );

    res.status(500).json({
      success: false,
      message:
        "Internal server error"
    });
  }
);

/*
|--------------------------------------------------------------------------
| START SERVER
|--------------------------------------------------------------------------
*/

async function startServer() {
  try {

    /*
     * Validate M-Pesa configuration.
     */

    try {
      validateConfig();

      console.log(
        "✅ M-Pesa configuration loaded"
      );

    } catch (error) {

      console.warn(
        "⚠️ M-Pesa configuration:",
        error.message
      );

      /*
       * Server can still start so that
       * database/frontend routes work.
       */
    }

    /*
     * Connect MongoDB.
     */

    await connectDatabase();

    /*
     * Start Express.
     */

    app.listen(
      PORT,
      "0.0.0.0",
      () => {

        console.log("");
        console.log(
          "================================"
        );
        console.log(
          "       EARNPESA BACKEND"
        );
        console.log(
          "================================"
        );

        console.log(
          `🚀 Port: ${PORT}`
        );

        console.log(
          `❤️ Health: /api/health`
        );

        console.log(
          `💳 STK: /api/payment/stkpush`
        );

        console.log(
          `📞 Callback: /api/payment/callback`
        );

        console.log(
          `🗄️ MongoDB: Connected`
        );

        console.log(
          `🌍 M-Pesa: ${
            process.env.MPESA_ENV ||
            "sandbox"
          }`
        );

        console.log(
          "================================"
        );
        console.log("");
      }
    );

  } catch (error) {

    console.error(
      "❌ SERVER STARTUP FAILED"
    );

    console.error(
      error.message
    );

    process.exit(1);
  }
}

startServer();
