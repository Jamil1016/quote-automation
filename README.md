# Quote Automation

A reviewed, batched quoting workflow built with Next.js (App Router), TypeScript,
and Supabase. This is a **sanitized public reference build** of an internal tool —
company branding, recipients, and credentials have been replaced with placeholders.

## What it does

- **Review queue** — reads a worklist of asset tasks and invoice options from a
  single Supabase analytics view (`v_quote_review`), with field-level operator
  overrides (read-modify-write so concurrent edits don't clobber each other).
- **Bulk PDF generation** — renders the same `<QuoteDocument>` used for on-screen
  preview to a buffer via `@react-pdf` on the Node runtime, uploads concurrently to
  Google Drive, and streams NDJSON progress. Validates the whole batch first (422 on
  rows missing a price or match) before rendering anything.
- **Email staging** — renders TipTap templates to Gmail MIME and creates **drafts**
  (never auto-sends) in each user's OAuth'd account.
- **Live presence** — a Supabase Realtime channel shows who's in the app and on
  which page.

## Stack

Next.js · React · TypeScript · Supabase (Postgres + Realtime) · `@react-pdf` ·
Google Drive & Gmail APIs · Playwright.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in your own Supabase / Google credentials
npm run dev
```

All identifiers in `.env.example` (Supabase project ref, Google Cloud project,
allowed emails) are placeholders — supply your own.

## Notes on this public build

- The brand theme token is `brand`; the company logo is replaced by a text wordmark
  in `components/ui/Logo.tsx` and a 1×1 placeholder in `lib/quotes/brand-logo.ts`.
- Internal design-system assets, sample data, and planning docs are not included.

MIT licensed.
