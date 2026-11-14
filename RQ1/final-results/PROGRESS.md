# Final RQ1 recovery results

Completed on AutoDL at 11:12:48 a.m. China time on November 14, 2026.

**35/35 repositories complete.** Recovery 85.79% (49,867/58,128). Assessed precision 98.69%.
Original recovery 84.75% and assessed precision 98.66%. Simulation recovery 86.46% on the same completed repositories.
Qwen judgments used in the rebuilt traces 27,051. Revised-prompt requests stored 2,348. Targeted rechecks 1,739, with 362 F-to-T changes and 0 invalid responses.

The experiment rechecks original Qwen rejections with ground-truth-positive labels, reuses other exact historical judgments, and runs the revised prompt on new requests. Each recovery is rebuilt from its original anchors. See [protocol.json](protocol.json) for provenance.

| Repository | Status | Recovery | Original recovery | Assessed precision | Qwen judgments | Revised requests | Rechecked | F to T |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| bun/RockwellShah--filekey | completed | 98.54% | 97.71% | 99.58% | 302 | 6 | 6 | 4 |
| bun/micahkepe--jsongrep | completed | 99.34% | 99.25% | 99.92% | 38 | 2 | 2 | 1 |
| esbuild/mattlewis92--angular-calendar | completed | 62.16% | 62.16% | 100.00% | 16 | 0 | 0 | 0 |
| esbuild/primefaces--primeng | completed | 58.57% | 58.57% | 99.32% | 120 | 2 | 2 | 0 |
| esbuild/primefaces--sakai-ng | completed | 91.44% | 91.37% | 100.00% | 399 | 13 | 13 | 1 |
| esbuild/sissbruecker--linkding | completed | 96.60% | 96.27% | 99.77% | 298 | 32 | 31 | 3 |
| esbuild/swimlane--ngx-charts | completed | 94.20% | 93.99% | 99.87% | 263 | 35 | 33 | 5 |
| esbuild/swimlane--ngx-datatable | completed | 78.27% | 78.27% | 99.62% | 174 | 18 | 18 | 0 |
| parcel/parcel-bundler--website | completed | 75.44% | 74.34% | 100.00% | 301 | 23 | 15 | 2 |
| parcel/tensorflow--tfjs | completed | 75.45% | 74.38% | 96.88% | 2901 | 239 | 188 | 17 |
| rollup/daybrush--scenejs | completed | 89.52% | 89.52% | 98.23% | 73 | 0 | 0 | 0 |
| rollup/omnibrain--svguitar | completed | 97.06% | 97.06% | 100.00% | 5 | 0 | 0 | 0 |
| rollup/vega--vega-lite | completed | 100.00% | 100.00% | 100.00% | 0 | 0 | 0 | 0 |
| turbopack/CalCom--cal.com | completed | 70.43% | 69.07% | 99.13% | 1374 | 98 | 63 | 5 |
| turbopack/CapSoftware--Cap | completed | 72.80% | 70.76% | 99.50% | 1124 | 81 | 46 | 11 |
| turbopack/DayuanJiang--next-ai-draw-io | completed | 81.81% | 80.64% | 99.69% | 1382 | 49 | 43 | 13 |
| turbopack/colinhacks--zod | completed | 72.23% | 70.56% | 99.51% | 1136 | 144 | 111 | 18 |
| turbopack/shadcn-ui--ui | completed | 69.35% | 66.26% | 99.05% | 1782 | 113 | 62 | 15 |
| turbopack/umami-software--umami | completed | 69.10% | 68.97% | 96.83% | 797 | 15 | 15 | 1 |
| vite/CorentinTh--it-tools | completed | 89.00% | 87.17% | 99.25% | 979 | 155 | 93 | 29 |
| vite/DavidHDev--react-bits | completed | 90.81% | 90.69% | 99.75% | 100 | 6 | 6 | 1 |
| vite/LibreChat-AI--LibreChat | completed | 77.19% | 76.28% | 99.53% | 774 | 83 | 78 | 10 |
| vite/Lissy93--dashy | completed | 90.69% | 87.54% | 99.68% | 758 | 144 | 100 | 36 |
| vite/drawdb-io--drawdb | completed | 88.32% | 87.85% | 94.71% | 2665 | 147 | 132 | 18 |
| vite/excalidraw--excalidraw | completed | 98.27% | 98.27% | 100.00% | 113 | 5 | 5 | 0 |
| vite/hoppscotch--hoppscotch | completed | 73.18% | 72.93% | 99.29% | 1259 | 134 | 46 | 6 |
| vite/immich-app--immich | completed | 89.99% | 89.41% | 98.94% | 511 | 61 | 61 | 7 |
| webpack/PanJiaChen--vue-element-admin | completed | 96.16% | 94.59% | 99.04% | 435 | 172 | 102 | 63 |
| webpack/akveo--ngx-admin | completed | 91.56% | 90.53% | 99.53% | 1341 | 223 | 204 | 43 |
| webpack/bailicangdu--vue2-elm | completed | 99.59% | 97.76% | 100.00% | 113 | 16 | 9 | 9 |
| webpack/dair-ai--Prompt-Engineering-Guide | completed | 70.99% | 68.26% | 94.85% | 735 | 107 | 87 | 23 |
| webpack/dokploy--dokploy | completed | 79.49% | 78.85% | 99.52% | 2196 | 31 | 30 | 3 |
| webpack/freeCodeCamp--freeCodeCamp | completed | 82.39% | 81.92% | 98.87% | 442 | 24 | 22 | 4 |
| webpack/supabase--supabase | completed | 85.42% | 84.17% | 99.57% | 1337 | 117 | 68 | 9 |
| webpack/swagger-api--swagger-ui | completed | 92.75% | 92.53% | 99.37% | 808 | 53 | 48 | 5 |
