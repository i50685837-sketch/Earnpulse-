"use strict";

require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

/*
|--------------------------------------------------------------------------
| APP CONFIGURATION
|--------------------------------------------------------------------------
*/

const app = express();

const PORT = Number(process.env.PORT) || 3000;

const MONGO_URI = process.env.MONGO_URI;

const NODE_ENV =
  process.env.NODE_ENV || "development";


/*
|--------------------------------------------------------------------------
| ENVIRONMENT VALIDATION
|--------------------------------------------------------------------------
*/

if (!MONGO_URI) {
  console.error("");
  console.error("❌ MONGO_URI is missing.");
  console.error("Add MONGO_URI to your Render environment variables.");
  console.error("");
  process.exit(1);
}


/*
|--------------------------------------------------------------------------
| BASIC APP SETTINGS
|--------------------------------------------------------------------------
*/

app.disable("x-powered-by");

app.set("trust proxy", 1);


/*
|--------------------------------------------------------------------------
| CORS
|--------------------------------------------------------------------------
*/

app.use(
  cors({
    origin: true,
    credentials: true,
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


/*
|--------------------------------------------------------------------------
| BODY PARSERS
|--------------------------------------------------------------------------
*/

app.use(
  express.json({
    limit: "2mb"
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "2mb"
  })
);


/*
|--------------------------------------------------------------------------
| REQUEST LOGGER
|--------------------------------------------------------------------------
*/

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

let User;
let Wallet;
let Payment;

try {

  User =
    require("./models/User");

  Wallet =
    require("./models/Wallet");

  Payment =
    require("./models/Payment");

  console.log(
    "✅ Database models loaded"
  );

} catch (error) {

  console.error(
    "❌ Failed to load database models:"
  );

  console.error(
    error.message
  );

  process.exit(1);

}


/*
|--------------------------------------------------------------------------
| ROUTES
|--------------------------------------------------------------------------
*/

let authRoutes;
let paymentRoutes;
let walletRoutes;
let profileRoutes;

try {

  authRoutes =
    require("./routes/auth");

  paymentRoutes =
    require("./routes/payment");

  walletRoutes =
    require("./routes/wallet");

  profileRoutes =
    require("./routes/profile");

  console.log(
    "✅ Route modules loaded"
  );

} catch (error) {

  console.error(
    "❌ Failed to load route modules:"
  );

  console.error(
    error.message
  );

  process.exit(1);

}


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
| HOME PAGE
|--------------------------------------------------------------------------
*/

app.get(
  "/",
  (req, res) => {

    const loginPage =
      path.join(
        publicPath,
        "login.html"
      );

    res.sendFile(
      loginPage,
      (error) => {

        if (error) {

          console.error(
            "❌ Unable to load login.html:",
            error.message
          );

          res.status(500).send(
            "EarnPulse is running, but login.html was not found."
          );

        }

      }
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

    const databaseConnected =
      mongoose.connection.readyState === 1;

    res.status(
      databaseConnected
        ? 200
        : 503
    ).json({

      success:
        databaseConnected,

      service:
        "EarnPulse API",

      status:
        databaseConnected
          ? "online"
          : "database unavailable",

      environment:
        NODE_ENV,

      database:
        databaseConnected
          ? "connected"
          : "disconnected",

      uptime:
        Math.floor(
          process.uptime()
        ),

      timestamp:
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

      status:
        "online",

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

      },

      timestamp:
        new Date().toISOString()

    });

  }
);


/*
|--------------------------------------------------------------------------
| DATABASE CONNECTION
|--------------------------------------------------------------------------
*/

async function connectDatabase() {

  console.log(
    "🔄 Connecting to MongoDB..."
  );

  try {

    await mongoose.connect(
      MONGO_URI,
      {
        serverSelectionTimeoutMS: 15000,
        connectTimeoutMS: 15000,
        socketTimeoutMS: 45000,
        maxPoolSize: 10,
        minPoolSize: 1
      }
    );

    console.log(
      "✅ MongoDB connected"
    );

    console.log(
      `📦 Database: ${mongoose.connection.name}`
    );

    console.log(
      `🖥️ Host: ${mongoose.connection.host}`
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
| DATABASE EVENTS
|--------------------------------------------------------------------------
*/

mongoose.connection.on(
  "connected",
  () => {

    console.log(
      "🟢 MongoDB connection established"
    );

  }
);


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
      "🔄 MongoDB reconnected"
    );

  }
);


/*
|--------------------------------------------------------------------------
| WALLET DATABASE INDEX CHECK
|--------------------------------------------------------------------------
|
| IMPORTANT:
|
| The Wallet model uses `userId`.
|
| We intentionally DO NOT create wallets here.
|
| Wallets must always belong to an actual User.
|--------------------------------------------------------------------------
*/

async function checkWalletIndexes() {

  try {

    if (!Wallet) {
      return;
    }

    const collection =
      Wallet.collection;

    const indexes =
      await collection.indexes();

    console.log(
      "🔎 Wallet indexes:"
    );

    for (
      const index of indexes
    ) {

      console.log(
        `   • ${index.name}`
      );

    }

    /*
    |--------------------------------------------------------------------------
    | OLD INDEX DETECTION
    |--------------------------------------------------------------------------
    |
    | Older versions of the application may have created:
    |
    |     user_1
    |
    | The current schema uses:
    |
    |     userId_1
    |
    | We DO NOT automatically delete database indexes here because
    | destructive database operations should be deliberate.
    |--------------------------------------------------------------------------
    */

    const oldUserIndex =
      indexes.find(
        (index) =>
          index.name === "user_1"
      );

    if (oldUserIndex) {

      console.warn("");
      console.warn(
        "⚠️ OLD WALLET INDEX FOUND: user_1"
      );

      console.warn(
        "⚠️ Remove `user_1` from MongoDB Atlas."
      );

      console.warn(
        "⚠️ The current Wallet schema uses `userId`."
      );

      console.warn("");

    }

  } catch (error) {

    console.error(
      "⚠️ Wallet index check failed:",
      error.message
    );

  }

}


/*
|--------------------------------------------------------------------------
| ENSURE WALLET INDEX
|--------------------------------------------------------------------------
|
| This creates the correct userId index if necessary.
|
| It does NOT create wallets.
|--------------------------------------------------------------------------
*/

async function ensureWalletIndex() {

  try {

    if (!Wallet) {
      return;
    }

    await Wallet.collection.createIndex(
      {
        userId: 1
      },
      {
        unique: true,
        name: "userId_1"
      }
    );

    console.log(
      "✅ Wallet userId index verified"
    );

  } catch (error) {

    /*
    |--------------------------------------------------------------------------
    | DUPLICATE DATA PROTECTION
    |--------------------------------------------------------------------------
    */

    if (
      error.code === 11000
    ) {

      console.warn(
        "⚠️ Wallet index could not be created because duplicate userId data exists."
      );

      console.warn(
        "Check the wallets collection for duplicate userId values."
      );

      return;

    }

    console.error(
      "⚠️ Wallet index verification failed:",
      error.message
    );

  }

}


/*
|--------------------------------------------------------------------------
| WALLET CREATION HELPER
|--------------------------------------------------------------------------
|
| Use this helper from registration or another authenticated operation.
|
| NEVER call this with null/undefined userId.
|--------------------------------------------------------------------------
*/

async function createWalletForUser(
  userId
) {

  if (!userId) {

    throw new Error(
      "Cannot create wallet without a valid userId"
    );

  }

  const existingWallet =
    await Wallet.findOne({
      userId
    });

  if (existingWallet) {

    return existingWallet;

  }

  const wallet =
    await Wallet.create({

      userId,

      balance: 0,

      totalDeposits: 0,

      totalWithdrawals: 0,

      activated: false,

      status: "inactive"

    });

  return wallet;

}


/*
|--------------------------------------------------------------------------
| OPTIONAL INTERNAL WALLET ROUTE
|--------------------------------------------------------------------------
|
| This is NOT exposed as a public wallet creation endpoint.
|
| It simply provides information about the wallet system.
|--------------------------------------------------------------------------
*/

app.get(
  "/api/system/wallet-status",
  async (req, res) => {

    try {

      const walletCount =
        await Wallet.countDocuments();

      res.json({

        success: true,

        wallets:
          walletCount,

        database:
          mongoose.connection.readyState === 1
            ? "connected"
            : "disconnected"

      });

    } catch (error) {

      console.error(
        "Wallet status error:",
        error.message
      );

      res.status(500).json({

        success: false,

        message:
          "Unable to check wallet status"

      });

    }

  }
);


/*
|--------------------------------------------------------------------------
| 404 HANDLER
|--------------------------------------------------------------------------
*/

app.use(
  (req, res, next) => {

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


    res.status(404).send(
      `
<!DOCTYPE html>

<html lang="en">

<head>

<meta charset="UTF-8">

<meta
  name="viewport"
  content="width=device-width,initial-scale=1"
/>

<title>EarnPulse • 404</title>

<style>

*{
  box-sizing:border-box;
}

body{
  margin:0;
  min-height:100vh;
  display:flex;
  align-items:center;
  justify-content:center;
  background:
    radial-gradient(
      circle at top,
      #12352a,
      #071a14 55%,
      #030b08
    );
  color:#fff;
  font-family:Arial,sans-serif;
  text-align:center;
}

.box{
  width:min(90%,500px);
  padding:40px 25px;
  border:1px solid rgba(255,255,255,.1);
  border-radius:20px;
  background:rgba(255,255,255,.05);
  backdrop-filter:blur(12px);
}

h1{
  margin:0;
  font-size:72px;
}

p{
  color:#b7c9c1;
}

a{
  display:inline-block;
  margin-top:15px;
  padding:12px 20px;
  border-radius:10px;
  background:#19c978;
  color:#04120d;
  text-decoration:none;
  font-weight:bold;
}

</style>

</head>

<body>

<div class="box">

<h1>404</h1>

<p>
The page or API endpoint you requested was not found.
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

    console.error("");
    console.error(
      "🔥 SERVER ERROR"
    );

    console.error(
      error
    );

    console.error("");


    if (
      res.headersSent
    ) {

      return next(error);

    }


    let status =
      Number(error.status) ||
      Number(error.statusCode) ||
      500;


    if (
      status < 400 ||
      status > 599
    ) {

      status = 500;

    }


    res.status(status).json({

      success: false,

      message:
        status === 500
          ? "Internal server error"
          : error.message,

      ...(NODE_ENV !== "production"
        ? {
            error:
              error.message
          }
        : {})

    });

  }
);


/*
|--------------------------------------------------------------------------
| GRACEFUL SHUTDOWN
|--------------------------------------------------------------------------
*/

let shuttingDown =
  false;


async function shutdown(
  signal
) {

  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  console.log("");
  console.log(
    `🛑 ${signal} received`
  );

  console.log(
    "🔄 Shutting down EarnPulse..."
  );


  try {

    await mongoose.connection.close(
      false
    );

    console.log(
      "✅ MongoDB connection closed"
    );

  } catch (error) {

    console.error(
      "❌ MongoDB shutdown error:",
      error.message
    );

  }


  process.exit(0);

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
| UNHANDLED PROMISE REJECTION
|--------------------------------------------------------------------------
*/

process.on(
  "unhandledRejection",
  (reason) => {

    console.error("");
    console.error(
      "❌ UNHANDLED PROMISE REJECTION"
    );

    console.error(
      reason
    );

    console.error("");

  }
);


/*
|--------------------------------------------------------------------------
| UNCAUGHT EXCEPTION
|--------------------------------------------------------------------------
*/

process.on(
  "uncaughtException",
  (error) => {

    console.error("");
    console.error(
      "❌ UNCAUGHT EXCEPTION"
    );

    console.error(
      error
    );

    console.error("");

    /*
     * Give the process a moment to flush logs,
     * then terminate so Render can restart it.
     */

    setTimeout(
      () => process.exit(1),
      1000
    );

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
    |--------------------------------------------------------------------------
    | DATABASE
    |--------------------------------------------------------------------------
    */

    await connectDatabase();


    /*
    |--------------------------------------------------------------------------
    | WALLET INDEXES
    |--------------------------------------------------------------------------
    */

    await checkWalletIndexes();

    await ensureWalletIndex();


    /*
    |--------------------------------------------------------------------------
    | START HTTP SERVER
    |--------------------------------------------------------------------------
    */

    const server =
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
            "👤 Profile routes loaded"
          );

          console.log(
            "===================================="
          );

          console.log("");

          console.log(
            "✅ EarnPulse server is ready"
          );

          console.log("");

        }
      );


    /*
    |--------------------------------------------------------------------------
    | SERVER ERROR
    |--------------------------------------------------------------------------
    */

    server.on(
      "error",
      (error) => {

        console.error(
          "❌ HTTP server error:",
          error.message
        );

      }
    );


  } catch (error) {

    console.error("");
    console.error(
      "❌ FAILED TO START EARNPULSE"
    );

    console.error(
      error
    );

    process.exit(1);

  }

}


/*
|--------------------------------------------------------------------------
| BOOT
|--------------------------------------------------------------------------
*/

startServer();
