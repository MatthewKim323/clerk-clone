# Verification

Repository note: this document and the selected final summary reports are committed. Referenced screenshots, frame directories, logs, raw captures, original per-page reports, and omitted detailed audits remain local. The application does not need those files to build or run.

65/65 pages and 260/260 viewport checks pass. Browser console and page errors recorded by the final geometry runs: 0. Heights below are CSS pixels, measured at device scale factor 2.

62 pages pass the original position-based section matcher. 3 pages require duplicate-position disambiguation: /components/theme-editor, /legal/privacy, /legal/website-terms. Their raw original reports are preserved as build/verify-original.json. The adjusted reports and roi-match-audit.json identify the matching nested blocks without changing reference measurements, page heights, or tolerances.

| Route | 1440 | 1024 | 810 | 390 |
|---|---|---|---|---|
| / | PASS (7666px) | PASS (8619px) | PASS (10192px) | PASS (14386px) |
| /agents | PASS (4219px) | PASS (4315px) | PASS (4956px) | PASS (5858px) |
| /billing | PASS (8306px) | PASS (8446px) | PASS (10448px) | PASS (11050px) |
| /blog | PASS (2353px) | PASS (2450px) | PASS (2579px) | PASS (3856px) |
| /blog/series-c | PASS (3294px) | PASS (3312px) | PASS (3372px) | PASS (4526px) |
| /brand-assets | PASS (2279px) | PASS (3471px) | PASS (3565px) | PASS (6693px) |
| /careers | PASS (5345px) | PASS (5377px) | PASS (6019px) | PASS (7662px) |
| /changelog | PASS (10951px) | PASS (10967px) | PASS (10549px) | PASS (11693px) |
| /changelog/2026-08-21-custom-oauth-scopes | PASS (1566px) | PASS (1582px) | PASS (1676px) | PASS (2196px) |
| /changelog/2026-08-25-admin-logs | PASS (2604px) | PASS (2620px) | PASS (2630px) | PASS (3263px) |
| /changelog/2026-08-28-customize-reverification-window | PASS (1948px) | PASS (1964px) | PASS (1964px) | PASS (2397px) |
| /changelog/2026-09-08-device-authorization-grant | PASS (2344px) | PASS (2360px) | PASS (2370px) | PASS (3075px) |
| /cli | PASS (4060px) | PASS (4076px) | PASS (5078px) | PASS (4725px) |
| /company | PASS (3255px) | PASS (3247px) | PASS (4155px) | PASS (5503px) |
| /components/checkout-button | PASS (6877px) | PASS (6992px) | PASS (9264px) | PASS (9412px) |
| /components/create-organization | PASS (4473px) | PASS (4361px) | PASS (5405px) | PASS (5601px) |
| /components/organization-list | PASS (6552px) | PASS (6504px) | PASS (7381px) | PASS (7496px) |
| /components/organization-profile | PASS (12849px) | PASS (12753px) | PASS (13303px) | PASS (10410px) |
| /components/organization-switcher | PASS (6346px) | PASS (6306px) | PASS (6846px) | PASS (8030px) |
| /components/pricing-table | PASS (5724px) | PASS (5676px) | PASS (6305px) | PASS (6458px) |
| /components/sign-in | PASS (7925px) | PASS (7935px) | PASS (8635px) | PASS (10958px) |
| /components/sign-up | PASS (10960px) | PASS (10923px) | PASS (11591px) | PASS (14575px) |
| /components/theme-editor | PASS (900px) | PASS (900px) | PASS (900px) | PASS (844px) |
| /components/user-button | PASS (5472px) | PASS (5471px) | PASS (6080px) | PASS (7225px) |
| /components/user-profile | PASS (14750px) | PASS (14694px) | PASS (15455px) | PASS (13052px) |
| /components/waitlist | PASS (4782px) | PASS (4741px) | PASS (5330px) | PASS (6282px) |
| /contact | PASS (1374px) | PASS (1434px) | PASS (2016px) | PASS (2488px) |
| /creators | PASS (5437px) | PASS (5593px) | PASS (6648px) | PASS (8943px) |
| /docs | PASS (4816px) | PASS (6474px) | PASS (6365px) | PASS (9914px) |
| /docs/astro/getting-started/quickstart | PASS (2377px) | PASS (2695px) | PASS (2679px) | PASS (3531px) |
| /docs/chrome-extension/getting-started/quickstart | PASS (9467px) | PASS (9841px) | PASS (9769px) | PASS (12839px) |
| /docs/expo/getting-started/quickstart | PASS (6889px) | PASS (7231px) | PASS (7191px) | PASS (9007px) |
| /docs/expressjs/getting-started/quickstart | PASS (5365px) | PASS (5683px) | PASS (5667px) | PASS (7113px) |
| /docs/guides/billing/overview | PASS (4605px) | PASS (4951px) | PASS (4907px) | PASS (7235px) |
| /docs/guides/configure/auth-strategies/sign-up-sign-in-options | PASS (9720px) | PASS (10094px) | PASS (10022px) | PASS (14563px) |
| /docs/guides/customizing-aurora/overview | PASS (3493px) | PASS (3867px) | PASS (3795px) | PASS (5276px) |
| /docs/guides/development/integrations/databases/convex | PASS (8050px) | PASS (8368px) | PASS (8352px) | PASS (10353px) |
| /docs/guides/development/integrations/databases/supabase | PASS (5656px) | PASS (5973px) | PASS (5958px) | PASS (8008px) |
| /docs/guides/development/integrations/overview | PASS (3765px) | PASS (4123px) | PASS (4067px) | PASS (5757px) |
| /docs/guides/development/integrations/platforms/vercel-marketplace | PASS (3501px) | PASS (3859px) | PASS (3803px) | PASS (5163px) |
| /docs/guides/organizations/overview | PASS (4236px) | PASS (4576px) | PASS (4538px) | PASS (6418px) |
| /docs/nextjs/getting-started/quickstart | PASS (2517px) | PASS (2835px) | PASS (2819px) | PASS (3739px) |
| /docs/react-router/getting-started/quickstart | PASS (2557px) | PASS (2875px) | PASS (2859px) | PASS (3835px) |
| /docs/react/getting-started/quickstart | PASS (2461px) | PASS (2779px) | PASS (2763px) | PASS (3671px) |
| /docs/tanstack-react-start/getting-started/quickstart | PASS (2377px) | PASS (2695px) | PASS (2679px) | PASS (3571px) |
| /enterprise-authentication | PASS (3746px) | PASS (3725px) | PASS (4861px) | PASS (4665px) |
| /expo-authentication | PASS (5765px) | PASS (5712px) | PASS (8101px) | PASS (8748px) |
| /github-student-developer-pack | PASS (3731px) | PASS (3939px) | PASS (4307px) | PASS (5778px) |
| /glossary | PASS (59036px) | PASS (66387px) | PASS (61694px) | PASS (93431px) |
| /legal | PASS (1302px) | PASS (1286px) | PASS (1596px) | PASS (2159px) |
| /legal/privacy | PASS (12269px) | PASS (11017px) | PASS (12299px) | PASS (20363px) |
| /legal/standard-terms | PASS (15656px) | PASS (12924px) | PASS (16138px) | PASS (30090px) |
| /legal/website-terms | PASS (8673px) | PASS (7589px) | PASS (8871px) | PASS (14999px) |
| /llm-leaderboard | PASS (2891px) | PASS (2971px) | PASS (3077px) | PASS (3542px) |
| /multi-tenancy | PASS (8230px) | PASS (8680px) | PASS (10855px) | PASS (8792px) |
| /nextjs-authentication | PASS (11024px) | PASS (11025px) | PASS (13040px) | PASS (15238px) |
| /platform | PASS (4273px) | PASS (4601px) | PASS (6305px) | PASS (6630px) |
| /pricing | PASS (12885px) | PASS (14965px) | PASS (13644px) | PASS (17906px) |
| /react-authentication | PASS (10745px) | PASS (10817px) | PASS (12940px) | PASS (14329px) |
| /security | PASS (4311px) | PASS (4423px) | PASS (4809px) | PASS (5634px) |
| /sign-in | PASS (900px) | PASS (900px) | PASS (900px) | PASS (844px) |
| /sign-up | PASS (900px) | PASS (900px) | PASS (900px) | PASS (844px) |
| /startups | PASS (2315px) | PASS (2527px) | PASS (3121px) | PASS (4781px) |
| /user-authentication | PASS (5396px) | PASS (6329px) | PASS (7821px) | PASS (9038px) |
| /waitlist | PASS (6214px) | PASS (6122px) | PASS (7697px) | PASS (6317px) |

