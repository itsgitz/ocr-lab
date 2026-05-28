# Tailwind CSS v4 Not Loading in Production Build

**Date:** 2026-05-27
**Severity:** Critical — page renders with no styles
**Affected:** SvelteKit + Tailwind CSS v4 (`@tailwindcss/vite` plugin) production builds

## Symptoms

- Deployed SvelteKit app loads but has **no CSS** — raw unstyled HTML
- `bun run dev` works fine (CSS loads in development)
- Production build (`bun run build:frontend`) completes without errors
- No `.css` files exist in `build/client/_app/immutable/assets/`
- Build manifest shows `stylesheets: []` (empty)

## Root Cause

Two issues combined to produce zero CSS output:

### 1. Missing `+layout.svelte` with explicit CSS import

SvelteKit auto-detects `src/app.css` by convention, but the `@tailwindcss/vite` plugin's
content scanning doesn't reliably detect `.svelte` files through SvelteKit's build pipeline.
Without an explicit import, the CSS entry point can be tree-shaken or produce empty output.

### 2. Tailwind v4 needs `@source` to find `.svelte` files

Tailwind CSS v4's auto-detection scans from the CSS file's location, but SvelteKit's
Vite plugin intercepts file processing. The `@tailwindcss/vite` plugin may not see
`.svelte` template files as content sources, resulting in zero utility classes being
generated — which means an empty CSS file that Vite drops from the bundle entirely.

## Fix

### Step 1: Create `+layout.svelte` with explicit CSS import

```svelte
<!-- src/routes/+layout.svelte -->
<script>
  import "../app.css";
  let { children } = $props();
</script>

{@render children()}
```

This ensures the CSS entry point is part of the module graph and won't be tree-shaken.

### Step 2: Add `@source` directive to `app.css`

```css
/* src/app.css */
@import "tailwindcss";
@source "./**/*.{svelte,ts,js}";
```

This tells Tailwind v4 to explicitly scan `src/` for `.svelte`, `.ts`, and `.js` files
containing utility class names, bypassing the auto-detection issue.

## Verification

After applying the fix and rebuilding:

```bash
bun run build:frontend
```

Check for CSS output:

```bash
# CSS file should exist in build output
ls packages/frontend/build/client/_app/immutable/assets/*.css
# Expected: 0.<hash>.css (~13 kB)

# Manifest should reference it in node 0 (layout)
grep "stylesheets" packages/frontend/build/server/chunks/0-*.js
# Expected: stylesheets = ["_app/immutable/assets/0.<hash>.css"]
```

**Critical: Restart PM2 after rebuilding.** PM2 keeps the old Node process alive, serving stale build artifacts from memory. Without a restart, the browser still receives the old HTML referencing old (or missing) asset hashes:

```bash
pm2 restart ocr-lab-frontend

# Verify the new build is live:
curl -s http://localhost:3000 | grep 'stylesheet'
# Expected: <link href="./_app/immutable/assets/0.<hash>.css" rel="stylesheet">
```

## Why Dev Mode Worked

In development (`bun run dev`), Vite's dev server processes CSS on-demand per request.
The `@tailwindcss/vite` plugin scans files eagerly in watch mode and injects styles via
HMR. This masks the content detection issue because the dev server has direct access to
all source files on disk. Production builds go through Vite's optimized pipeline where
SvelteKit's plugin transforms `.svelte` files before Tailwind sees them.

## Tailwind v4 `max-w-*` utilities resolve to spacing scale (not container widths)

**Date:** 2026-05-28
**Severity:** Medium — causes extremely narrow text containers
**Affected:** Any component using named `max-w-*` utilities (`max-w-sm`, `max-w-md`, `max-w-lg`, etc.) with a custom spacing scale

### Symptoms

- Text wraps word-by-word into a single vertical column
- Paragraphs appear to be ~20–30px wide despite using `max-w-lg` or `max-w-md`
- The element has `mx-auto` and `text-center` but still looks broken

### Root Cause

In **Tailwind CSS v4**, the `max-w-*` utilities with **named sizes** (`sm`, `md`, `lg`, `xl`, etc.) resolve to the **spacing scale** (`--spacing-*`), not the old container width scale from v3.

With a custom `@theme` that defines spacing tokens (e.g., `--spacing-md: 20px`, `--spacing-lg: 24px`), these utilities produce unexpectedly tiny values:

| Utility | Tailwind v3 | Tailwind v4 (with custom spacing) |
|---------|-------------|-----------------------------------|
| `max-w-sm` | `24rem` (384px) | `var(--spacing-sm)` → `12px` |
| `max-w-md` | `28rem` (448px) | `var(--spacing-md)` → `20px` |
| `max-w-lg` | `32rem` (512px) | `var(--spacing-lg)` → `24px` |
| `max-w-xl` | `36rem` (576px) | `var(--spacing-xl)` → `32px` |

### Fix

Use **arbitrary values** instead of named sizes when you need container-like max-widths:

```diff
- <p class="max-w-lg mx-auto">...
+ <p class="max-w-[480px] mx-auto">...
```

Or use `rem`-based arbitrary values to match the old v3 behavior:

```html
<p class="max-w-[32rem] mx-auto">...</p>  <!-- equivalent to old max-w-lg -->
```

### Verification

Check the compiled CSS to confirm the utility resolves correctly:

```bash
bun run build:frontend
grep 'max-w-' packages/frontend/build/client/_app/immutable/assets/*.css
```

Expected:
```css
.max-w-\[480px\]{max-width:480px}
```

Not:
```css
.max-w-lg{max-width:var(--spacing-lg)}  /* 24px — way too narrow */
```

### Key Takeaway

| | |
|---|---|
| Named `max-w-*` | Resolves to `--spacing-*` scale in v4 |
| Arbitrary `max-w-[…]` | Always resolves to the exact value you specify |
| Use arbitrary values | When you need container-style widths with a custom spacing theme |

---

## Key Takeaways

| Aspect | Detail |
|--------|--------|
| Always create `+layout.svelte` | Explicitly import `app.css` — don't rely on auto-detection |
| Always add `@source` | Tailwind v4 + SvelteKit needs explicit content paths |
| Verify build output | Check for `.css` files in `build/client/` after every build config change |
| Restart PM2 after rebuild | PM2 keeps the old process alive — `pm2 restart ocr-lab-frontend` is required |
| Dev vs prod parity | CSS issues that only appear in production are common with plugin interactions |
| Named `max-w-*` in v4 | Resolves to spacing scale, not container widths — use arbitrary values instead |

## Files Changed

| File | Change |
|------|--------|
| `packages/frontend/src/routes/+layout.svelte` | Created — imports `app.css`, renders children |
| `packages/frontend/src/app.css` | Added `@source "./**/*.{svelte,ts,js}"` directive; expanded with full design-system `@theme` (colors, typography, spacing, radius) and `@layer utilities` (`.typo-*` classes). See `ts/DESIGN.md` for the full design specification. |
| `packages/frontend/src/app.html` | Added Google Fonts preconnect + Inter / JetBrains Mono links |
| `packages/frontend/src/lib/components/` | `TopNav.svelte`, `UploadZone.svelte`, `TimelinePill.svelte` — design-system components |
