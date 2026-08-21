const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");

const Wallet = require("../models/Wallet");
const User = require("../models/User");
const Payment = require("../models/Payment");

router.get("/", auth, async (req, res) => {

  try {

    const wallet = await Wallet.findOne({
      userId: req.user.id
    });

    const user = await User.findById(
      req.user.id
    ).select("name email phone");

    const transactions =
      await Payment.find({
        userId: req.user.id
      })
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({
      success: true,

      wallet: wallet || {
        balance: 0,
        totalDeposits: 0,
        totalWithdrawals: 0,
        activated: false
      },

      user,

      transactions
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      success: false,
      message: "Unable to load wallet"
    });

  }

});

module.exports = router;