## Evidence

Each reference directory contains build/verify.json and viewport captures. The original verifier checks exact page and matched section heights plus browser errors. Pixel differences are diagnostic, with a per-channel threshold of 40. 256 linked-page viewport pairs have pixel comparison reports; the homepage comparisons are stored under site/build/diff. Latest pixel capture failures: 0.

The production build and TypeScript checks are recorded in production-checks.json, final-build.log, and final-typecheck.log. The route capture audit confirms all 64 linked routes and 256 viewport references are present. The download audit checks all 28 brand asset links. The final text and blackout audits check served content and source files.

Pixel reports: static-pixels-0.json, static-pixels-1.json, blog-pixels-final.json, changelog-pixels-final.json, marketing-stable-pixels.json, marketing-motion-pixels.json, component-pages-pixel-verification.json, component-final-pixel-verification.json, additional-static-pixels-0.json, additional-static-pixels-1.json, additional-glossary-1024-final.json, additional-dynamic-pixels.json, final-changed-pixels.json, final-nextjs-pixels.json, final-react-pixels.json, final-theme-pixels.json, final-react-mobile-pixels.json. Replacement blog and changelog reports supersede the original out-of-bounds crop failures. Blog reused valid screenshots and explicitly records consoleChecked:false. Updated ROI audits label clipped sections. The glossary preserves every full-resolution pixel and compares large regions in bands. Its final 1024px report reuses the valid full-page capture after correcting a temporary-file format error in the comparison adapter. Original reference images and measurements remain unchanged.

