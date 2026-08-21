"use strict";

const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    amount: {
      type: Number,
      required: true,
      min: 1
    },

    type: {
      type: String,
      enum: [
        "deposit",
        "activation",
        "withdrawal"
      ],
      required: true
    },

    status: {
      type: String,
      enum: [
        "pending",
        "success",
        "failed",
        "cancelled"
      ],
      default: "pending",
      index: true
    },

    phone: {
      type: String,
      required: true
    },

    merchantRequestId: {
      type: String,
      default: null,
      index: true
    },

    checkoutRequestId: {
      type: String,
      default: null,
      unique: true,
      sparse: true,
      index: true
    },

    mpesaReceiptNumber: {
      type: String,
      default: null,
      index: true
    },

    accountReference: {
      type: String,
      default: "EarnPulse"
    },

    transactionDescription: {
      type: String,
      default: null
    },

    resultCode: {
      type: Number,
      default: null
    },

    resultDescription: {
      type: String,
      default: null
    },

    processedAt: {
      type: Date,
      default: null
    }
  },

  {
    timestamps: true
  }
);

paymentSchema.index({
  userId: 1,
  createdAt: -1
});

module.exports =
  mongoose.model(
    "Payment",
    paymentSchema
  );
