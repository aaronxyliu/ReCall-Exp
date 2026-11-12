# Collect one repository

Input: an explicit list of production libraries and a README describing how to host the selected frontend. Output: captured JavaScript, source maps, and verified one-to-one function records. No random sampling or cohort configuration is involved.

## Run

1. In `ReCall Exp`, run `npm ci`. Install Chrome/Chromium and set `CHROME_BIN` if Chrome is not at the default macOS path.
2. Follow the application's hosting README to build with source maps and start its page and required services. Keep normal production optimizations. Confirm that the intended interface actually renders; HTTP 200 alone is insufficient.
3. Add exactly one configuration block to that README:

````markdown
```recall-capture
{
  "url": "http://127.0.0.1:8080/",
  "manifest": "../../builds/my-app/package.json"
}
```
````

`manifest` points to the selected frontend's package.json, relative to the README. For monorepos, use the frontend manifest, not an unrelated root package. Optional `browserExecutable` overrides Chrome's path. Optional `preparePage` points to a browser hook relative to the README.

4. Create `libraries.json`, for example `["react", "react-dom"]`. Every name must appear in that manifest's `dependencies`. The collector rejects missing, development-only, or duplicate names; it never silently substitutes libraries.
5. From `ReCall Exp`, run:

```sh
node scripts/function-ground-truth/collect.mjs /path/to/repo /path/to/libraries.json /path/to/HOST-README.md /path/to/new-ground-truth
```

The repository must be a Git checkout. The output directory must not exist. Hosting commands are deliberately not executed from prose: an agent follows the README, resolves application-specific setup, then runs this command. Stop hosted services afterward as documented there.

## Output and meaning

```text
ground-truth/
  runtime-js/<sha256>.js
  source-maps/<sha256>.map
  func-mapping.json
```

The JSON contains the selected libraries, commit and dirty-checkout flag, input hashes, capture diagnostics, source coverage, and pairs. Pair records contain library names, source/bundled identities and offsets, and supporting-position counts; no function content or `syntaxIdentical` field. Source text is obtained from map `sourcesContent`. Identifiers end in `#<content hash>@<start>-<end>`; offsets are half-open UTF-16 code-unit offsets. Capture asset entries link scripts to maps. Local URLs are normalized to `<local>`.

A pair must satisfy one of the explicit reciprocal-evidence rules below; header artifacts alone cannot establish a new relationship. Both endpoints must be parsed function definitions. Hashes and exact function spans are independently checked before publishing output. These are source-map-supported correspondences, not proof of semantic equivalence. Zero pairs are valid evidence of a coverage/mapping limitation; inspect the diagnostics rather than assuming removal.

## Where an LLM should adapt the pipeline

- **Hosting:** edit the application's README/build configuration for source maps, backend services, or environment variables. Do not put project names or Docker special cases in the collector.
- **Browser setup:** add a `preparePage` module exporting `async function(page)`. It runs after navigation while interception is active. Use it to wait for a meaningful UI selector or handle required authentication/consent. Keep secrets in the environment. Record any interactions in the README; they change capture scope. The default visit does not explore routes or trigger later lazy chunks.
- **Capture (`capture.mjs`):** collects HTTP script responses and debugger-visible scripts, including attached workers. Worker attachment is best effort. Maps come from headers/directives or an adjacent `.map` fallback. Cross-origin maps and redirects are not fetched; protected maps may require an adapted fetch using browser credentials. Partial reads and map failures remain visible in the output.
- **Mapping (`relations.mjs`):** package ownership currently follows `node_modules`/`~` paths in maps. Adapt `packageOf` for workspace aliases or rewritten paths only with explicit ownership evidence. Missing source text and unsupported syntax are reported, not guessed. Update parser options in `function-inventory.mjs` and `verify_pairs.mjs` together.
- **Orchestration (`collect.mjs`):** validates inputs, runs capture/mapping/audit in temporary storage, and publishes the three output components. It does not rebuild, select libraries, compute transformation statistics, or modify a dataset index.

The other scripts in this directory support historical cohort preparation. They are not dependencies of this entry point and are retained to reproduce previous experiments. Internal intermediate metadata is temporary; only the three components above are published.

Validation: `node --test scripts/function-ground-truth/collect.test.mjs` builds a small minified library fixture, serves it locally, captures it with Chrome, checks the published mapping/layout, and verifies rejection of an undeclared library.

## Revised relation policy and frozen-capture rebuild

`reciprocal-body-mapped-v2` uses the same function/token inventory for both sides. Header and structural-punctuation points do not create body edges or contradictory body relationships. Nested function headers remain owned by the nested function. A generated body point with no source-function counterpart still blocks acceptance.

A new body-supported pair requires reciprocal uniqueness of body edges, at least one informative own-body token on each side, and at least two distinct supporting token positions per side. Its own header may corroborate the body edge but cannot establish it. Clean reciprocal full-span pairs with two original positions are retained as a separately labelled evidence rule, including sparse bodies. Any conflict between accepted identities fails closed. Each pair records `evidenceRule`; body-supported pairs also record body evidence counts. These rules establish positional correspondence, not semantic equivalence. Multiplicity is not automatically a true split/combine transformation.

Rebuild from saved artifacts without hosting, recapturing, or consulting recovery predictions:

```sh
node scripts/function-ground-truth/rebuild.mjs /path/to/existing-ground-truth /path/to/new-revision
```

The new revision contains `func-mapping.json` and references the original JS/maps through relative `capture.assets[].localPath` and map `localPath` entries. Keep the original artifacts. The original record and any cohort index remain unchanged. Sampling metadata is historical; the library selection is frozen. Provenance includes the original record hash and collector hashes. Hash/span verification is independent of pair selection, but is not a semantic proof.

Regression tests: `node --test scripts/function-ground-truth/relations.test.mjs`. They cover assignment boundaries, nested callbacks, sparse functions, true competing body mappings, and body points with missing counterparts. The browser integration test also exercises publication of revised records.