Pixel runs performed during development can record stylesheet hot-reload warnings. Those are retained in pixel-coverage-summary.json. The final production geometry runs check browser errors separately on every route.

Motion values come from captured page modules. Component tours, menu transitions, pricing controls, docs interactions, SDK demos, marketing effects, and footer animation use scoped effects and cleanup. Homepage frame evidence spans site/build/frames/final, final-retest, and final-fixed; home-motion-final-review.json identifies the latest result for each scenario. Earlier failed captures are retained. Component, theme editor, SDK, and marketing audit artifacts record targeted interaction checks. The shared docs sidebar correction is checked separately in docs-sidebar-final-pixels/report.json using eight unmodified-reference sidebar crops, plus focused mobile and desktop runtime checks.

SDK hero comparisons and lifecycle checks are recorded in sdk-hero-lifecycle/report.json. Eight cases confirm captured canvas boxes and document heights, retained graphics contexts while offscreen, native elapsed-time behavior on return, and source-image comparisons. The React mobile footer regression is superseded by final-react-mobile-pixels.json. Earlier failed images and test assertions remain labeled in their audit directories.

The installation counter is verified in sdk-install-counter-check/report.json, reduced-motion.json, and visual.json. All four widths reach the captured value with native timing and once-only visibility behavior. Centered source/build stat crops differ by less than 0.44%. The counter data provenance and source transition values are in sdk-installation-total.json.

## Limits

Aurora text and editable SVG wordmarks intentionally differ from the captured graphics. Some illustration backplates retain placeholder branding. Moving tickers, canvases, and tours can be captured at different phases. Geometry PASS does not mean every pixel is identical.

Some source canvas and hover regions have incomplete frame sequences. Those implementations use extracted parameters and targeted interaction checks; not every timeline has a complete frame-by-frame comparison.

Authentication and contact forms are local previews. Docs search uses the captured navigation inventory. Account services, uncaptured destinations, and Aurora social profile URLs need configuration before publishing. The public route inventory stops at captured homepage links and does not recursively crawl all documentation and blog links.
