# RQ1 validation timing

35/35 repositories complete at 2026-11-14T03:12:48.168Z.

Qwen compute time is Ollama prompt evaluation plus token generation. It excludes queueing, model loading, transport, embeddings, and exploration. Wall-clock progress is recorded separately. Rebuilt traces include reused judgments and can omit some targeted rechecks.

| Repository | Judgments used in rebuilt trace | Qwen compute in trace (s) | Revised-prompt requests | Revised Qwen compute (s) |
|---|---:|---:|---:|---:|
| bun/RockwellShah--filekey | 302 | 395.79 | 6 | 5.85 |
| bun/micahkepe--jsongrep | 38 | 48.66 | 2 | 2.09 |
| esbuild/mattlewis92--angular-calendar | 16 | 20.43 | 0 | 0.00 |
| esbuild/primefaces--primeng | 120 | 141.36 | 2 | 1.85 |
| esbuild/primefaces--sakai-ng | 399 | 505.35 | 13 | 11.75 |
| esbuild/sissbruecker--linkding | 298 | 357.65 | 32 | 26.69 |
| esbuild/swimlane--ngx-charts | 263 | 325.97 | 35 | 38.37 |
| esbuild/swimlane--ngx-datatable | 174 | 205.41 | 18 | 20.12 |
| parcel/parcel-bundler--website | 301 | 349.95 | 23 | 22.98 |
| parcel/tensorflow--tfjs | 2,901 | 3714.71 | 239 | 257.50 |
| rollup/daybrush--scenejs | 73 | 81.95 | 0 | 0.00 |
| rollup/omnibrain--svguitar | 5 | 5.16 | 0 | 0.00 |
| rollup/vega--vega-lite | 0 | 0.00 | 0 | 0.00 |
| turbopack/CalCom--cal.com | 1,374 | 1710.95 | 98 | 118.48 |
| turbopack/CapSoftware--Cap | 1,124 | 1429.14 | 81 | 98.30 |
| turbopack/DayuanJiang--next-ai-draw-io | 1,382 | 1718.50 | 49 | 51.60 |
| turbopack/colinhacks--zod | 1,136 | 1404.34 | 144 | 168.96 |
| turbopack/shadcn-ui--ui | 1,782 | 2262.51 | 113 | 131.42 |
| turbopack/umami-software--umami | 797 | 961.42 | 15 | 14.67 |
| vite/CorentinTh--it-tools | 979 | 1149.23 | 155 | 170.15 |
| vite/DavidHDev--react-bits | 100 | 129.56 | 6 | 5.39 |
| vite/LibreChat-AI--LibreChat | 774 | 945.06 | 83 | 88.60 |
| vite/Lissy93--dashy | 758 | 920.61 | 144 | 157.32 |
| vite/drawdb-io--drawdb | 2,665 | 3355.53 | 147 | 158.08 |
| vite/excalidraw--excalidraw | 113 | 150.50 | 5 | 4.72 |
| vite/hoppscotch--hoppscotch | 1,259 | 1620.55 | 134 | 142.59 |
| vite/immich-app--immich | 511 | 671.51 | 61 | 67.31 |
| webpack/PanJiaChen--vue-element-admin | 435 | 512.07 | 172 | 187.38 |
| webpack/akveo--ngx-admin | 1,341 | 1718.79 | 223 | 245.38 |
| webpack/bailicangdu--vue2-elm | 113 | 146.16 | 16 | 18.92 |
| webpack/dair-ai--Prompt-Engineering-Guide | 735 | 975.35 | 107 | 130.02 |
| webpack/dokploy--dokploy | 2,196 | 3107.84 | 31 | 39.15 |
| webpack/freeCodeCamp--freeCodeCamp | 442 | 549.64 | 24 | 24.07 |
| webpack/supabase--supabase | 1,337 | 1750.67 | 117 | 134.79 |
| webpack/swagger-api--swagger-ui | 808 | 963.28 | 53 | 58.61 |
| **Total** | 27,051 | 34305.60 | 2,348 | 2603.11 |
