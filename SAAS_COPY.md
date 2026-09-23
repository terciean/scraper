# SaaS development copy

This folder is the SaaS development fork of the personal lead board. The
personal repository must remain unchanged while product work happens here.

## Implemented in the fork

- Website enrichment discovers public Facebook, Instagram, LinkedIn company,
  TikTok and WhatsApp links published by the business itself.
- Qualification stores a stable `business_type`: `ecommerce_product`,
  `clinic_service`, `retailer_wholesaler`, or `other_service`.
- Pitch rendering selects product-sales copy, clinic-bookings copy, or a
  decision-maker-routing message. No hand-written observation is required.
- Post-pitch classification recognizes requests for information and referrals
  to an owner/director, and proposes replies that answer the prospect before
  attempting to book a call.
- Meeting handoff identifies Jaden as the strategy lead instead of saying
  "supervisor".

## Lead-source plan

1. Keep pasted/CSV imports and the existing local Maps browser source behind a
   common provider interface.
2. Treat a business's own website as the first-party discovery source for its
   public social URLs. This is what the current enrichment implements.
3. Add provider adapters for licensed/official Facebook, Instagram, LinkedIn
   and places data. Do not make the SaaS depend on logged-in social-network DOM
   scraping; it is brittle, difficult to scale, and couples all customers to
   one account/IP reputation.
4. Store provenance for every discovered value: source provider, source URL,
   observed timestamp and tenant/job identifier.
5. Deduplicate in this order: canonical phone, normalized domain, social
   profile URL, then provider-specific place/profile ID.
6. Run discovery as queued jobs with per-tenant budgets and idempotency keys.

Suggested source contract:

```js
discover({ tenantId, query, location, cursor })
// -> { leads, nextCursor, usage: { requests, providerCost } }
```

Each lead should carry `source`, `source_id`, `source_url`, `observed_at`,
`facebook_url`, `instagram_url`, `linkedin_url`, `website`, and normalized
contact data.

## Before shipping

This was intentionally made as a direct repository copy. It therefore contains
the personal SQLite database and browser profile. Never distribute those files.
Create clean development fixtures, move secrets and browser state outside the
application package, and add `tenant_id` isolation before onboarding anyone.
