// create-checkout-session — Supabase Edge Function
// Creates a Stripe Checkout Session for Starter, Pro, or Max subscription

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@13?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2023-10-16' })

const PRICE_IDS: Record<string, string> = {
  starter_monthly: Deno.env.get('STRIPE_PRICE_STARTER_MONTHLY')!,
  starter_yearly: Deno.env.get('STRIPE_PRICE_STARTER_YEARLY')!,
  pro_monthly: Deno.env.get('STRIPE_PRICE_PRO_MONTHLY')!,
  pro_yearly: Deno.env.get('STRIPE_PRICE_PRO_YEARLY')!,
  max_monthly: Deno.env.get('STRIPE_PRICE_MAX_MONTHLY')!,
  max_yearly: Deno.env.get('STRIPE_PRICE_MAX_YEARLY')!,
}

const ALLOWED_ORIGINS = [
  'https://spiros.app',
  'https://www.spiros.app',
  'https://getspiros.com',
  'https://www.getspiros.com',
]

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') || ''
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { planKey } = await req.json()
    const priceId = PRICE_IDS[planKey]
    if (!priceId) {
      return new Response(JSON.stringify({ error: 'Invalid plan' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Look up or create Stripe customer
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .single()

    let customerId = sub?.stripe_customer_id

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      })
      customerId = customer.id

      // Upsert subscription row with customer ID
      await supabase.from('subscriptions').upsert({
        user_id: user.id,
        stripe_customer_id: customerId,
        tier: 'free',
        status: 'active',
      }, { onConflict: 'user_id' })
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: 'https://spiros.app/subscribe?status=success',
      cancel_url: 'https://spiros.app/subscribe?status=cancel',
      metadata: { supabase_user_id: user.id },
    })

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
