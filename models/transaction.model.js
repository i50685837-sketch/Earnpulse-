const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },

    type: {
      type: String,
      enum: ['deposit', 'withdrawal'],
      required: true
    },

    method: {
      type: String,
      enum: ['mpesa_stk', 'mpesa_b2c'],
      required: true
    },

    amount: {
      type: Number,
      required: true,
      min: 1
    },

    phone: {
      type: String,
      required: true,
      match: /^254\d{9}$/
    },

    status: {
      type: String,
      enum: ['pending', 'processing', 'success', 'failed', 'cancelled'],
      default: 'pending',
      index: true
    },

    // ---- STK Push (deposit) correlation fields ----
    checkoutRequestId: {
      type: String,
      index: true,
      sparse: true,
      unique: true
    },
    merchantRequestId: {
      type: String
    },

    // ---- B2C (withdrawal) correlation fields ----
    conversationId: {
      type: String,
      index: true,
      sparse: true,
      unique: true
    },
    originatorConversationId: {
      type: String
    },

    // ---- Result info, set once Daraja calls back ----
    mpesaReceipt: {
      type: String,
      sparse: true
    },
    resultDesc: {
      type: String
    }
  },
  {
    timestamps: true // createdAt / updatedAt
  }
);

// Common lookup patterns
transactionSchema.index({ user: 1, type: 1, status: 1 });
transactionSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Transaction', transactionSchema);
