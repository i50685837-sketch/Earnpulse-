const mongoose = require('mongoose');
const User = require('../models/user.model');
const Transaction = require('../models/transaction.model');
const mpesaService = require('../services/mpesa.service');
const logger = require('../utils/logger');

const MIN_DEPOSIT = 10;
const MIN_WITHDRAWAL = 50;

/* ------------------------------------------------------------------ */
/*  GET /api/wallet/balance                                           */
/* ------------------------------------------------------------------ */
exports.getBalance = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('balance');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    return res.json({ balance: user.balance });
  } catch (err) {
    logger.error('getBalance error', err);
    return res.status(500).json({ message: 'Failed to fetch balance' });
  }
};

/* ------------------------------------------------------------------ */
/*  POST /api/wallet/deposit           { amount, phone }              */
/*  Initiates Daraja STK push, creates a 'pending' Transaction         */
/* ------------------------------------------------------------------ */
exports.initiateDeposit = async (req, res) => {
  try {
    const { amount, phone } = req.body;

    if (!amount || Number(amount) < MIN_DEPOSIT) {
      return res.status(400).json({ message: `Minimum deposit is KES ${MIN_DEPOSIT}` });
    }
    if (!phone || !/^254\d{9}$/.test(phone)) {
      return res.status(400).json({ message: 'Invalid phone number format' });
    }

    const stkResponse = await mpesaService.stkPush({
      phone,
      amount: Math.round(Number(amount)),
      accountReference: `WINCRASH-${req.user.id}`,
      transactionDesc: 'Wincrash Wallet Deposit'
    });

    // stkResponse expected: { MerchantRequestID, CheckoutRequestID, ResponseCode, ... }
    if (stkResponse.ResponseCode !== '0') {
      return res.status(502).json({
        message: stkResponse.ResponseDescription || 'Failed to initiate STK push'
      });
    }

    await Transaction.create({
      user: req.user.id,
      type: 'deposit',
      method: 'mpesa_stk',
      amount: Number(amount),
      phone,
      status: 'pending',
      checkoutRequestId: stkResponse.CheckoutRequestID,
      merchantRequestId: stkResponse.MerchantRequestID
    });

    return res.status(200).json({
      message: 'STK push sent',
      checkoutRequestId: stkResponse.CheckoutRequestID
    });

  } catch (err) {
    logger.error('initiateDeposit error', err);
    return res.status(500).json({ message: 'Failed to initiate deposit' });
  }
};

/* ------------------------------------------------------------------ */
/*  GET /api/wallet/deposit/status/:checkoutRequestId                 */
/*  Polled by frontend                                                 */
/* ------------------------------------------------------------------ */
exports.getDepositStatus = async (req, res) => {
  try {
    const { checkoutRequestId } = req.params;

    const txn = await Transaction.findOne({
      checkoutRequestId,
      user: req.user.id
    });

    if (!txn) {
      return res.status(404).json({ status: 'failed', message: 'Transaction not found' });
    }

    return res.json({
      status: txn.status,          // 'pending' | 'success' | 'failed' | 'cancelled'
      amount: txn.amount,
      message: txn.resultDesc || null
    });

  } catch (err) {
    logger.error('getDepositStatus error', err);
    return res.status(500).json({ status: 'failed', message: 'Failed to check status' });
  }
};

/* ------------------------------------------------------------------ */
/*  POST /api/wallet/mpesa/stk-callback   (PUBLIC — called by Daraja) */
/*  Atomic: update Transaction + credit User.balance in one session   */
/* ------------------------------------------------------------------ */
exports.stkCallback = async (req, res) => {
  // Always ack Daraja immediately with 200, regardless of what we do internally,
  // or it will retry the callback repeatedly.
  res.status(200).json({ ResultCode: 0, ResultDesc: 'Received' });

  const session = await mongoose.startSession();

  try {
    const callback = req.body?.Body?.stkCallback;
    if (!callback) {
      logger.warn('stkCallback: malformed payload', req.body);
      return;
    }

    const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = callback;

    session.startTransaction();

    const txn = await Transaction.findOne({ checkoutRequestId: CheckoutRequestID }).session(session);

    if (!txn) {
      logger.warn(`stkCallback: no matching transaction for ${CheckoutRequestID}`);
      await session.abortTransaction();
      return;
    }

    // Idempotency guard — Daraja can resend callbacks
    if (txn.status !== 'pending') {
      await session.abortTransaction();
      return;
    }

    if (ResultCode === 0) {
      // Extract confirmed amount + receipt from CallbackMetadata
      const items = CallbackMetadata?.Item || [];
      const get = (name) => items.find(i => i.Name === name)?.Value;

      const confirmedAmount = get('Amount');
      const mpesaReceipt = get('MpesaReceiptNumber');

      txn.status = 'success';
      txn.resultDesc = ResultDesc;
      txn.mpesaReceipt = mpesaReceipt;
      if (confirmedAmount) txn.amount = confirmedAmount;
      await txn.save({ session });

      await User.findByIdAndUpdate(
        txn.user,
        { $inc: { balance: txn.amount } },
        { session }
      );

      logger.info(`Deposit success: user ${txn.user}, amount ${txn.amount}, receipt ${mpesaReceipt}`);

    } else {
      // ResultCode 1032 = cancelled by user, others = failed
      txn.status = ResultCode === 1032 ? 'cancelled' : 'failed';
      txn.resultDesc = ResultDesc;
      await txn.save({ session });

      logger.info(`Deposit ${txn.status}: user ${txn.user}, reason: ${ResultDesc}`);
    }

    await session.commitTransaction();

  } catch (err) {
    await session.abortTransaction().catch(() => {});
    logger.error('stkCallback processing error', err);
  } finally {
    session.endSession();
  }
};

