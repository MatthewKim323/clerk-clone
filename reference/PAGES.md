# Route inventory

All pages use the shared Next.js catch-all loader in app/[...slug]/page.tsx. Responsive HTML is generated from sanitized captures by scripts/build-routes.ts. The homepage has its own section renderer.

RouteContent selects the captured desktop, tablet, tablet-810, or mobile markup at the native 1280, 1024, and 768px boundaries. Page styles preserve all captured media rules. Interactive behavior is attached by RouteEffects, RouteInteractions, ComponentPages, and MarketingMotion.

Append ?only=1 to a linked page to render its main content without the shell. The homepage accepts ?only=<section>.

| Route | Reference | Generated content |
|---|---|---|
| / | site | components/sections/markup |
| /agents | site-agents | content/routes/agents.json |
| /billing | site-billing | content/routes/billing.json |
| /blog | site-blog | content/routes/blog.json |
| /blog/series-c | site-blog-series-c | content/routes/blog--series-c.json |
| /brand-assets | site-brand-assets | content/routes/brand-assets.json |
| /careers | site-careers | content/routes/careers.json |
| /changelog | site-changelog | content/routes/changelog.json |
| /changelog/2026-08-21-custom-oauth-scopes | site-changelog-2026-08-21-custom-oauth-scopes | content/routes/changelog--2026-08-21-custom-oauth-scopes.json |
| /changelog/2026-08-25-admin-logs | site-changelog-2026-08-25-admin-logs | content/routes/changelog--2026-08-25-admin-logs.json |
| /changelog/2026-08-28-customize-reverification-window | site-changelog-2026-08-28-customize-reverification-window | content/routes/changelog--2026-08-28-customize-reverification-window.json |
| /changelog/2026-09-08-device-authorization-grant | site-changelog-2026-09-08-device-authorization-grant | content/routes/changelog--2026-09-08-device-authorization-grant.json |
| /cli | site-cli | content/routes/cli.json |
| /company | site-company | content/routes/company.json |
| /components/checkout-button | site-components-checkout-button | content/routes/components--checkout-button.json |
| /components/create-organization | site-components-create-organization | content/routes/components--create-organization.json |
| /components/organization-list | site-components-organization-list | content/routes/components--organization-list.json |
| /components/organization-profile | site-components-organization-profile | content/routes/components--organization-profile.json |
| /components/organization-switcher | site-components-organization-switcher | content/routes/components--organization-switcher.json |
| /components/pricing-table | site-components-pricing-table | content/routes/components--pricing-table.json |
| /components/sign-in | site-components-sign-in | content/routes/components--sign-in.json |
| /components/sign-up | site-components-sign-up | content/routes/components--sign-up.json |
| /components/theme-editor | site-components-theme-editor | content/routes/components--theme-editor.json |
| /components/user-button | site-components-user-button | content/routes/components--user-button.json |
| /components/user-profile | site-components-user-profile | content/routes/components--user-profile.json |
| /components/waitlist | site-components-waitlist | content/routes/components--waitlist.json |
| /contact | site-contact | content/routes/contact.json |
| /creators | site-creators | content/routes/creators.json |
| /docs | site-docs | content/routes/docs.json |
| /docs/astro/getting-started/quickstart | site-docs-astro-getting-started-quickstart | content/routes/docs--astro--getting-started--quickstart.json |
| /docs/chrome-extension/getting-started/quickstart | site-docs-chrome-extension-getting-started-quickstart | content/routes/docs--chrome-extension--getting-started--quickstart.json |
| /docs/expo/getting-started/quickstart | site-docs-expo-getting-started-quickstart | content/routes/docs--expo--getting-started--quickstart.json |
| /docs/expressjs/getting-started/quickstart | site-docs-expressjs-getting-started-quickstart | content/routes/docs--expressjs--getting-started--quickstart.json |
| /docs/guides/billing/overview | site-docs-guides-billing-overview | content/routes/docs--guides--billing--overview.json |
| /docs/guides/configure/auth-strategies/sign-up-sign-in-options | site-docs-guides-configure-auth-strategies-sign-up-sign-in-options | content/routes/docs--guides--configure--auth-strategies--sign-up-sign-in-options.json |
| /docs/guides/customizing-aurora/overview | site-docs-guides-customizing-aurora-overview | content/routes/docs--guides--customizing-aurora--overview.json |
| /docs/guides/development/integrations/databases/convex | site-docs-guides-development-integrations-databases-convex | content/routes/docs--guides--development--integrations--databases--convex.json |
| /docs/guides/development/integrations/databases/supabase | site-docs-guides-development-integrations-databases-supabase | content/routes/docs--guides--development--integrations--databases--supabase.json |
| /docs/guides/development/integrations/overview | site-docs-guides-development-integrations-overview | content/routes/docs--guides--development--integrations--overview.json |
| /docs/guides/development/integrations/platforms/vercel-marketplace | site-docs-guides-development-integrations-platforms-vercel-marketplace | content/routes/docs--guides--development--integrations--platforms--vercel-marketplace.json |
| /docs/guides/organizations/overview | site-docs-guides-organizations-overview | content/routes/docs--guides--organizations--overview.json |
| /docs/nextjs/getting-started/quickstart | site-docs-nextjs-getting-started-quickstart | content/routes/docs--nextjs--getting-started--quickstart.json |
| /docs/react-router/getting-started/quickstart | site-docs-react-router-getting-started-quickstart | content/routes/docs--react-router--getting-started--quickstart.json |
| /docs/react/getting-started/quickstart | site-docs-react-getting-started-quickstart | content/routes/docs--react--getting-started--quickstart.json |
| /docs/tanstack-react-start/getting-started/quickstart | site-docs-tanstack-react-start-getting-started-quickstart | content/routes/docs--tanstack-react-start--getting-started--quickstart.json |
| /enterprise-authentication | site-enterprise-authentication | content/routes/enterprise-authentication.json |
| /expo-authentication | site-expo-authentication | content/routes/expo-authentication.json |
| /github-student-developer-pack | site-github-student-developer-pack | content/routes/github-student-developer-pack.json |
| /glossary | site-glossary | content/routes/glossary.json |
| /legal | site-legal | content/routes/legal.json |
| /legal/privacy | site-legal-privacy | content/routes/legal--privacy.json |
| /legal/standard-terms | site-legal-standard-terms | content/routes/legal--standard-terms.json |
| /legal/website-terms | site-legal-website-terms | content/routes/legal--website-terms.json |
| /llm-leaderboard | site-llm-leaderboard | content/routes/llm-leaderboard.json |
| /multi-tenancy | site-multi-tenancy | content/routes/multi-tenancy.json |
| /nextjs-authentication | site-nextjs-authentication | content/routes/nextjs-authentication.json |
| /platform | site-platform | content/routes/platform.json |
| /pricing | site-pricing | content/routes/pricing.json |
| /react-authentication | site-react-authentication | content/routes/react-authentication.json |
| /security | site-security | content/routes/security.json |
| /sign-in | site-sign-in | content/routes/sign-in.json |
| /sign-up | site-sign-up | content/routes/sign-up.json |
| /startups | site-startups | content/routes/startups.json |
| /user-authentication | site-user-authentication | content/routes/user-authentication.json |
| /waitlist | site-waitlist | content/routes/waitlist.json |

The captured homepage links also include /discord, a redirect to the community invite, and /roadmap, which returns 404 in the source capture. Links within added pages do not expand the capture inventory recursively.
