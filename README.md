# The Varnish Express

A railway-style learning experience illustrating **Nginx → Varnish 7.5 → origin → PHP / Magento** request and response processing.

**[Open The Varnish Express](https://yogeshchavan-jd.github.io/varnish-train/)**

All domains, policies, ports, and traffic are examples. This public site contains no production VCL or Nginx configuration. It runs entirely in the browser and makes no requests to an application origin.

## Explore

- A railway map with request, origin, and response lines.
- A 28-stop full MISS journey covering request cleanup, cache lookup, backend processing, storage, and delivery.
- 15 services: MISS, HIT, checkout, login cookie, authorization, POST, GraphQL, grace, restart, private response, no-store, error, health, invalidation, and a custom-method PIPE example.
- Before/after transformations, parameter tickets, hash ingredients, and relevant request/response manifests.
- Five editable workbench experiments: tracking parameters, cookies and routing, encoding, cache keys, and response policies.
- Scroll navigation, previous/next controls, clickable stations, searchable itinerary, and adjustable-speed autoplay.
- Responsive typography, keyboard navigation, and reduced-motion support.

## Run locally

Open `index.html` directly, or start a localhost-only server:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open **http://localhost:8000**. Stop the server with `Ctrl+C`. No build step or dependency installation is required.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Page, SVG railway, workbench, field notes, and itinerary dialog |
| `styles.css` | Railway design, responsive layouts, readable labels, reduced motion |
| `journey-data.js` | Illustrative scenarios and teaching policies |
| `app.js` | Train animation, inspector, navigation, playback, and itinerary |
| `workbench.js` | Editable local experiments |
| `tests/model.test.cjs` | Model behavior, route ordering, snapshots, and public-data checks |

## Verify

```sh
node --test tests/model.test.cjs
```

The UI uses GSAP 3.13.0 and ScrollTrigger from jsDelivr, plus Google Fonts. If these external resources are unavailable, native SVG geometry, scrolling, requestAnimationFrame, and system fonts provide a functional fallback.

## Modeling choices

This is an educational replay, not a general VCL interpreter or production monitor.

- `shop.example` and documentation-range IP addresses represent fictional systems.
- Tracking cleanup uses a query-string parser and case-insensitive example parameter names. It removes empty tracking values and retains business parameters and fragments.
- Cookie collection illustrates the public std module's default comma-and-space separator. The storefront scenarios demonstrate a custom cookie policy; stock Varnish generally passes requests carrying cookies.
- Authorization selects PASS. Recognized non-GET/HEAD methods also select PASS; a fictional `CUSTOM` method illustrates PIPE.
- Cache-key examples combine application context, optional protocol/GraphQL dimensions, URL, and host. The cookie context is distinct from the HTTP Vary response header.
- Response examples demonstrate early returns, cookie handling, surrogate policy, and short-lived hit-for-miss metadata. PASS remains uncacheable.
- Example object grace is 30 minutes. Preset stale ages illustrate serving and restarting; refresh is conceptual.
- Delivery changes affect the outgoing response rather than the stored object. Security headers and Vary are retained by the sample cleanup.
- Synthetic responses and PIPE use different execution paths from normal delivery.

## GitHub Pages

Publish the **`main` branch, `/ (root)` folder**. `.nojekyll` enables plain static-file deployment. Asset paths are relative, so the site works under `/varnish-train/`.

Updates pushed to `main` are deployed by GitHub Pages. Check **Actions** or **Settings → Pages** for deployment status. Keep private configuration outside this repository; `.gitignore` excludes VCL files and the `private/` directory.

References: [Varnish 7.5 documentation](https://varnish-cache.org/docs/7.5/), [built-in VCL](https://github.com/varnishcache/varnish-cache/blob/varnish-7.5.0/bin/varnishd/builtin.vcl), [std module](https://github.com/varnishcache/varnish-cache/blob/varnish-7.5.0/vmod/vmod_std.vcc).
