const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const walletController = require('../controllers/wallet.controller');

// ---- PUBLIC: Daraja calls these directly, no JWT present ----
// POST /api/wallet/mpesa/stk-callback
router.post('/mpesa/stk-callback', walletController.stkCallback);

// POST /api/wallet/mpesa/b2c-result
// POST /api/wallet/mpesa/b2c-timeout
router.post('/mpesa/b2c-result', walletController.b2cResult);
router.post('/mpesa/b2c-timeout', walletController.b2cTimeout);

// ---- Everything below requires a valid JWT ----
router.use(protect);

// GET  /api/wallet/balance
router.get('/balance', walletController.getBalance);

// POST /api/wallet/deposit          { amount, phone }
//      -> triggers Daraja STK push, returns { checkoutRequestId }
router.post('/deposit', walletController.initiateDeposit);

// GET  /api/wallet/deposit/status/:checkoutRequestId
//      -> polled by frontend, returns { status: 'pending'|'success'|'failed'|'cancelled', amount, message }
router.get('/deposit/status/:checkoutRequestId', walletController.getDepositStatus);

// POST /api/wallet/withdraw         { amount, phone }
//      -> triggers Daraja B2C payout
router.post('/withdraw', walletController.initiateWithdrawal);

module.exports = router;
