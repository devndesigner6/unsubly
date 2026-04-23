import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { SubscriptionAlertEmail } from '../_shared/email-templates/subscription-alert.tsx'
import { WeeklyDigestEmail } from '../_shared/email-templates/weekly-digest.tsx'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SITE_NAME = 'Unsubscribely'
const SITE_URL = Deno.env.get('SITE_URL') || 'https://unsubscribely.app'
const FROM_EMAIL = `${SITE_NAME} <alerts@notify.unsubscribely.app>`

async function sendViaResend(to: string, subject: string, html: string, text: string) {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) {
    return { sent: false, reason: 'RESEND_API_KEY not configured — add it as a Supabase secret to enable real email sending' }
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html, text }),
  })

  const data = await res.json()
  if (!res.ok) {
    throw new Error(data?.message || `Resend API error: ${res.status}`)
  }
  return { sent: true, id: data.id }
}

function daysUntil(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr)
  target.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function toMonthly(amount: number, cycle: string): number {
  if (cycle === 'yearly') return amount / 12
  if (cycle === 'quarterly') return amount / 3
  if (cycle === 'weekly') return amount * 4.33
  return amount
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json().catch(() => ({}))
    const alertType: 'test' | 'alerts' | 'digest' = body.type || 'alerts'

    // Fetch the user's profile and subscriptions
    const [profileRes, subsRes] = await Promise.all([
      supabaseAdmin.from('profiles').select('*').eq('id', user.id).single(),
      supabaseAdmin
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('next_billing_date', { ascending: true }),
    ])

    const profile = profileRes.data
    const subscriptions = subsRes.data || []
    const userEmail = user.email!
    const recipientName = profile?.name || undefined
    const alertDays = profile?.default_alert_days ?? 3
    const currency = profile?.currency || 'USD'

    if (alertType === 'test') {
      // Send a test with all subscriptions due within 30 days (show something useful)
      const testSubs = subscriptions
        .map((sub: any) => ({
          name: sub.name,
          amount: sub.amount,
          currency: sub.currency || currency,
          daysUntil: daysUntil(sub.next_billing_date),
          billingDate: new Date(sub.next_billing_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          billingCycle: sub.billing_cycle,
        }))
        .filter((s: any) => s.daysUntil <= 30 && s.daysUntil >= 0)
        .slice(0, 5)

      // No fake placeholder data, if the user has nothing due in the next 30 days
      // we tell them so honestly, then send an empty-state email so they can still
      // confirm delivery is working.
      const displaySubs = testSubs

      const html = await renderAsync(
        React.createElement(SubscriptionAlertEmail, {
          siteName: SITE_NAME,
          siteUrl: SITE_URL,
          recipientName,
          subscriptions: displaySubs,
        })
      )
      const text = await renderAsync(
        React.createElement(SubscriptionAlertEmail, {
          siteName: SITE_NAME,
          siteUrl: SITE_URL,
          recipientName,
          subscriptions: displaySubs,
        }),
        { plainText: true }
      )

      const subject = `[Test] Subscription Renewal Reminder — ${SITE_NAME}`
      const result = await sendViaResend(userEmail, subject, html, text)
      console.log(`Test alert for ${userEmail}:`, result)
      return new Response(JSON.stringify({ ...result, emailType: 'test', subscriptionsShown: displaySubs.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (alertType === 'alerts') {
      // Only send if user has email_alerts enabled
      if (!profile?.email_alerts) {
        return new Response(JSON.stringify({ sent: false, reason: 'Email alerts disabled for this user' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const dueSubs = subscriptions
        .filter((sub: any) => sub.alert_enabled !== false)
        .map((sub: any) => ({
          ...sub,
          _daysUntil: daysUntil(sub.next_billing_date),
        }))
        .filter((sub: any) => sub._daysUntil >= 0 && sub._daysUntil <= alertDays)

      if (dueSubs.length === 0) {
        return new Response(JSON.stringify({ sent: false, reason: 'No subscriptions due within alert window', alertDays }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const emailSubs = dueSubs.map((sub: any) => ({
        name: sub.name,
        amount: sub.amount,
        currency: sub.currency || currency,
        daysUntil: sub._daysUntil,
        billingDate: new Date(sub.next_billing_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        billingCycle: sub.billing_cycle,
      }))

      const html = await renderAsync(
        React.createElement(SubscriptionAlertEmail, {
          siteName: SITE_NAME,
          siteUrl: SITE_URL,
          recipientName,
          subscriptions: emailSubs,
        })
      )
      const text = await renderAsync(
        React.createElement(SubscriptionAlertEmail, {
          siteName: SITE_NAME,
          siteUrl: SITE_URL,
          recipientName,
          subscriptions: emailSubs,
        }),
        { plainText: true }
      )

      const subject = dueSubs.length === 1
        ? `Renewal Reminder: ${dueSubs[0].name} renews in ${dueSubs[0]._daysUntil} day(s)`
        : `${dueSubs.length} Subscriptions Renewing Soon`

      const result = await sendViaResend(userEmail, subject, html, text)
      console.log(`Alert email for ${userEmail}: ${dueSubs.length} subscription(s)`, result)
      return new Response(JSON.stringify({ ...result, emailType: 'alerts', count: dueSubs.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (alertType === 'digest') {
      if (!profile?.weekly_digest) {
        return new Response(JSON.stringify({ sent: false, reason: 'Weekly digest disabled for this user' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const totalMonthly = subscriptions.reduce((sum: number, sub: any) => sum + toMonthly(sub.amount || 0, sub.billing_cycle), 0)
      const totalYearly = totalMonthly * 12

      const upcomingThisWeek = subscriptions
        .map((sub: any) => ({ ...sub, _days: daysUntil(sub.next_billing_date) }))
        .filter((sub: any) => sub._days >= 0 && sub._days <= 7)
        .map((sub: any) => ({
          name: sub.name,
          amount: sub.amount,
          currency: sub.currency || currency,
          billingDate: new Date(sub.next_billing_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        }))

      const topSubscriptions = [...subscriptions]
        .sort((a: any, b: any) => toMonthly(b.amount, b.billing_cycle) - toMonthly(a.amount, a.billing_cycle))
        .slice(0, 5)
        .map((sub: any) => ({
          name: sub.name,
          amount: sub.amount,
          currency: sub.currency || currency,
          billingCycle: sub.billing_cycle,
        }))

      const html = await renderAsync(
        React.createElement(WeeklyDigestEmail, {
          siteName: SITE_NAME,
          siteUrl: SITE_URL,
          recipientName,
          totalMonthly: Math.round(totalMonthly * 100) / 100,
          totalYearly: Math.round(totalYearly * 100) / 100,
          currency,
          upcomingThisWeek,
          topSubscriptions,
        })
      )
      const text = await renderAsync(
        React.createElement(WeeklyDigestEmail, {
          siteName: SITE_NAME,
          siteUrl: SITE_URL,
          recipientName,
          totalMonthly: Math.round(totalMonthly * 100) / 100,
          totalYearly: Math.round(totalYearly * 100) / 100,
          currency,
          upcomingThisWeek,
          topSubscriptions,
        }),
        { plainText: true }
      )

      const result = await sendViaResend(userEmail, `Your Weekly Spending Digest — ${SITE_NAME}`, html, text)
      console.log(`Digest email for ${userEmail}:`, result)
      return new Response(JSON.stringify({ ...result, emailType: 'digest' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: `Unknown type: ${alertType}` }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('send-subscription-alerts error:', error)
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
