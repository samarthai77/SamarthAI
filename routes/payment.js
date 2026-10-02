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
    interval: 'monthly',
    razorpayPlanId: 'plan_TivCWQkgKrBgYu'
  },

  pro: {
    id: 'pro',
    name: 'Pro',
    amountPaise: 39900,
    currency: 'INR',
    interval: 'monthly',
    razorpayPlanId: 'plan_TivJP4hWeedOTc'
  },

  premium: {
    id: 'premium',
    name: 'Premium',
    amountPaise: 149900,
    currency: 'INR',
    interval: 'monthly',
    razorpayPlanId: 'plan_TivOtAX2W1DKV3'
  },

  power: {
    id: 'power',
    name: 'Power',
    amountPaise: 299900,
    currency: 'INR',
    interval: 'monthly',
    razorpayPlanId: 'plan_TivScGKHiQme7k'
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
// CREATE RAZORPAY RECURRING SUBSCRIPTION
// =====================================================

router.post('/create-subscription', authenticate, async (req, res) => {
  try {
    const planId =
      typeof req.body?.planId === 'string'
        ? req.body.planId.trim().toLowerCase()
        : '';

    const plan = PLANS[planId];

    if (!plan) {
      return res.status(400).json({
        error: 'Invalid plan'
      });
    }

    if (!plan.razorpayPlanId) {
      return res.status(500).json({
        error: 'Razorpay plan is not configured'
      });
    }

    // -------------------------------------------------
    // Prevent duplicate pending/active subscriptions
    // for the same user and plan.
    // -------------------------------------------------

    const { data: existingSubscriptions, error: existingError } =
      await supabase
        .from('subscriptions')
        .select(
          'id, provider_subscription_id, provider_plan_id, plan_id, status'
        )
        .eq('user_id', req.user.id)
        .eq('plan_id', plan.id)
        .in('status', [
          'created',
          'authenticated',
          'active'
        ])
        .order('created_at', {
          ascending: false
        })
        .limit(1);

    if (existingError) {
      console.error(
        '❌ Existing subscription lookup error:',
        existingError
      );

      return res.status(500).json({
        error: 'Unable to create subscription'
      });
    }

    const existingSubscription =
      existingSubscriptions?.[0];

    if (existingSubscription) {
      return res.json({
        message: 'Existing subscription available',

        subscription: {
          id:
            existingSubscription.provider_subscription_id,
          planId: existingSubscription.plan_id,
          status: existingSubscription.status
        },

        plan: {
          id: plan.id,
          name: plan.name,
          amount: plan.amountPaise / 100,
          currency: plan.currency,
          interval: plan.interval
        },

        razorpayKeyId:
          process.env.RAZORPAY_KEY_ID
      });
    }

    // -------------------------------------------------
    // Create Razorpay recurring subscription.
    //
    // 120 monthly cycles = 10 years.
    // This avoids using a one-time payment order.
    // -------------------------------------------------

    const razorpaySubscription =
      await razorpay.subscriptions.create({
        plan_id: plan.razorpayPlanId,
        total_count: 120,
        quantity: 1,
        customer_notify: true,

        notes: {
          user_id: String(req.user.id),
          plan_id: plan.id,
          plan_name: plan.name
        }
      });

    if (!razorpaySubscription?.id) {
      throw new Error(
        'Razorpay did not return a subscription ID'
      );
    }

    // -------------------------------------------------
    // Save subscription in Supabase
    // -------------------------------------------------

    const unixToDate = (value) =>
      Number.isFinite(Number(value))
        ? new Date(Number(value) * 1000).toISOString()
        : null;

    const {
      data: savedSubscription,
      error: saveError
    } = await supabase
      .from('subscriptions')
      .insert([
        {
          user_id: req.user.id,
          provider: 'razorpay',

          provider_subscription_id:
            razorpaySubscription.id,

          provider_plan_id:
            plan.razorpayPlanId,

          plan_id:
            plan.id,

          currency:
            plan.currency,

          status:
            razorpaySubscription.status || 'created',

          current_start:
            unixToDate(
              razorpaySubscription.current_start
            ),

          current_end:
            unixToDate(
              razorpaySubscription.current_end
            ),

          started_at:
            unixToDate(
              razorpaySubscription.start_at
            ),

          ended_at:
            unixToDate(
              razorpaySubscription.ended_at
            ),

          total_count:
            razorpaySubscription.total_count ?? 120,

          paid_count:
            razorpaySubscription.paid_count ?? 0,

          remaining_count:
            razorpaySubscription.remaining_count ?? 120,

          created_at:
            new Date().toISOString(),

          updated_at:
            new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (saveError) {
      console.error(
        '❌ Subscription database error:',
        saveError
      );

      // If Razorpay created it but local DB failed,
      // do not silently pretend that creation failed.
      return res.status(500).json({
        error:
          'Subscription created but could not be saved'
      });
    }

    return res.status(201).json({
      success: true,
      message:
        'Recurring subscription created',

      subscription: {
        id:
          razorpaySubscription.id,

        status:
          razorpaySubscription.status,

        shortUrl:
          razorpaySubscription.short_url,

        totalCount:
          razorpaySubscription.total_count,

        remainingCount:
          razorpaySubscription.remaining_count
      },

      plan: {
        id: plan.id,
        name: plan.name,
        amount: plan.amountPaise / 100,
        currency: plan.currency,
        interval: plan.interval
      },

      paymentRecordId:
        savedSubscription.id,

      razorpayKeyId:
        process.env.RAZORPAY_KEY_ID
    });

  } catch (error) {
    console.error(
      '❌ Razorpay create subscription error:',
      error
    );

    return res.status(500).json({
      error:
        'Unable to create subscription'
    });
  }
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
// RAZORPAY SUBSCRIPTION WEBHOOK
// =====================================================

router.post('/webhook', async (req, res) => {
  try {
    // -------------------------------------------------
    // 1. Webhook secret must exist
    // -------------------------------------------------

    const webhookSecret =
      process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error(
        '❌ RAZORPAY_WEBHOOK_SECRET is not configured'
      );

      return res.status(500).json({
        error: 'Webhook is not configured'
      });
    }

    // -------------------------------------------------
    // 2. Raw request body is required for HMAC
    // -------------------------------------------------

    if (!Buffer.isBuffer(req.body)) {
      console.error(
        '❌ Razorpay webhook raw body is missing'
      );

      return res.status(400).json({
        error: 'Invalid webhook body'
      });
    }

    const rawBody = req.body;

    // -------------------------------------------------
    // 3. Verify Razorpay webhook signature
    // -------------------------------------------------

    const receivedSignature =
      req.headers['x-razorpay-signature'];

    if (
      typeof receivedSignature !== 'string' ||
      !receivedSignature
    ) {
      return res.status(400).json({
        error: 'Webhook signature missing'
      });
    }

    const generatedSignature =
      crypto
        .createHmac(
          'sha256',
          webhookSecret
        )
        .update(rawBody)
        .digest('hex');

    const receivedBuffer =
      Buffer.from(
        receivedSignature,
        'utf8'
      );

    const generatedBuffer =
      Buffer.from(
        generatedSignature,
        'utf8'
      );

    if (
      receivedBuffer.length !==
        generatedBuffer.length ||
      !crypto.timingSafeEqual(
        receivedBuffer,
        generatedBuffer
      )
    ) {
      console.warn(
        '⚠️ Invalid Razorpay webhook signature'
      );

      return res.status(400).json({
        error: 'Invalid webhook signature'
      });
    }

    // -------------------------------------------------
    // 4. Parse verified payload
    // -------------------------------------------------

    let payload;

    try {
      payload = JSON.parse(
        rawBody.toString('utf8')
      );
    } catch (parseError) {
      console.error(
        '❌ Invalid Razorpay webhook JSON:',
        parseError
      );

      return res.status(400).json({
        error: 'Invalid webhook payload'
      });
    }

    const eventType = payload?.event;

    if (
      typeof eventType !== 'string' ||
      !eventType
    ) {
      return res.status(400).json({
        error: 'Webhook event missing'
      });
    }

    // -------------------------------------------------
    // 5. Get Razorpay event ID
    // -------------------------------------------------

    const eventIdHeader =
      req.headers['x-razorpay-event-id'];

    const eventId =
      typeof eventIdHeader === 'string' &&
      eventIdHeader.trim()
        ? eventIdHeader.trim()
        : crypto
            .createHash('sha256')
            .update(rawBody)
            .digest('hex');

    // -------------------------------------------------
    // 6. Idempotency
    // -------------------------------------------------

    const {
      data: existingEvent,
      error: existingEventError
    } = await supabase
      .from('payment_webhook_events')
      .select(
        'id, processed'
      )
      .eq(
        'event_id',
        eventId
      )
      .maybeSingle();

    if (existingEventError) {
      console.error(
        '❌ Webhook event lookup error:',
        existingEventError
      );

      return res.status(500).json({
        error: 'Webhook processing failed'
      });
    }

    if (
      existingEvent?.processed === true
    ) {
      return res.status(200).json({
        success: true,
        message: 'Webhook already processed'
      });
    }

    // -------------------------------------------------
    // 7. Save webhook event
    // -------------------------------------------------

    if (!existingEvent) {
      const {
        error: webhookInsertError
      } = await supabase
        .from('payment_webhook_events')
        .insert([
          {
            provider: 'razorpay',
            event_id: eventId,
            event_type: eventType,
            payload,
            processed: false
          }
        ]);

      if (webhookInsertError) {
        // Another simultaneous request may have
        // inserted the same event first.
        if (
          webhookInsertError.code !== '23505'
        ) {
          console.error(
            '❌ Webhook event insert error:',
            webhookInsertError
          );

          return res.status(500).json({
            error: 'Webhook processing failed'
          });
        }
      }
    }
// -------------------------------------------------
// INVOICE WEBHOOKS
// -------------------------------------------------

const invoice =
  payload?.payload?.invoice?.entity;

const invoiceEvents = new Set([
  'invoice.paid',
  'invoice.partially_paid',
  'invoice.expired'
]);

if (invoiceEvents.has(eventType)) {

  const invoiceId =
    invoice?.id;

  const providerSubscriptionId =
    invoice?.subscription_id;

  if (
    typeof invoiceId !== 'string' ||
    !invoiceId
  ) {
    console.warn(
      '⚠️ Invoice ID missing in webhook',
      {
        eventType,
        eventId
      }
    );

    await supabase
      .from('payment_webhook_events')
      .update({
        processed: true,
        processed_at:
          new Date().toISOString()
      })
      .eq(
        'event_id',
        eventId
      );

    return res.status(200).json({
      success: true
    });
  }

  // -------------------------------------------------
  // Find local subscription
  // -------------------------------------------------

  let localSubscription = null;

  if (
    typeof providerSubscriptionId === 'string' &&
    providerSubscriptionId
  ) {

    const {
      data,
      error
    } = await supabase
      .from('subscriptions')
      .select(
        'id, user_id, plan_id, provider_subscription_id, status'
      )
      .eq(
        'provider_subscription_id',
        providerSubscriptionId
      )
      .maybeSingle();

    if (error) {

      console.error(
        '❌ Invoice subscription lookup error:',
        error
      );

      return res.status(500).json({
        error: 'Invoice processing failed'
      });
    }

    localSubscription = data;
  }

  if (!localSubscription) {

    console.error(
      '❌ Invoice could not be linked to subscription',
      {
        invoiceId,
        providerSubscriptionId,
        eventType
      }
    );

    return res.status(500).json({
      error: 'Invoice could not be linked'
    });
  }

  // -------------------------------------------------
  // Determine invoice status
  // -------------------------------------------------

  let invoiceStatus = 'issued';

  if (
    eventType === 'invoice.paid'
  ) {
    invoiceStatus = 'paid';
  }

  if (
    eventType === 'invoice.partially_paid'
  ) {
    invoiceStatus = 'partially_paid';
  }

  if (
    eventType === 'invoice.expired'
  ) {
    invoiceStatus = 'expired';
  }

  // -------------------------------------------------
  // Convert Unix timestamp
  // -------------------------------------------------

  const invoiceUnixToDate = (value) =>
    Number.isFinite(Number(value))
      ? new Date(
          Number(value) * 1000
        ).toISOString()
      : null;

  // -------------------------------------------------
  // Save / update invoice
  // -------------------------------------------------

  const invoiceRecord = {

    user_id:
      localSubscription.user_id,

    subscription_id:
      localSubscription.id,

    provider:
      'razorpay',

    provider_invoice_id:
      invoiceId,

    provider_subscription_id:
      providerSubscriptionId || null,

    invoice_number:
      invoice?.invoice_number ||
      invoice?.receipt ||
      null,

    status:
      invoiceStatus,

    currency:
      invoice?.currency ||
      'INR',

    amount_paise:
      Number.isFinite(
        Number(invoice?.amount)
      )
        ? Number(invoice.amount)
        : null,

    amount_paid_paise:
      Number.isFinite(
        Number(invoice?.amount_paid)
      )
        ? Number(invoice.amount_paid)
        : null,

    amount_due_paise:
      Number.isFinite(
        Number(invoice?.amount_due)
      )
        ? Number(invoice.amount_due)
        : null,

    short_url:
      invoice?.short_url ||
      null,

    pdf_url:
      invoice?.pdf_url ||
      null,

    issued_at:
      invoiceUnixToDate(
        invoice?.issued_at
      ),

    paid_at:
      invoiceStatus === 'paid'
        ? (
            invoiceUnixToDate(
              invoice?.paid_at
            ) ||
            new Date().toISOString()
          )
        : null,

    payload:
      payload,

    updated_at:
      new Date().toISOString()
  };

  const {
    error: invoiceUpsertError
  } = await supabase
    .from('payment_invoices')
    .upsert(
      invoiceRecord,
      {
        onConflict:
          'provider_invoice_id'
      }
    );

  if (invoiceUpsertError) {

    console.error(
      '❌ Invoice database error:',
      invoiceUpsertError
    );

    return res.status(500).json({
      error: 'Invoice processing failed'
    });
  }

  // -------------------------------------------------
  // Activate subscription only after successful
  // invoice payment.
  // -------------------------------------------------

  if (
    eventType === 'invoice.paid'
  ) {

    const {
      error: activateError
    } = await supabase
      .from('subscriptions')
      .update({
        status: 'active',
        updated_at:
          new Date().toISOString()
      })
      .eq(
        'id',
        localSubscription.id
      );

    if (activateError) {

      console.error(
        '❌ Subscription activation error:',
        activateError
      );

      return res.status(500).json({
        error:
          'Invoice paid but subscription activation failed'
      });
    }
  }

  // -------------------------------------------------
  // Mark webhook processed
  // -------------------------------------------------

  const {
    error: invoiceProcessedError
  } = await supabase
    .from('payment_webhook_events')
    .update({
      processed: true,
      processed_at:
        new Date().toISOString()
    })
    .eq(
      'event_id',
      eventId
    );

  if (invoiceProcessedError) {

    console.error(
      '❌ Invoice webhook processed-state error:',
      invoiceProcessedError
    );

    return res.status(500).json({
      error: 'Invoice processing failed'
    });
  }

  return res.status(200).json({
    success: true,
    invoiceId,
    status: invoiceStatus
  });
}
    // -------------------------------------------------
    // 8. Extract subscription entity
    // -------------------------------------------------

    const subscription =
      payload?.payload?.subscription?.entity;

    const subscriptionId =
      subscription?.id;

    if (
      typeof subscriptionId !== 'string' ||
      !subscriptionId
    ) {
      // This should not happen for the subscription
      // events configured in Razorpay Dashboard.
      console.warn(
        '⚠️ Subscription entity missing in webhook',
        {
          eventType,
          eventId
        }
      );

      await supabase
        .from('payment_webhook_events')
        .update({
          processed: true,
          processed_at:
            new Date().toISOString()
        })
        .eq(
          'event_id',
          eventId
        );

      return res.status(200).json({
        success: true,
        message: 'Webhook received'
      });
    }

    // -------------------------------------------------
    // 9. Find local subscription
    // -------------------------------------------------

    const {
      data: localSubscription,
      error: subscriptionLookupError
    } = await supabase
      .from('subscriptions')
      .select(
        'id, user_id, plan_id, provider_plan_id, status'
      )
      .eq(
        'provider_subscription_id',
        subscriptionId
      )
      .maybeSingle();

    if (subscriptionLookupError) {
      console.error(
        '❌ Subscription lookup error:',
        subscriptionLookupError
      );

      return res.status(500).json({
        error: 'Webhook processing failed'
      });
    }

    // -------------------------------------------------
    // 10. Determine subscription status
    // -------------------------------------------------

    const statusFromEntity =
      typeof subscription?.status === 'string'
        ? subscription.status.toLowerCase()
        : '';

    const eventStatusMap = {
      'subscription.authenticated':
        'authenticated',

      'subscription.activated':
        'active',

      'subscription.charged':
        'active',

      'subscription.pending':
        'pending',

      'subscription.halted':
        'halted',

      'subscription.cancelled':
        'cancelled',

      'subscription.completed':
        'completed',

      'subscription.paused':
        'paused',

      'subscription.resumed':
        'active'
    };

    const allowedStatuses = new Set([
      'created',
      'pending',
      'authenticated',
      'active',
      'paused',
      'cancelled',
      'completed',
      'expired',
      'halted'
    ]);

    let nextStatus =
      eventStatusMap[eventType] ||
      statusFromEntity;

    if (
      !allowedStatuses.has(nextStatus)
    ) {
      nextStatus =
        localSubscription?.status ||
        'created';
    }

    // -------------------------------------------------
    // 11. Convert Razorpay Unix timestamp to ISO
    // -------------------------------------------------

    const unixToDate = (value) =>
      Number.isFinite(Number(value))
        ? new Date(
            Number(value) * 1000
          ).toISOString()
        : null;

    const subscriptionUpdate = {
      status: nextStatus,

      current_start:
        unixToDate(
          subscription?.current_start
        ),

      current_end:
        unixToDate(
          subscription?.current_end
        ),

      started_at:
        unixToDate(
          subscription?.start_at
        ),

      ended_at:
        unixToDate(
          subscription?.ended_at
        ),

      total_count:
        subscription?.total_count ??
        null,

      paid_count:
        subscription?.paid_count ??
        null,

      remaining_count:
        subscription?.remaining_count ??
        null,

      cancel_at_cycle_end:
        subscription?.cancel_at_cycle_end ??
        false,

      updated_at:
        new Date().toISOString()
    };

    // -------------------------------------------------
    // 12. Update local subscription
    // -------------------------------------------------

    if (localSubscription) {
      const {
        error: updateSubscriptionError
      } = await supabase
        .from('subscriptions')
        .update(subscriptionUpdate)
        .eq(
          'id',
          localSubscription.id
        );

      if (updateSubscriptionError) {
        console.error(
          '❌ Subscription update error:',
          updateSubscriptionError
        );

        return res.status(500).json({
          error: 'Webhook processing failed'
        });
      }
    } else {
      // -------------------------------------------------
      // Safety fallback:
      // If Razorpay has a subscription that is not yet
      // present locally, create the local record when
      // enough trusted information is available.
      // -------------------------------------------------

      const notes =
        subscription?.notes || {};

      const userId =
        typeof notes.user_id === 'string'
          ? notes.user_id
          : null;

      const planIdFromNotes =
        typeof notes.plan_id === 'string'
          ? notes.plan_id
          : null;

      if (
        !userId ||
        !planIdFromNotes ||
        !PLANS[planIdFromNotes]
      ) {
        console.error(
          '❌ Cannot link Razorpay subscription to user',
          {
            subscriptionId,
            eventType
          }
        );

        return res.status(500).json({
          error: 'Subscription could not be linked'
        });
      }

      const {
        error: insertSubscriptionError
      } = await supabase
        .from('subscriptions')
        .insert([
          {
            user_id: userId,
            provider: 'razorpay',

            provider_subscription_id:
              subscriptionId,

            provider_plan_id:
              subscription?.plan_id ||
              PLANS[planIdFromNotes]
                .razorpayPlanId,

            plan_id:
              planIdFromNotes,

            currency:
              subscription?.currency ||
              PLANS[planIdFromNotes]
                .currency,

            ...subscriptionUpdate,

            created_at:
              new Date().toISOString()
          }
        ]);

      if (insertSubscriptionError) {
        console.error(
          '❌ Subscription fallback insert error:',
          insertSubscriptionError
        );

        return res.status(500).json({
          error: 'Webhook processing failed'
        });
      }
    }

    // -------------------------------------------------
    // 13. Mark webhook as processed
    // -------------------------------------------------

    const {
      error: processedError
    } = await supabase
      .from('payment_webhook_events')
      .update({
        processed: true,
        processed_at:
          new Date().toISOString()
      })
      .eq(
        'event_id',
        eventId
      );

    if (processedError) {
      console.error(
        '❌ Webhook processed-state error:',
        processedError
      );

      return res.status(500).json({
        error: 'Webhook processing failed'
      });
    }

    // -------------------------------------------------
    // 14. Fast success response
    // -------------------------------------------------

    return res.status(200).json({
      success: true
    });

  } catch (error) {
    console.error(
      '❌ Razorpay webhook error:',
      error
    );

    return res.status(500).json({
      error: 'Webhook processing failed'
    });
  }
});
// =====================================================
// EXPORT
// =====================================================

module.exports = router;
