"use strict";

const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/auth.middleware");
const walletController = require("../controllers/wallet.controller");

// ===============================
// WALLET — USER ROUTES
// ===============================

// Get current user's wallet
router.get("/", protect, walletController.getWallet);

// ===============================
// MPESA — PUBLIC CALLBACK ROUTES
// ===============================

// Daraja STK Push callback
router.post(
  "/mpesa/stk-callback",
  walletController.stkCallback
);

// Daraja B2C result
router.post(
  "/mpesa/b2c-result",
  walletController.b2cResult
);

// Daraja B2C timeout
router.post(
  "/mpesa/b2c-timeout",
  walletController.b2cTimeout
);

module.exports = router;
