const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const Razorpay = require('razorpay');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

// =====================================================
// CONFIG
// =====================================================

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

if (!process.env.RAZORPAY_KEY_ID) {
  throw new Error('RAZORPAY_KEY_ID environment variable is required');
}

if (!process.env.RAZORPAY_KEY_SECRET) {
  throw new Error('RAZORPAY_KEY_SECRET environment variable is required');
}

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// =====================================================
// SERVER-SIDE PLAN CATALOG
// NEVER TRUST PRICE FROM FRONTEND
// =====================================================

const PLANS = Object.freeze({
  basic: {
    id: 'basic',
    name: 'Basic',
    amountPaise: 19900,
    currency: 'INR',
    interval: 'monthly'
  },

  pro: {
    id: 'pro',
    name: 'Pro',
    amountPaise: 39900,
    currency: 'INR',
    interval: 'monthly'
  },

  premium: {
    id: 'premium',
    name: 'Premium',
    amountPaise: 149900,
    currency: 'INR',
    interval: 'monthly'
  },

  power: {
    id: 'power',
    name: 'Power',
    amountPaise: 299900,
    currency: 'INR',
    interval: 'monthly'
  }
});

// =====================================================
// AUTHENTICATION
// =====================================================

function authenticate(req, res, next) {
  try {
    const authorization = req.headers.authorization || '';

    if (!authorization.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Authentication required'
      });
    }

    const token = authorization.slice(7).trim();

    if (!token) {
      return res.status(401).json({
        error: 'Authentication required'
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    if (!decoded?.id) {
      return res.status(401).json({
        error: 'Invalid authentication token'
      });
    }

    req.user = decoded;

    next();

  } catch (error) {
    console.error('❌ Payment authentication error:', error);

    return res.status(401).json({
      error: 'Invalid or expired authentication token'
    });
  }
}

// =====================================================
// GET AVAILABLE PLANS
// =====================================================

router.get('/plans', (req, res) => {
  const plans = Object.values(PLANS).map(plan => ({
    id: plan.id,
    name: plan.name,
    amount: plan.amountPaise / 100,
    currency: plan.currency,
    interval: plan.interval
  }));

  res.json({
    currency: 'INR',
    plans
  });
});

// =====================================================
// CREATE RAZORPAY ORDER
// =====================================================

router.post('/create-order', authenticate, async (req, res) => {
  try {
    const planId =
      typeof req.body?.planId === 'string'
        ? req.body.planId.trim().toLowerCase()
        : '';

    // -------------------------------------------------
    // IMPORTANT:
    // Amount is NEVER accepted from frontend.
    // -------------------------------------------------

    const plan = PLANS[planId];

    if (!plan) {
      return res.status(400).json({
        error: 'Invalid plan'
      });
    }

    // -------------------------------------------------
    // Prevent accidental duplicate active/created order
    // for the same user and plan within a short period.
    // -------------------------------------------------

    const recentSince =
      new Date(Date.now() - 15 * 60 * 1000).toISOString();

    const {
      data: recentOrders,
      error: recentOrderError
    } = await supabase
      .from('payment_orders')
      .select(
        'id, provider_order_id, plan_id, amount_paise, currency, status, created_at'
      )
      .eq('user_id', req.user.id)
      .eq('plan_id', plan.id)
      .eq('status', 'created')
      .gte('created_at', recentSince)
      .order('created_at', {
        ascending: false
      })
      .limit(1);

    if (recentOrderError) {
      console.error(
        '❌ Recent payment order lookup error:',
        recentOrderError
      );

      return res.status(500).json({
        error: 'Unable to create payment order'
      });
    }

    const existingOrder = recentOrders?.[0];

    if (existingOrder) {
      return res.json({
        message: 'Existing payment order available',
        order: {
          id: existingOrder.provider_order_id,
          amount: existingOrder.amount_paise,
          currency: existingOrder.currency
        },
        plan: {
          id: plan.id,
          name: plan.name,
          interval: plan.interval
        },
        razorpayKeyId: process.env.RAZORPAY_KEY_ID
      });
    }

    // -------------------------------------------------
    // Create trusted server-side Razorpay order
    // -------------------------------------------------

    const receipt =
      `samarthai_${req.user.id.slice(0, 8)}_${Date.now()}`
        .slice(0, 40);

    const razorpayOrder =
      await razorpay.orders.create({
        amount: plan.amountPaise,
        currency: plan.currency,
        receipt,
        notes: {
          user_id: String(req.user.id),
          plan_id: plan.id,
          plan_name: plan.name
        }
      });

    if (!razorpayOrder?.id) {
      throw new Error('Razorpay did not return an order ID');
    }

    // -------------------------------------------------
    // Save order in Supabase
    // -------------------------------------------------

    const {
      data: savedOrder,
      error: saveOrderError
    } = await supabase
      .from('payment_orders')
      .insert([
        {
          user_id: req.user.id,
          provider: 'razorpay',
          provider_order_id: razorpayOrder.id,
          plan_id: plan.id,
          currency: plan.currency,
          amount_paise: plan.amountPaise,
          status: 'created',
          signature_verified: false
        }
      ])
      .select()
      .single();

    if (saveOrderError) {
      console.error(
        '❌ Payment order database error:',
        saveOrderError
      );

      return res.status(500).json({
        error: 'Payment order could not be saved'
      });
    }

    return res.status(201).json({
      message: 'Payment order created',

      order: {
        id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency
      },

      plan: {
        id: plan.id,
        name: plan.name,
        interval: plan.interval
      },

      paymentRecordId: savedOrder.id,

      razorpayKeyId:
        process.env.RAZORPAY_KEY_ID
    });

  } catch (error) {
    console.error(
      '❌ Razorpay create order error:',
      error
    );

    return res.status(500).json({
      error: 'Unable to create payment order'
    });
  }
});

// =====================================================
// VERIFY RAZORPAY PAYMENT
// =====================================================

router.post('/verify', authenticate, async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    } = req.body || {};

    if (
      typeof razorpay_order_id !== 'string' ||
      typeof razorpay_payment_id !== 'string' ||
      typeof razorpay_signature !== 'string'
    ) {
      return res.status(400).json({
        error: 'Invalid payment verification data'
      });
    }

    // -------------------------------------------------
    // Find our server-created order
    // -------------------------------------------------

    const {
      data: paymentOrder,
      error: paymentOrderError
    } = await supabase
      .from('payment_orders')
      .select('*')
      .eq(
        'provider_order_id',
        razorpay_order_id
      )
      .eq(
        'user_id',
        req.user.id
      )
      .maybeSingle();

    if (paymentOrderError) {
      console.error(
        '❌ Payment order lookup error:',
        paymentOrderError
      );

      return res.status(500).json({
        error: 'Unable to verify payment'
      });
    }

    if (!paymentOrder) {
      return res.status(404).json({
        error: 'Payment order not found'
      });
    }

    // -------------------------------------------------
    // Idempotency:
    // already verified payment should not be processed again
    // -------------------------------------------------

    if (
      paymentOrder.status === 'paid' &&
      paymentOrder.signature_verified === true
    ) {
      return res.json({
        success: true,
        message: 'Payment already verified',
        planId: paymentOrder.plan_id,
        paymentId:
          paymentOrder.provider_payment_id
      });
    }

    // -------------------------------------------------
    // Verify Razorpay signature
    // -------------------------------------------------

    const generatedSignature =
      crypto
        .createHmac(
          'sha256',
          process.env.RAZORPAY_KEY_SECRET
        )
        .update(
          `${razorpay_order_id}|${razorpay_payment_id}`
        )
        .digest('hex');

    const suppliedBuffer =
      Buffer.from(razorpay_signature, 'utf8');

    const generatedBuffer =
      Buffer.from(generatedSignature, 'utf8');

    if (
      suppliedBuffer.length !==
      generatedBuffer.length ||
      !crypto.timingSafeEqual(
        suppliedBuffer,
        generatedBuffer
      )
    ) {
      console.warn(
        '⚠️ Invalid Razorpay payment signature',
        {
          userId: req.user.id,
          orderId: razorpay_order_id
        }
      );

      return res.status(400).json({
        error: 'Payment verification failed'
      });
    }

    // -------------------------------------------------
    // Verify that payment amount/order is consistent
    // -------------------------------------------------

    const plan = PLANS[paymentOrder.plan_id];

    if (!plan) {
      return res.status(500).json({
        error: 'Invalid stored plan'
      });
    }

    if (
      paymentOrder.amount_paise !==
      plan.amountPaise ||
      paymentOrder.currency !==
      plan.currency
    ) {
      console.error(
        '❌ Payment amount mismatch',
        {
          orderId: razorpay_order_id,
          storedAmount: paymentOrder.amount_paise,
          expectedAmount: plan.amountPaise
        }
      );

      return res.status(400).json({
        error: 'Payment amount mismatch'
      });
    }

    // -------------------------------------------------
    // Save verified payment
    // -------------------------------------------------

    const {
      data: updatedOrder,
      error: updateError
    } = await supabase
      .from('payment_orders')
      .update({
        provider_payment_id:
          razorpay_payment_id,
        status: 'paid',
        signature_verified: true,
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq(
        'id',
        paymentOrder.id
      )
      .eq(
        'status',
        'created'
      )
      .select()
      .maybeSingle();

    if (updateError) {
      console.error(
        '❌ Payment update error:',
        updateError
      );

      return res.status(500).json({
        error: 'Payment was verified but could not be recorded'
      });
    }

    if (!updatedOrder) {
      // Another request may have processed it already.
      const {
        data: currentOrder
      } = await supabase
        .from('payment_orders')
        .select(
          'status, signature_verified, provider_payment_id, plan_id'
        )
        .eq(
          'id',
          paymentOrder.id
        )
        .maybeSingle();

      if (
        currentOrder?.status === 'paid' &&
        currentOrder?.signature_verified === true
      ) {
        return res.json({
          success: true,
          message: 'Payment already verified',
          planId: currentOrder.plan_id,
          paymentId:
            currentOrder.provider_payment_id
        });
      }

      return res.status(409).json({
        error: 'Payment processing conflict'
      });
    }

    // -------------------------------------------------
    // IMPORTANT:
    // Subscription/plan activation will be connected
    // in the next payment step.
    // -------------------------------------------------

    return res.json({
      success: true,
      message: 'Payment verified successfully',
      planId: paymentOrder.plan_id,
      paymentId: razorpay_payment_id,
      amount: paymentOrder.amount_paise / 100,
      currency: paymentOrder.currency
    });

  } catch (error) {
    console.error(
      '❌ Razorpay verification error:',
      error
    );

    return res.status(500).json({
      error: 'Unable to verify payment'
    });
  }
});

// =====================================================
// EXPORT
// =====================================================

module.exports = router;
