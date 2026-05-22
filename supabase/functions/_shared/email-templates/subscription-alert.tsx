/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html,
  Img, Link, Preview, Row, Column, Section, Text, Hr,
} from 'npm:@react-email/components@0.0.22'

interface SubscriptionAlertEmailProps {
  siteName: string
  siteUrl: string
  recipientName?: string
  subscriptions: Array<{
    name: string
    amount: number
    currency: string
    daysUntil: number
    billingDate: string
    billingCycle: string
  }>
}

export const SubscriptionAlertEmail = ({
  siteName = 'Unsubscribely',
  siteUrl = 'https://unsubly.xyz',
  recipientName,
  subscriptions = [],
}: SubscriptionAlertEmailProps) => {
  const previewText =
    subscriptions.length === 1
      ? `${subscriptions[0].name} renews in ${subscriptions[0].daysUntil} day(s) — ${subscriptions[0].amount} ${subscriptions[0].currency}`
      : `${subscriptions.length} subscriptions renewing soon`

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Img
            src="https://ipnywrvwszqlaykbkske.supabase.co/storage/v1/object/public/email-assets/logo.png"
            width="40"
            height="40"
            alt="Unsubscribely"
            style={logo}
          />
          <Heading style={h1}>Upcoming Renewal{subscriptions.length > 1 ? 's' : ''}</Heading>
          <Text style={text}>
            {recipientName ? `Hi ${recipientName}, you have` : 'You have'}{' '}
            <strong>{subscriptions.length}</strong> subscription{subscriptions.length !== 1 ? 's' : ''} renewing soon.
          </Text>

          {subscriptions.map((sub, i) => (
            <Section key={i} style={subCard}>
              <Row>
                <Column style={subNameCol}>
                  <Text style={subName}>{sub.name}</Text>
                  <Text style={subMeta}>{sub.billingCycle} · renews {sub.billingDate}</Text>
                </Column>
                <Column style={subAmountCol}>
                  <Text style={subAmount}>
                    {sub.amount} {sub.currency}
                  </Text>
                  <Text style={sub.daysUntil <= 1 ? urgentBadge : sub.daysUntil <= 3 ? soonBadge : normalBadge}>
                    {sub.daysUntil === 0 ? 'Today' : sub.daysUntil === 1 ? 'Tomorrow' : `In ${sub.daysUntil} days`}
                  </Text>
                </Column>
              </Row>
            </Section>
          ))}

          <Hr style={hr} />

          <Button style={button} href={`${siteUrl}/subscriptions`}>
            View All Subscriptions
          </Button>

          <Text style={footer}>
            You're receiving this because you have email alerts enabled in{' '}
            <Link href={`${siteUrl}/settings`} style={footerLink}>
              {siteName} Settings
            </Link>
            . Turn off alerts at any time.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export default SubscriptionAlertEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'DM Sans', Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '520px', margin: '0 auto' }
const logo = { marginBottom: '24px' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#1a1816', margin: '0 0 12px' }
const text = { fontSize: '15px', color: '#777370', lineHeight: '1.6', margin: '0 0 20px' }
const subCard = {
  backgroundColor: '#f7f4f0',
  borderRadius: '10px',
  padding: '14px 16px',
  marginBottom: '10px',
}
const subNameCol = { verticalAlign: 'top' as const }
const subAmountCol = { verticalAlign: 'top' as const, textAlign: 'right' as const, width: '110px' }
const subName = { fontSize: '14px', fontWeight: '600' as const, color: '#1a1816', margin: '0 0 2px' }
const subMeta = { fontSize: '12px', color: '#a8a5a0', margin: '0' }
const subAmount = { fontSize: '15px', fontWeight: '700' as const, color: '#1a1816', margin: '0 0 2px', textAlign: 'right' as const }
const urgentBadge = {
  fontSize: '11px', fontWeight: '600' as const, color: '#dc2626',
  backgroundColor: '#fef2f2', borderRadius: '4px', padding: '1px 6px', margin: '0',
  textAlign: 'right' as const,
}
const soonBadge = {
  fontSize: '11px', fontWeight: '600' as const, color: '#d97706',
  backgroundColor: '#fffbeb', borderRadius: '4px', padding: '1px 6px', margin: '0',
  textAlign: 'right' as const,
}
const normalBadge = {
  fontSize: '11px', fontWeight: '600' as const, color: '#059669',
  backgroundColor: '#ecfdf5', borderRadius: '4px', padding: '1px 6px', margin: '0',
  textAlign: 'right' as const,
}
const hr = { border: 'none', borderTop: '1px solid #e8e4e0', margin: '24px 0' }
const button = {
  backgroundColor: '#1a1816', color: '#f7f4f0', fontSize: '14px',
  fontWeight: '600' as const, borderRadius: '8px', padding: '12px 24px', textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#a8a5a0', margin: '24px 0 0', lineHeight: '1.5' }
const footerLink = { color: '#a8a5a0', textDecoration: 'underline' }
