# RQ1 workflow stage timings

Times are in seconds. Stage durations come from differences between CLI events rounded to 0.1 s. Each retry has its own row. The recovery stage includes writing the final artifacts. An open stage shows observed progress in the JSON. The recorded model API time and recovery-only time come from the latest recovery output or checkpoint.

| Repository | Status | Attempt | preflight | inputs | libraries | anchors | sourceBundler | bundleBundler | sourceModules | bundleModules | sourceGraph | bundleGraph | recovery | Workflow |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| bun/RockwellShah--filekey | completed | 1 | 0.1 | 0.5 | 0.0 | 0.0 | 0.1 | 0.2 | 0.2 | 0.6 | 0.0 | 0.1 | 983.5 | 985.344 |
| bun/micahkepe--jsongrep | completed | 1 | 0.1 | 0.5 | 0.0 | 0.1 | 0.1 | 0.2 | 0.4 | 0.3 | 0.1 | 0.0 | 646.1 | 647.892 |
| esbuild/mattlewis92--angular-calendar | completed | 1 | 0.1 | 0.5 | 0.0 | 0.0 | 0.0 | 0.2 | 0.0 | 0.7 | 0.0 | 0.2 | 32.4 | 34.115 |
| esbuild/primefaces--primeng | completed | 1 | 0.1 | 1.3 | 0.0 | 0.0 | 0.1 | 0.5 | 0.2 | 1.6 | 0.0 | 0.4 | — | — |
| esbuild/primefaces--primeng | completed | 2 | 0.1 | 1.2 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 135.6 | 136.884 |
| esbuild/primefaces--sakai-ng | completed | 1 | 0.1 | 1.1 | 0.0 | 0.0 | 0.2 | 0.3 | 0.5 | 1.2 | 0.0 | 0.2 | 1137.6 | 1141.160 |
| esbuild/sissbruecker--linkding | completed | 1 | 0.1 | 0.2 | 0.0 | 0.0 | 0.0 | 0.1 | 0.1 | 0.1 | 0.0 | 0.1 | 572.8 | 573.488 |
| esbuild/swimlane--ngx-charts | completed | 1 | 0.1 | 1.6 | 0.0 | 0.1 | 0.1 | 0.7 | 0.4 | 1.7 | 0.1 | 0.5 | 1567.2 | 1572.541 |
| esbuild/swimlane--ngx-datatable | completed | 1 | 0.1 | 0.3 | 0.1 | 0.0 | 0.0 | 0.1 | 0.2 | 0.5 | 0.0 | 0.1 | 609.2 | 610.566 |
| parcel/parcel-bundler--website | completed | 1 | 0.1 | 0.1 | 0.0 | 0.0 | 0.0 | 0.0 | 0.1 | 0.1 | 0.0 | 0.0 | 580.6 | 581.030 |
| parcel/tensorflow--tfjs | completed | 1 | 0.1 | 1.3 | 0.0 | 0.1 | 0.4 | 0.3 | 2.1 | 1.0 | 0.0 | 0.2 | 12037.4 | 12042.872 |
| rollup/daybrush--scenejs | completed | 1 | 0.1 | 0.1 | 0.0 | 0.0 | 0.0 | 0.1 | 0.0 | 0.1 | 0.0 | 0.0 | 221.5 | 221.910 |
| rollup/omnibrain--svguitar | completed | 1 | 0.1 | 0.2 | 0.0 | 0.0 | 0.1 | 0.0 | 0.3 | 0.1 | 0.1 | 0.0 | 83.4 | 84.250 |
| rollup/vega--vega-lite | completed | 1 | 0.1 | 0.7 | 0.0 | 0.0 | 0.0 | 0.4 | 0.1 | 1.0 | 0.0 | 0.2 | 41.7 | 44.241 |
| turbopack/CalCom--cal.com | completed | 1 | 0.1 | 1.6 | 0.1 | 0.0 | 0.4 | 0.4 | 0.9 | 1.4 | 0.0 | 0.3 | 6525.8 | 6530.980 |
| turbopack/CapSoftware--Cap | completed | 1 | 0.1 | 1.2 | 0.1 | 0.0 | 0.3 | 0.3 | 1.0 | 1.1 | 0.0 | 0.2 | 5415.8 | 5420.061 |
| turbopack/DayuanJiang--next-ai-draw-io | completed | 1 | 0.1 | 1.8 | 0.0 | 0.1 | 0.3 | 0.6 | 1.1 | 1.4 | 0.1 | 0.2 | 6737.2 | 6742.902 |
| turbopack/colinhacks--zod | completed | 1 | 0.1 | 1.9 | 0.0 | 0.1 | 0.2 | 0.7 | 0.9 | 2.0 | 0.0 | 0.4 | 5596.2 | 5602.514 |
| turbopack/shadcn-ui--ui | stopped | 1 | 0.2 | 12.8 | 0.4 | 0.4 | 0.2 | 6.0 | 1.0 | 21.4 | 0.1 | 2.1 | — | 274.760 |
