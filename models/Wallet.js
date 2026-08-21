"use strict";

const mongoose = require("mongoose");

const walletSchema = new mongoose.Schema(
  {
    /*
    |--------------------------------------------------------------------------
    | OWNER
    |--------------------------------------------------------------------------
    */

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true
    },


    /*
    |--------------------------------------------------------------------------
    | BALANCE
    |--------------------------------------------------------------------------
    */

    balance: {
      type: Number,
      default: 0,
      min: 0
    },


    /*
    |--------------------------------------------------------------------------
    | TOTAL DEPOSITS
    |--------------------------------------------------------------------------
    */

    totalDeposits: {
      type: Number,
      default: 0,
      min: 0
    },


    /*
    |--------------------------------------------------------------------------
    | TOTAL WITHDRAWALS
    |--------------------------------------------------------------------------
    */

    totalWithdrawals: {
      type: Number,
      default: 0,
      min: 0
    },


    /*
    |--------------------------------------------------------------------------
    | WALLET ACTIVATION
    |--------------------------------------------------------------------------
    */

    activated: {
      type: Boolean,
      default: false
    },

    activatedAt: {
      type: Date,
      default: null
    },


    /*
    |--------------------------------------------------------------------------
    | WALLET STATUS
    |--------------------------------------------------------------------------
    */

    status: {
      type: String,
      enum: [
        "active",
        "inactive",
        "suspended"
      ],
      default: "inactive"
    },


    /*
    |--------------------------------------------------------------------------
    | LAST TRANSACTION
    |--------------------------------------------------------------------------
    */

    lastTransactionAt: {
      type: Date,
      default: null
    }
  },

  {
    timestamps: true
  }
);


/*
|--------------------------------------------------------------------------
| INDEX
|--------------------------------------------------------------------------
*/

walletSchema.index({
  userId: 1
});


/*
|--------------------------------------------------------------------------
| ACTIVATE WALLET
|--------------------------------------------------------------------------
*/

walletSchema.methods.activate = function () {

  this.activated = true;

  this.activatedAt =
    new Date();

  this.status =
    "active";

  return this.save();

};


/*
|--------------------------------------------------------------------------
| CREDIT WALLET
|--------------------------------------------------------------------------
|
| Use this only after the backend has confirmed a successful payment.
|--------------------------------------------------------------------------
*/

walletSchema.methods.credit = async function (
  amount
) {

  amount =
    Number(amount);


  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {

    throw new Error(
      "Invalid credit amount"
    );

  }


  this.balance += amount;

  this.totalDeposits += amount;

  this.lastTransactionAt =
    new Date();


  return this.save();

};


/*
|--------------------------------------------------------------------------
| DEBIT WALLET
|--------------------------------------------------------------------------
|
| Used when money is legitimately withdrawn.
|--------------------------------------------------------------------------
*/

walletSchema.methods.debit = async function (
  amount
) {

  amount =
    Number(amount);


  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {

    throw new Error(
      "Invalid debit amount"
    );

  }


  if (
    this.balance < amount
  ) {

    throw new Error(
      "Insufficient wallet balance"
    );

  }


  this.balance -= amount;

  this.totalWithdrawals += amount;

  this.lastTransactionAt =
    new Date();


  return this.save();

};


/*
|--------------------------------------------------------------------------
| SAFE BALANCE
|--------------------------------------------------------------------------
*/

walletSchema.virtual(
  "availableBalance"
).get(function () {

  return Math.max(
    0,
    this.balance
  );

});


/*
|--------------------------------------------------------------------------
| JSON OUTPUT
|--------------------------------------------------------------------------
*/

walletSchema.set(
  "toJSON",
  {
    virtuals: true,

    transform: function (
      doc,
      ret
    ) {

      delete ret.__v;

      return ret;

    }
  }
);


module.exports =
  mongoose.model(
    "Wallet",
    walletSchema
  );
