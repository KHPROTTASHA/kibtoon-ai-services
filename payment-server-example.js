/**
 * payment-server-example.js
 * -----------------------------------------------------------------------
 * REFERENCE ONLY — this file is not run anywhere in the current project.
 * It is NOT wired up, NOT deployed, and has NO effect on the static site.
 *
 * payment.html is already built to call two endpoints:
 *   POST /api/create-checkout-session
 *   GET  /api/verify-session?session_id=...
 *
 * Until a real backend exposing those two endpoints exists, payment.html
 * will honestly show "Payment processing is not connected yet." — it will
 * never fake a successful charge.
 *
 * This file shows exactly what those two endpoints need to do, using
 * Stripe's Node SDK and Stripe Checkout Sessions (the redirect model, where
 * the buyer enters their card on Stripe's own hosted page — this backend
 * never sees or touches raw card numbers, so it stays out of PCI scope).
 *
 * TO ACTUALLY GO LIVE:
 *   1. Deploy this (or equivalent) on a real server — Node/Express here,
 *      but any backend stack works the same way.
 *   2. `npm install express stripe`
 *   3. Create a Stripe account, grab your SECRET key from the Stripe
 *      Dashboard, and set it as an environment variable — NEVER hard-code
 *      it, NEVER commit it, and NEVER put it in payment.html or any other
 *      frontend file.
 *   4. Set up a webhook (see bottom of this file) so payment confirmation
 *      does not rely solely on the customer's browser redirecting back —
 *      per the project's own security requirements, an order should never
 *      be marked "paid" from frontend JavaScript alone.
 *   5. Point payment.html's fetch() calls at this server's real URL
 *      (same-origin, or update the fetch paths + CORS config if separate).
 * -----------------------------------------------------------------------
 */

const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY); // server-side only, from env

const app = express();

// The Checkout Session creation endpoint needs raw JSON body parsing.
app.use('/api/create-checkout-session', express.json());
app.use('/api/verify-session', express.json());

// Mirrors the plan data in payment.html — in a real project, keep this in
// one shared place (e.g. a database or a shared config) so it never drifts
// out of sync with what the frontend displays.
const PLANS = {
  'site-diagnostic': { name: 'Site Diagnostic', amountCents: 850000, billing: 'audit' },
  'full-build': { name: 'Full Build Intelligence', amountCents: 2400000, billing: 'month' },
  // 'portfolio-command' is intentionally excluded — it's a contact-sales
  // plan and should never reach this endpoint; payment.html already routes
  // it to the consultation flow instead of checkout.
};

/**
 * POST /api/create-checkout-session
 * Body: { planId: string, customer: { name, email, company, phone } }
 * Response: { url: string }  — a Stripe-hosted Checkout URL to redirect to.
 */
app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const { planId, customer } = req.body || {};
    const plan = PLANS[planId];

    if (!plan) {
      return res.status(400).json({ error: 'Unknown plan.' });
    }
    if (!customer || !customer.email) {
      return res.status(400).json({ error: 'Customer email is required.' });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment', // use 'subscription' instead for the recurring Full Build Intelligence plan, with a Stripe Price object rather than price_data
      payment_method_types: ['card'],
      customer_email: customer.email,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: plan.amountCents,
            product_data: { name: plan.name },
          },
          quantity: 1,
        },
      ],
      metadata: {
        planId,
        customerName: customer.name || '',
        customerCompany: customer.company || '',
        customerPhone: customer.phone || '',
      },
      success_url: `${process.env.SITE_URL}/payment.html?plan=${planId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.SITE_URL}/payment.html?plan=${planId}&status=cancelled`,
    });

    return res.json({ url: session.url });
  } catch (err) {
    console.error('create-checkout-session error:', err.message);
    return res.status(500).json({ error: 'Could not create checkout session.' });
  }
});

/**
 * GET /api/verify-session?session_id=...
 * Response: { paid: boolean, reference?: string }
 *
 * This is what payment.html calls when the browser returns from Stripe.
 * It re-checks payment status directly with Stripe rather than trusting
 * the browser's return URL — the frontend never marks an order "paid" on
 * its own.
 */
app.get('/api/verify-session', async (req, res) => {
  try {
    const sessionId = req.query.session_id;
    if (!sessionId) {
      return res.status(400).json({ error: 'Missing session_id.' });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const paid = session.payment_status === 'paid';

    // In production, look up (or create) your own order record here —
    // keyed by session.id — rather than trusting this response alone for
    // anything beyond what to show the customer right now. The webhook
    // below is the source of truth for actually fulfilling the order.
    return res.json({
      paid,
      reference: paid ? session.id : undefined,
    });
  } catch (err) {
    console.error('verify-session error:', err.message);
    return res.status(500).json({ error: 'Could not verify session.' });
  }
});

/**
 * Webhook endpoint — the actually-reliable way to know a payment succeeded.
 * Register this URL in the Stripe Dashboard (Developers > Webhooks) and
 * listen for `checkout.session.completed`. This fires from Stripe's
 * servers directly, independent of whether the customer's browser ever
 * makes it back to success_url — so it's what should actually mark an
 * order "paid" / trigger onboarding, not the /verify-session call above.
 *
 * Needs the raw request body for signature verification, so it's mounted
 * with express.raw() instead of express.json() (note the separate route
 * registration below, before any global JSON body-parser would run).
 */
app.post(
  '/api/stripe-webhook',
  express.raw({ type: 'application/json' }),
  (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET // also server-side only, from env
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      // TODO: mark the corresponding order as paid in your database here,
      // using session.metadata.planId / session.customer_email / session.id.
      console.log('Payment confirmed for session:', session.id);
    }

    res.json({ received: true });
  }
);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Reference payment backend listening on port ${PORT}`);
});

module.exports = app;