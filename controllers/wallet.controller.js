"use strict";

const Wallet = require("../models/wallet.model");

// GET CURRENT USER WALLET
exports.getWallet = async (req, res) => {
  try {
    // User ID comes from auth middleware
    const userId = req.user._id;

    let wallet = await Wallet.findOne({
      user: userId
    });

    // Create wallet if user does not have one
    if (!wallet) {
      wallet = await Wallet.create({
        user: userId,
        balance: 0,
        totalDeposited: 0,
        totalWithdrawn: 0
      });

      return res.status(201).json({
        success: true,
        message: "New wallet created",
        wallet
      });
    }

    return res.status(200).json({
      success: true,
      message: "Wallet found",
      wallet
    });

  } catch (error) {
    console.error("Wallet error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load wallet",
      error: error.message
    });
  }
};
