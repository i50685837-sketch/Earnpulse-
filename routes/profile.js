const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");
const User = require("../models/User");

router.get("/", auth, async (req, res) => {

  try {

    const user = await User.findById(
      req.user.id
    ).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.json({
      success: true,
      user
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      success: false,
      message: "Unable to load profile"
    });

  }

});

module.exports = router;
