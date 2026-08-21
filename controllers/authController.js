"use strict";

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("../models/User");
const Wallet = require("../models/Wallet");

const JWT_SECRET = process.env.JWT_SECRET;


/*
|--------------------------------------------------------------------------
| Validation helpers
|--------------------------------------------------------------------------
*/

function normalizePhone(phone) {

  let value = String(phone || "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/-/g, "");

  if (value.startsWith("+254")) {
    value = value.substring(1);
  }

  if (value.startsWith("07") || value.startsWith("01")) {
    value = "254" + value.substring(1);
  }

  return value;
}


function isValidKenyanPhone(phone) {

  return /^254[17][0-9]{8}$/.test(phone);

}


function createToken(user) {

  return jwt.sign(
    {
      id: user._id.toString(),
      userId: user._id.toString()
    },
    JWT_SECRET,
    {
      expiresIn: "7d"
    }
  );

}


/*
|--------------------------------------------------------------------------
| REGISTER
|--------------------------------------------------------------------------
| POST /api/auth/register
|--------------------------------------------------------------------------
*/

async function register(req, res) {

  try {

    const {
      name,
      email,
      phone,
      password
    } = req.body;


    /*
    |--------------------------------------------------------------------------
    | Required fields
    |--------------------------------------------------------------------------
    */

    if (
      !name ||
      !email ||
      !phone ||
      !password
    ) {

      return res.status(400).json({

        success: false,

        message:
          "Name, email, phone and password are required."

      });

    }


    /*
    |--------------------------------------------------------------------------
    | Clean input
    |--------------------------------------------------------------------------
    */

    const cleanName =
      String(name).trim();

    const cleanEmail =
      String(email)
        .trim()
        .toLowerCase();

    const cleanPhone =
      normalizePhone(phone);


    /*
    |--------------------------------------------------------------------------
    | Validate name
    |--------------------------------------------------------------------------
    */

    if (cleanName.length < 2) {

      return res.status(400).json({

        success: false,

        message:
          "Name must contain at least 2 characters."

      });

    }


    /*
    |--------------------------------------------------------------------------
    | Validate email
    |--------------------------------------------------------------------------
    */

    const emailRegex =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


    if (!emailRegex.test(cleanEmail)) {

      return res.status(400).json({

        success: false,

        message:
          "Enter a valid email address."

      });

    }


    /*
    |--------------------------------------------------------------------------
    | Validate phone
    |--------------------------------------------------------------------------
    */

    if (!isValidKenyanPhone(cleanPhone)) {

      return res.status(400).json({

        success: false,

        message:
          "Enter a valid Kenyan M-Pesa number."

      });

    }


    /*
    |--------------------------------------------------------------------------
    | Validate password
    |--------------------------------------------------------------------------
    */

    if (String(password).length < 6) {

      return res.status(400).json({

        success: false,

        message:
          "Password must contain at least 6 characters."

      });

    }


    /*
    |--------------------------------------------------------------------------
    | Check duplicate email
    |--------------------------------------------------------------------------
    */

    const existingEmail =
      await User.findOne({
        email: cleanEmail
      });


    if (existingEmail) {

      return res.status(409).json({

        success: false,

        message:
          "An account with this email already exists."

      });

    }


    /*
    |--------------------------------------------------------------------------
    | Check duplicate phone
    |--------------------------------------------------------------------------
    */

    const existingPhone =
      await User.findOne({
        phone: cleanPhone
      });


    if (existingPhone) {

      return res.status(409).json({

        success: false,

        message:
          "An account with this phone number already exists."

      });

    }


    /*
    |--------------------------------------------------------------------------
    | Hash password
    |--------------------------------------------------------------------------
    */

    const hashedPassword =
      await bcrypt.hash(
        password,
        12
      );


    /*
    |--------------------------------------------------------------------------
    | Create user
    |--------------------------------------------------------------------------
    */

    const user =
      await User.create({

        name: cleanName,

        email: cleanEmail,

        phone: cleanPhone,

        password: hashedPassword,

        status: "active"

      });


    /*
    |--------------------------------------------------------------------------
    | Create wallet
    |--------------------------------------------------------------------------
    */

    try {

      await Wallet.create({

        userId: user._id,

        balance: 0,

        totalDeposits: 0,

        totalWithdrawals: 0,

        activated: false,

        status: "inactive"

      });

    } catch (walletError) {

      /*
       * If wallet creation fails, remove the user
       * so registration doesn't leave an incomplete account.
       */

      await User.findByIdAndDelete(
        user._id
      );

      throw walletError;

    }


    /*
    |--------------------------------------------------------------------------
    | Response
    |--------------------------------------------------------------------------
    */

    return res.status(201).json({

      success: true,

      message:
        "Account created successfully.",

      user: {

        id: user._id,

        name: user.name,

        email: user.email,

        phone: user.phone

      }

    });


  } catch (error) {

    console.error(
      "REGISTER ERROR:",
      error
    );


    /*
    |--------------------------------------------------------------------------
    | Duplicate key protection
    |--------------------------------------------------------------------------
    */

    if (error.code === 11000) {

      return res.status(409).json({

        success: false,

        message:
          "Email or phone number is already registered."

      });

    }


    return res.status(500).json({

      success: false,

      message:
        "Unable to create account."

    });

  }

}


/*
|--------------------------------------------------------------------------
| LOGIN
|--------------------------------------------------------------------------
| POST /api/auth/login
|--------------------------------------------------------------------------
*/

async function login(req, res) {

  try {

    const {
      identifier,
      email,
      phone,
      password
    } = req.body;


    /*
    |--------------------------------------------------------------------------
    | Accept identifier, email or phone
    |--------------------------------------------------------------------------
    */

    let loginIdentifier =
      identifier ||
      email ||
      phone;


    if (
      !loginIdentifier ||
      !password
    ) {

      return res.status(400).json({

        success: false,

        message:
          "Email/phone and password are required."

      });

    }


    loginIdentifier =
      String(loginIdentifier)
        .trim();


    /*
    |--------------------------------------------------------------------------
    | Find user
    |--------------------------------------------------------------------------
    */

    let user;


    if (
      loginIdentifier.includes("@")
    ) {

      user =
        await User.findOne({

          email:
            loginIdentifier.toLowerCase()

        })
        .select("+password");

    } else {

      const cleanPhone =
        normalizePhone(
          loginIdentifier
        );


      user =
        await User.findOne({

          phone:
            cleanPhone

        })
        .select("+password");

    }


    /*
    |--------------------------------------------------------------------------
    | User not found
    |--------------------------------------------------------------------------
    */

    if (!user) {

      return res.status(401).json({

        success: false,

        message:
          "Invalid login details."

      });

    }


    /*
    |--------------------------------------------------------------------------
    | Check account status
    |--------------------------------------------------------------------------
    */

    if (
      user.status === "suspended"
    ) {

      return res.status(403).json({

        success: false,

        message:
          "This account has been suspended."

      });

    }


    /*
    |--------------------------------------------------------------------------
    | Compare password
    |--------------------------------------------------------------------------
    */

    const passwordMatch =
      await bcrypt.compare(
        password,
        user.password
      );


    if (!passwordMatch) {

      return res.status(401).json({

        success: false,

        message:
          "Invalid login details."

      });

    }


    /*
    |--------------------------------------------------------------------------
    | Update last login
    |--------------------------------------------------------------------------
    */

    user.lastLogin =
      new Date();

    await user.save();


    /*
    |--------------------------------------------------------------------------
    | JWT
    |--------------------------------------------------------------------------
    */

    const token =
      createToken(user);


    /*
    |--------------------------------------------------------------------------
    | Wallet
    |--------------------------------------------------------------------------
    */

    const wallet =
      await Wallet.findOne({

        userId:
          user._id

      });


    /*
    |--------------------------------------------------------------------------
    | Response
    |--------------------------------------------------------------------------
    */

    return res.status(200).json({

      success: true,

      message:
        "Login successful.",

      token,

      user: {

        id: user._id,

        name: user.name,

        email: user.email,

        phone: user.phone,

        status: user.status

      },

      wallet: wallet
        ? {

            balance:
              wallet.balance,

            activated:
              wallet.activated,

            status:
              wallet.status

          }
        : {

            balance: 0,

            activated: false,

            status: "inactive"

          }

    });


  } catch (error) {

    console.error(
      "LOGIN ERROR:",
      error
    );


    return res.status(500).json({

      success: false,

      message:
        "Unable to login."

    });

  }

}


/*
|--------------------------------------------------------------------------
| EXPORTS
|--------------------------------------------------------------------------
*/

module.exports = {

  register,

  login

};
