# AutoDL 4090 pilot speed comparison

Measured 2026-11-07. Setup passed; the full 26-repository RQ1 experiment remains paused.

## Results

| Stage | Requests | Local total | AutoDL total | End-to-end speedup | Server-only speedup |
|---|---:|---:|---:|---:|---:|
| Validation | 30 | 71.17 s | 38.04 s | 1.87× | 2.19× |
| Embedding | 10 batches | 1.32 s | 1.99 s | 0.66× | 2.97× |

Speedup is total local time divided by total remote time. Validation median latency was 1.599 s locally and 1.268 s remotely. Embedding median latency was 53.95 ms locally and 125.09 ms remotely: small remote requests were 1.50× slower in aggregate despite faster server computation. Network and transport overhead matter.

Validation decisions agreed on 28/30 requests (93.3%). Two local `T` decisions became remote `F`. Agreement is not ground-truth accuracy; these differences have not been adjudicated here.

## Method and limitations

- Local baseline: saved `bailicangdu/vue2-elm` pilot requests and timings on an Apple M5 MacBook Pro, 32 GB memory.
- Remote: RTX 4090, 24564 MiB VRAM, 16 allocated CPU cores, 120 GB RAM, Ubuntu 22.04.1, NVIDIA driver 580.76.05, Ollama 0.40.6.
- Replay unchanged request payloads in their original order over a persistent HTTP connection through SSH. Exclude two embedding and five validation warm-up requests, then measure ten embedding batches and thirty validation requests. Exclude installation/download time.
- The baseline is a historical run, not a simultaneous controlled hardware test. This small consecutive sample from one repository does not establish whole-cohort or whole-pipeline speedup. Prefix caching, differing backends/quantization, and network conditions are part of the comparison.
- Mac validation uses MLX/safetensors; CUDA validation uses llama.cpp/GGUF Q4_K_M. The shared tag does not identify identical artifacts. Embedding digests match.
- Both models remained fully GPU-resident at 16384 context after alternating embedding and validation. Observed GPU memory use was 21036 MiB. The first CUDA validation request took 96.80 s including initial load/warm-up; this is excluded from steady-state results.

| Model | Local digest | Remote digest |
|---|---|---|
| `qwen3.5:27b` | `2d2e4b8fc7c0479b70f8cba9fc8bdb49a3c9a43a8a6da3873b724c9fca4672ef` | `64ae5b1d651fb2709d5928ccb8dcfb4bb2cc9c2c8001ac34497e36a6cf905b59` |
| `qwen3-embedding:0.6b` | `ac6da0dfba84a81fdbfbaf330198c33cd77c4cdfc53e8bc50eb581914a15621d` | same |

## Implication for ReCall

Remote validation is beneficial in this pilot. Keeping embeddings local is worth considering because their small requests are dominated by transport overhead; the current remote configuration still routes both models through one endpoint. No separate embedding endpoint or algorithm change was introduced in this setup. Future CUDA RQ1 results should use a fresh output directory and consistent model artifacts, rather than mixing with the paused MLX pilot.

## Evidence and reproduction

See [AUTODL.md](AUTODL.md) for setup and commands. Scripts: `scripts/rq1/check-remote.py` and `scripts/rq1/benchmark-remote.py`.

Local raw evidence (ignored experiment outputs):

- `results/autodl-4090-setup/paired/paired-benchmark.json`: individual paired timings, warm-ups, model provenance, decisions, and final model residency.
- `results/autodl-4090-setup/smoke/remote-check.json`: setup checks for short, median, and long requests and model alternation.
- `results/autodl-4090-setup/hardware.json`: hardware snapshot.
- `results/autodl-4090-setup/embedding-during-download/`: incomplete diagnostic trial during download; excluded from reported results.
