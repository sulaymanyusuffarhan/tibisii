# Phase 4 — Public institutional website

## What is implemented

- Responsive public layout, separate from the admin shell, with skip navigation, keyboard focus styling, mobile menu, search, breadcrumb navigation, and a Kiswahili/English language switch.
- `/` redirects to the active/default language. Public pages live under `/sw` and `/en`; the admin remains under `/admin` with non-indexable metadata.
- Database-backed navigation and home sections, plus public read paths for pages, articles, events, publications, broadcast channels and schedules, leadership, personnel, regional offices, FAQs, and approved testimonials.
- Institutional overview, history/mandate/structure/governance, services (radio/TV/digital), stories, visits, people, leadership, events, publications, community, partnerships, contact, FAQs, legal pages, search, and site directory routes.
- Search, metadata, `robots.txt`, and an XML sitemap. Set `NEXT_PUBLIC_SITE_URL` to the deployed public portal's canonical origin to enable absolute sitemap URLs; no production domain is assumed by default.
- Seeded bilingual main/utility/footer navigation and editable home-page sections. Content is always read from the CMS data tables; unapproved or unpublished records are not shown.
- Production responses exclude records marked `is_demo`. CMS-provided rich HTML is passed through the existing server-side sanitizer, and stored image/document/external URLs are restricted to safe relative paths or HTTPS URLs.

## Truth and verification safeguards

- The database defaults mark contact details as placeholders. Public pages and the shared footer hide contact values unless the site settings explicitly set `contact.verified=true` and `contact.is_placeholder=false`; unverified strings are also removed from the public settings object before rendering.
- Bundled logo and coat-of-arms SVGs are artwork slots, not certified masters. They remain hidden unless `branding.verified=true`; the public site uses a plain text TBC wordmark instead. Set this flag only after replacing the assets with approved files.
- The staging banner is enabled by default. Do not disable it or publish demonstration records until TBC verifies the content, imagery, branding, and publication rights.
- Empty leadership, office, FAQ, and other directories intentionally explain that verified information is pending rather than inventing institutional details. Privacy, terms, disclaimer, and partnership policy copy also remain explicitly pending approval where no approved CMS page exists.
- The e-Mrejesho link is opt-in (`EMREJESHO_LINK_ENABLED=true`); a configured URL alone does not display the link.

## Verification

`npm run lint`, `npm run test:phase2`, `npm run test:phase3`, `npm run test:phase4`, `npm audit --audit-level=moderate`, and `npm run build` pass. Phase 4 tests exercise seeded menus/home sections, bilingual published records, broadcast schedule/search queries, and exclusion of demo records in production mode. Production HTTP smoke checks returned 200 for representative public and admin pages; `/` redirects to the language homepage. Contact and logo slot placeholders were checked not to appear in public HTML.

## Not included

This phase implements public reading and search, not public enquiry form submission, file upload, or a public comment/feedback workflow. Contact information remains unavailable until explicitly verified and configured. Institutional facts, current leaders, office contacts, frequencies, official imagery, and approved legal text must be supplied and approved by TBC before launch.
