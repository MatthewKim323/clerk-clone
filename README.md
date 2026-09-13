# Aurora

A responsive Next.js website with 65 captured pages, local fonts and assets, and interactive product demonstrations.

```sh
bun install
bun run dev
```

Open [localhost:3781](http://localhost:3781). For production, run `bun run build` followed by `bun run start`.

The homepage and linked pages support 1440, 1024, 810, and 390px reference widths. Layout, navigation, component tours, pricing controls, docs navigation, cookie preferences, the theme editor, and decorative motion are implemented locally.

## Project structure

- `app/`: homepage, route loader, document shell, and global styles.
- `components/`: scoped interactive behavior and homepage sections.
- `content/routes/`: generated responsive route markup and measured typography corrections.
- `public/`: content-addressed assets and captured responsive stylesheets.
- `scripts/`: repeatable markup generation and browser verification.
- `reference/`: committed motion specifications and final verification summaries. Raw captures, screenshots, recordings, logs, and private origin metadata stay local.
- `tooling/`: ignored local checkout or symlink for the optional capture and verification toolkit.

See [the route inventory](reference/PAGES.md), [implementation conventions](reference/CONVENTIONS.md), and [verification results](reference/VERIFICATION.md).

## Preview boundaries

Authentication and contact forms demonstrate their interface locally. They do not submit information or connect to an account service. Docs search searches the captured navigation. Links beyond the captured route inventory need their destination pages or services configured.

Editable wordmarks use Aurora. Some captured illustration backplates still contain placeholder branding and should be replaced before publishing. Social icons link to their platforms until Aurora profile URLs are configured.

## Checks

```sh
bun run typecheck
bun run build
```

The app builds and runs from the committed files without the capture toolkit or raw references. To run capture, generation, or browser-verification scripts, put a local `1to1` toolkit checkout at `tooling/1to1` (a symlink works), install that toolkit's dependencies, and restore the required private capture data under `reference/`. For example:

```sh
mkdir -p tooling
ln -s /path/to/1to1 tooling/1to1
bun scripts/check-routes.ts
```

The committed reports describe the completed verification. Their screenshot, frame, log, and detailed capture paths refer to local evidence that is intentionally omitted from git. See `reference/CONVENTIONS.md` for the capture workflow.