/* ------------------------------------------------------------------ */
/*  POST /api/wallet/withdraw          { amount, phone }              */
/*  Debits balance first (atomic, guards against overdraft), then     */
/*  initiates B2C. If B2C fails to even initiate, refund immediately. */
/* ------------------------------------------------------------------ */
exports.initiateWithdrawal = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const { amount, phone } = req.body;
    const amt = Math.round(Number(amount));

    if (!amt || amt < MIN_WITHDRAWAL) {
      return res.status(400).json({ message: `Minimum withdrawal is KES ${MIN_WITHDRAWAL}` });
    }
    if (!phone || !/^254\d{9}$/.test(phone)) {
      return res.status(400).json({ message: 'Invalid phone number format' });
    }

    let txn;

    session.startTransaction();

    // Atomic conditional debit — fails if balance insufficient (prevents race conditions)
    const user = await User.findOneAndUpdate(
      { _id: req.user.id, balance: { $gte: amt } },
      { $inc: { balance: -amt } },
      { new: true, session }
    );

    if (!user) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Insufficient balance' });
    }

    txn = await Transaction.create([{
      user: req.user.id,
      type: 'withdrawal',
      method: 'mpesa_b2c',
      amount: amt,
      phone,
      status: 'processing'
    }], { session });
    txn = txn[0];

    await session.commitTransaction();
    session.endSession();

    // B2C call happens AFTER the balance debit is safely committed
    try {
      const b2cResponse = await mpesaService.b2cPayment({
        phone,
        amount: amt,
        remarks: 'Wincrash Wallet Withdrawal',
        occasionRef: txn._id.toString()
      });

      txn.conversationId = b2cResponse.ConversationID;
      txn.originatorConversationId = b2cResponse.OriginatorConversationID;
      await txn.save();

      return res.status(200).json({ message: 'Withdrawal is processing', transactionId: txn._id });

    } catch (b2cErr) {
      // B2C never left Safaricom's gate — refund the user
      logger.error('B2C initiation failed, refunding', b2cErr);

      await User.findByIdAndUpdate(req.user.id, { $inc: { balance: amt } });
      txn.status = 'failed';
      txn.resultDesc = 'Failed to initiate B2C transfer';
      await txn.save();

      return res.status(502).json({ message: 'Withdrawal failed to initiate, funds returned to wallet' });
    }

  } catch (err) {
    await session.abortTransaction().catch(() => {});
    session.endSession();
    logger.error('initiateWithdrawal error', err);
    return res.status(500).json({ message: 'Failed to process withdrawal' });
  }
};

/* ------------------------------------------------------------------ */
/*  POST /api/wallet/mpesa/b2c-result   (PUBLIC — called by Daraja)   */
/* ------------------------------------------------------------------ */
exports.b2cResult = async (req, res) => {
  res.status(200).json({ ResultCode: 0, ResultDesc: 'Received' });

  const session = await mongoose.startSession();

  try {
    const result = req.body?.Result;
    if (!result) {
      logger.warn('b2cResult: malformed payload', req.body);
      return;
    }

    const { ConversationID, ResultCode, ResultDesc, ResultParameters } = result;

    session.startTransaction();

    const txn = await Transaction.findOne({ conversationId: ConversationID }).session(session);

    if (!txn) {
      logger.warn(`b2cResult: no matching transaction for ${ConversationID}`);
      await session.abortTransaction();
      return;
    }

    if (txn.status !== 'processing') {
      await session.abortTransaction();
      return;
    }

    if (ResultCode === 0) {
      const items = ResultParameters?.ResultParameter || [];
      const get = (name) => items.find(i => i.Key === name)?.Value;

      txn.status = 'success';
      txn.resultDesc = ResultDesc;
      txn.mpesaReceipt = get('TransactionReceipt');
      await txn.save({ session });

      logger.info(`Withdrawal success: user ${txn.user}, amount ${txn.amount}`);

    } else {
      // Withdrawal failed on Safaricom's side after we already debited — refund
      txn.status = 'failed';
      txn.resultDesc = ResultDesc;
      await txn.save({ session });

      await User.findByIdAndUpdate(txn.user, { $inc: { balance: txn.amount } }, { session });

      logger.info(`Withdrawal failed, refunded: user ${txn.user}, amount ${txn.amount}, reason: ${ResultDesc}`);
    }

    await session.commitTransaction();

  } catch (err) {
    await session.abortTransaction().catch(() => {});
    logger.error('b2cResult processing error', err);
  } finally {
    session.endSession();
  }
};

/* ------------------------------------------------------------------ */
/*  POST /api/wallet/mpesa/b2c-timeout   (PUBLIC — called by Daraja)  */
/* ------------------------------------------------------------------ */
exports.b2cTimeout = async (req, res) => {
  res.status(200).json({ ResultCode: 0, ResultDesc: 'Received' });

  try {
    logger.warn('B2C request timed out at Daraja', req.body);
    // Optional: mark txn as 'timeout' here if you can correlate it,
    // otherwise treat as failed via a reconciliation job later.
  } catch (err) {
    logger.error('b2cTimeout processing error', err);
  }
};
        
