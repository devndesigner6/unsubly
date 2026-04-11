# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| latest (`main`) | ✅ |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

If you discover a security vulnerability in Unsubscribely — particularly anything related to:
- Smart contract logic that could drain escrow funds
- Agent wallet key exposure
- Authentication or session bypass
- RLS policy gaps in the database

Please report it responsibly by:

1. Opening a **private security advisory** on GitHub:  
   `github.com/devndesigner6/unsubly → Security → Advisories → New draft security advisory`

2. Or emailing the maintainer directly via the contact on the GitHub profile page.

Include as much detail as possible: affected component, steps to reproduce, potential impact, and any suggested fix.

## Response Timeline

- **Acknowledgement**: within 48 hours
- **Assessment**: within 5 business days
- **Fix / Patch**: within 14 days for critical issues

## Smart Contract Security

All TEAL contracts implement the following protections:
- Creator-only fund operations (ABI method guards)
- Kill switch emergency recovery
- Minimum balance reservation
- ARC-4 method selector validation to prevent replay attacks

Contracts are deployed on **Algorand Testnet** and have not undergone a formal third-party audit. Use on Mainnet at your own risk until an audit is completed.
