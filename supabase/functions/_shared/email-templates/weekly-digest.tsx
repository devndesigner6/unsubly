/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html,
  Img, Link, Preview, Row, Column, Section, Text, Hr, Button,
} from 'npm:@react-email/components@0.0.22'

interface WeeklyDigestEmailProps {
  siteName: string
  siteUrl: string
  recipientName?: string
  totalMonthly: number
  totalYearly: number
  currency: string
  upcomingThisWeek: Array<{
    name: string
    amount: number
    currency: string
    billingDate: string
  }>
  topSubscriptions: Array<{
    name: string
    amount: number
    currency: string
    billingCycle: string
  }>
}

export const WeeklyDigestEmail = ({
  siteName = 'Unsubscribely',
  siteUrl = 'https://unsubly.xyz',
  recipientName,
  totalMonthly = 0,
  totalYearly = 0,
  currency = 'USD',
  upcomingThisWeek = [],
  topSubscriptions = [],
}: WeeklyDigestEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>
      Your weekly spending summary — {totalMonthly.toFixed(2)} {currency}/mo across {topSubscriptions.length} subscriptions
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Img
          src="https://ipnywrvwszqlaykbkske.supabase.co/storage/v1/object/public/email-assets/logo.png"
          width="40"
          height="40"
          alt="Unsubscribely"
          style={logo}
        />
        <Heading style={h1}>Weekly Summary</Heading>
        <Text style={text}>
          {recipientName ? `Hi ${recipientName}, here's` : "Here's"} your weekly subscription spending overview.
        </Text>

        {/* Spending overview */}
        <Section style={statsRow}>
          <Row>
            <Column style={statBox}>
              <Text style={statLabel}>Monthly Total</Text>
              <Text style={statValue}>{totalMonthly.toFixed(2)} {currency}</Text>
            </Column>
            <Column style={statBox}>
              <Text style={statLabel}>Yearly Total</Text>
              <Text style={statValue}>{totalYearly.toFixed(2)} {currency}</Text>
            </Column>
            <Column style={statBox}>
              <Text style={statLabel}>Active Subs</Text>
              <Text style={statValue}>{topSubscriptions.length}</Text>
            </Column>
          </Row>
        </Section>

        {/* Upcoming this week */}
        {upcomingThisWeek.length > 0 && (
          <>
            <Heading style={h2}>Renewing This Week</Heading>
            {upcomingThisWeek.map((sub, i) => (
              <Section key={i} style={subRow}>
                <Row>
                  <Column>
                    <Text style={subName}>{sub.name}</Text>
                  </Column>
                  <Column style={rightCol}>
                    <Text style={subAmount}>{sub.amount} {sub.currency}</Text>
                    <Text style={subDate}>{sub.billingDate}</Text>
                  </Column>
                </Row>
              </Section>
            ))}
            <Hr style={hr} />
          </>
        )}

        {/* Top subscriptions */}
        {topSubscriptions.length > 0 && (
          <>
            <Heading style={h2}>Your Top Subscriptions</Heading>
            {topSubscriptions.slice(0, 5).map((sub, i) => (
              <Section key={i} style={subRow}>
                <Row>
                  <Column>
                    <Text style={subName}>{sub.name}</Text>
                    <Text style={subMeta}>{sub.billingCycle}</Text>
                  </Column>
                  <Column style={rightCol}>
                    <Text style={subAmount}>{sub.amount} {sub.currency}</Text>
                  </Column>
                </Row>
              </Section>
            ))}
          </>
        )}

        <Hr style={hr} />
        <Button style={button} href={`${siteUrl}/analytics`}>
          View Full Analytics
        </Button>

        <Text style={footer}>
          You're receiving this weekly digest from{' '}
          <Link href={siteUrl} style={footerLink}>{siteName}</Link>.
          Turn it off in{' '}
          <Link href={`${siteUrl}/settings`} style={footerLink}>Settings</Link>.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default WeeklyDigestEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'DM Sans', Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '520px', margin: '0 auto' }
const logo = { marginBottom: '24px' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#1a1816', margin: '0 0 12px' }
const h2 = { fontSize: '16px', fontWeight: '600' as const, color: '#1a1816', margin: '20px 0 10px' }
const text = { fontSize: '15px', color: '#777370', lineHeight: '1.6', margin: '0 0 20px' }
const statsRow = { backgroundColor: '#f7f4f0', borderRadius: '10px', padding: '16px', marginBottom: '20px' }
const statBox = { textAlign: 'center' as const, padding: '4px 8px' }
const statLabel = { fontSize: '11px', color: '#a8a5a0', margin: '0 0 2px', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }
const statValue = { fontSize: '18px', fontWeight: '700' as const, color: '#1a1816', margin: '0' }
const subRow = { borderBottom: '1px solid #f0ece8', paddingBottom: '8px', marginBottom: '8px' }
const subName = { fontSize: '14px', fontWeight: '500' as const, color: '#1a1816', margin: '0 0 1px' }
const subMeta = { fontSize: '11px', color: '#a8a5a0', margin: '0' }
const subDate = { fontSize: '11px', color: '#a8a5a0', margin: '0', textAlign: 'right' as const }
const subAmount = { fontSize: '14px', fontWeight: '600' as const, color: '#1a1816', margin: '0', textAlign: 'right' as const }
const rightCol = { textAlign: 'right' as const, width: '100px' }
const hr = { border: 'none', borderTop: '1px solid #e8e4e0', margin: '20px 0' }
const button = {
  backgroundColor: '#1a1816', color: '#f7f4f0', fontSize: '14px',
  fontWeight: '600' as const, borderRadius: '8px', padding: '12px 24px', textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#a8a5a0', margin: '24px 0 0', lineHeight: '1.5' }
const footerLink = { color: '#a8a5a0', textDecoration: 'underline' }
