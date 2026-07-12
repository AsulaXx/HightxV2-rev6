---
name: Consent & Rate Limiting
description: PDPA re-consent gate with version tracking, consentLogs audit trail, and Firestore-backed server-side rate limiting
type: feature
---
# Consent Gate + Server Rate Limiting (Phase 10)

## Consent Gate
- `settings/site` stores `termsVersion`, `privacyVersion`, `legalUpdatedAt`
- User profile stores `acceptedTermsVersion`, `acceptedPrivacyVersion`, `acceptedAt`
- `ConsentGate.tsx` wraps AnimatedRoutes; shows blocking modal when accepted < published
- Admin publishes new version via AdminLegalTab → "เผยแพร่ TOS/Privacy ใหม่" button (bumps version + calls `updateSettings`)
- Each accept writes to `consentLogs/{autoId}` — userId, email, ip, ua, versions, timestamp (audit trail for PDPA/GDPR)
- Firestore rules: consentLogs create-only-self, read admin

## Server Rate Limiting
- `src/lib/serverRateLimit.ts` — Firestore transaction against `rateLimits/{uid}_{action}`
- Configs: claim_key, topup_submit, wheel_spin, ruzien_claim, gift_redeem
- Owner/Admin bypass automatically
- Fail-open on transient errors (don't lock legit users)
- Complements client `rateLimiter.ts` (which is bypassable)
- `CooldownBadge.tsx` for countdown UI

## View-as-Role (Owner only)
- PermissionsPage has dropdown to preview UI in another role's perspective
- Session-only (sessionStorage `__view_as_role`), view-only, doesn't change actual permissions

## Audit Log
- Filter by action type + date range in AdminAuditLogTab
- IP + User-Agent already captured in `logActivity()`
- Permission mutations logged as `permission_change` action
