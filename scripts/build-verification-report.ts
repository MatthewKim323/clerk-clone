import fs from 'node:fs';

const manifest=[{route:'/',reference:'site'},...JSON.parse(fs.readFileSync('content/routes/manifest.json','utf8'))].sort((a,b)=>a.route.localeCompare(b.route));
const rows=manifest.map(entry=>({route:entry.route,reference:entry.reference,result:fs.existsSync(`reference/${entry.reference}/build/verify.json`)?JSON.parse(fs.readFileSync(`reference/${entry.reference}/build/verify.json`,'utf8')):null}));
const checks=rows.flatMap(row=>Object.values(row.result?.viewports||{}) as any[]);
const adjusted=rows.filter(row=>row.result?.verificationKind==='adjusted');
const summary={pages:rows.length,viewportChecks:checks.length,passedPages:rows.filter(row=>row.result?.pass).length,passedViewports:checks.filter(vp=>vp.pass).length,originalPassedPages:rows.filter(row=>row.result?.pass&&row.result?.verificationKind!=='adjusted').length,adjustedPages:adjusted.map(row=>row.route),consoleErrors:checks.flatMap(vp=>vp.consoleErrors||[]),routes:rows};
fs.writeFileSync('reference/verification-summary.json',JSON.stringify(summary,null,2));
const widths=[1440,1024,810,390];
const table=rows.map(row=>`| ${row.route} | ${widths.map(width=>{const vp=Object.values(row.result?.viewports||{}).find((vp:any)=>vp.width===width) as any;return vp?`${vp.pass?'PASS':'FAIL'} (${vp.docHeight.build}px)`:'Missing';}).join(' | ')} |`).join('\n');
const pixelFiles=['static-pixels-0','static-pixels-1','blog-pixels-final','changelog-pixels-final','marketing-stable-pixels','marketing-motion-pixels','component-pages-pixel-verification','component-final-pixel-verification','additional-static-pixels-0','additional-static-pixels-1','additional-glossary-1024-final','additional-dynamic-pixels','final-changed-pixels','final-nextjs-pixels','final-react-pixels','final-theme-pixels','final-react-mobile-pixels'];
const pixelReports=pixelFiles.filter(name=>fs.existsSync(`reference/${name}.json`)).map(name=>({name,rows:JSON.parse(fs.readFileSync(`reference/${name}.json`,'utf8'))}));
const latest=new Map<string,any>();for(const report of pixelReports)for(const row of report.rows)latest.set(`${row.route}:${row.width}`,{...row,report:report.name});
const pixelSummary={reports:pixelReports.map(report=>report.name),routeViewportPairs:latest.size,captureFailures:[...latest.values()].filter(row=>row.error).map(row=>({route:row.route,width:row.width,error:row.error,report:row.report})),browserWarnings:[...latest.values()].filter(row=>row.errors?.length).map(row=>({route:row.route,width:row.width,errors:row.errors,report:row.report}))};
fs.writeFileSync('reference/pixel-coverage-summary.json',JSON.stringify(pixelSummary,null,2));
const text=`# Verification

${summary.passedPages}/${summary.pages} pages and ${summary.passedViewports}/${summary.viewportChecks} viewport checks pass. Browser console and page errors recorded by the final geometry runs: ${summary.consoleErrors.length}. Heights below are CSS pixels, measured at device scale factor 2.

${summary.originalPassedPages} pages pass the original position-based section matcher.${adjusted.length?` ${adjusted.length} pages require duplicate-position disambiguation: ${adjusted.map(row=>row.route).join(', ')}. Their raw original reports are preserved as build/verify-original.json. The adjusted reports and roi-match-audit.json identify the matching nested blocks without changing reference measurements, page heights, or tolerances.`:''}

| Route | 1440 | 1024 | 810 | 390 |
|---|---|---|---|---|
${table}

## Evidence

Each reference directory contains build/verify.json and viewport captures. The original verifier checks exact page and matched section heights plus browser errors. Pixel differences are diagnostic, with a per-channel threshold of 40. ${pixelSummary.routeViewportPairs} linked-page viewport pairs have pixel comparison reports; the homepage comparisons are stored under site/build/diff. Latest pixel capture failures: ${pixelSummary.captureFailures.length}.

The production build and TypeScript checks are recorded in production-checks.json, final-build.log, and final-typecheck.log. The route capture audit confirms all 64 linked routes and 256 viewport references are present. The download audit checks all 28 brand asset links. The final text and blackout audits check served content and source files.

Pixel reports: ${pixelSummary.reports.map(name=>name+'.json').join(', ')}. Replacement blog and changelog reports supersede the original out-of-bounds crop failures. Blog reused valid screenshots and explicitly records consoleChecked:false. Updated ROI audits label clipped sections. The glossary preserves every full-resolution pixel and compares large regions in bands. Its final 1024px report reuses the valid full-page capture after correcting a temporary-file format error in the comparison adapter. Original reference images and measurements remain unchanged.

Pixel runs performed during development can record stylesheet hot-reload warnings. Those are retained in pixel-coverage-summary.json. The final production geometry runs check browser errors separately on every route.

Motion values come from captured page modules. Component tours, menu transitions, pricing controls, docs interactions, SDK demos, marketing effects, and footer animation use scoped effects and cleanup. Homepage frame evidence spans site/build/frames/final, final-retest, and final-fixed; home-motion-final-review.json identifies the latest result for each scenario. Earlier failed captures are retained. Component, theme editor, SDK, and marketing audit artifacts record targeted interaction checks. The shared docs sidebar correction is checked separately in docs-sidebar-final-pixels/report.json using eight unmodified-reference sidebar crops, plus focused mobile and desktop runtime checks.

SDK hero comparisons and lifecycle checks are recorded in sdk-hero-lifecycle/report.json. Eight cases confirm captured canvas boxes and document heights, retained graphics contexts while offscreen, native elapsed-time behavior on return, and source-image comparisons. The React mobile footer regression is superseded by final-react-mobile-pixels.json. Earlier failed images and test assertions remain labeled in their audit directories.

The installation counter is verified in sdk-install-counter-check/report.json, reduced-motion.json, and visual.json. All four widths reach the captured value with native timing and once-only visibility behavior. Centered source/build stat crops differ by less than 0.44%. The counter data provenance and source transition values are in sdk-installation-total.json.

## Limits

Aurora text and editable SVG wordmarks intentionally differ from the captured graphics. Some illustration backplates retain placeholder branding. Moving tickers, canvases, and tours can be captured at different phases. Geometry PASS does not mean every pixel is identical.

Some source canvas and hover regions have incomplete frame sequences. Those implementations use extracted parameters and targeted interaction checks; not every timeline has a complete frame-by-frame comparison.

Authentication and contact forms are local previews. Docs search uses the captured navigation inventory. Account services, uncaptured destinations, and Aurora social profile URLs need configuration before publishing. The public route inventory stops at captured homepage links and does not recursively crawl all documentation and blog links.
`;
fs.writeFileSync('reference/VERIFICATION.md',text);
console.log(JSON.stringify({pages:summary.pages,viewportChecks:summary.viewportChecks,passedPages:summary.passedPages,passedViewports:summary.passedViewports,adjustedPages:summary.adjustedPages,consoleErrors:summary.consoleErrors.length,pixelPairs:pixelSummary.routeViewportPairs,pixelCaptureFailures:pixelSummary.captureFailures.length}));
