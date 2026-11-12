# Remote model inference on AutoDL

ReCall and all datasets stay on the Mac. The AutoDL instance runs only Ollama, reached through an SSH tunnel. The paused Mac pilot remains separate from future CUDA results.

## Server

Instance: RTX 4090, 24 GB VRAM; Ubuntu 22.04; NVIDIA driver 580.76.05. Ollama is installed at version 0.40.6. Server files and model storage live under `/root/autodl-tmp/recall-inference/`.

Start or check the service after an instance restart:

```sh
/root/autodl-tmp/recall-inference/start.sh
curl http://127.0.0.1:11434/api/version
ollama list
ollama ps
```

The start script binds to `127.0.0.1:11434`, permits one inference request at a time, allows two loaded models, and sets the default context to 16384. ReCall also explicitly sends its configured validation context. Model tags are `qwen3-embedding:0.6b` and `qwen3.5:27b`. During validation, check GPU placement and memory with `ollama ps` and `nvidia-smi`.

## Tunnel from the Mac

```sh
ssh -N -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 \
  -o ServerAliveCountMax=3 \
  -L 127.0.0.1:11435:127.0.0.1:11434 \
  -p 19775 root@connect.nmb1.seetacloud.com
```

Enter the SSH password interactively; do not put it in scripts or Git. Keep this connection open while running ReCall. Ollama is not exposed on a public API port.

## New experiment (only when requested)

From `ReCall Exp`:

```sh
python3 scripts/rq1/run.py \
  --endpoint http://127.0.0.1:11435 \
  --output results/rq1-autodl-4090-26
```

This command starts a new cohort run. It is not a continuation of the paused Mac result directory. Endpoint changes are checked before completed results are skipped. ReCall's algorithm and model request settings remain unchanged.

## Reproducibility and timing

The Mac validator uses Ollama's MLX/safetensors variant. Linux/CUDA uses its llama.cpp/GGUF variant under the same model tag. Record actual model digests, quantization, serving version, and hardware; do not claim byte-identical weights or combine these as one homogeneous run. The remote embedding model digest should also be recorded and compared.

`check-remote.py` tests embedding plus short, median, and long saved pilot validation requests, retaining their original options. Its output is a setup test, not RQ1 results. Raw setup records are in ignored `results/autodl-4090-setup/`. They are not inserted into the experiment cache.

Client HTTP wall time includes network overhead; Ollama response durations describe server processing. Keep both. The full experiment remains paused until explicitly resumed/launched.

## Paired speed comparison

`benchmark-remote.py` replays saved pilot requests in chronological order, discards explicit warm-up requests from summaries, and compares 10 embedding requests and 30 validation requests with their recorded local wall/server times. It records model digests, prefix-cache counts where available, decision agreement, and remote residency. This measures the MLX-to-CUDA deployment change, including differing quantization/backend and network overhead; it does not isolate the GPU alone.

Run the setup check and comparison from `ReCall Exp` after both models finish downloading:

```sh
python3 scripts/rq1/check-remote.py \
  --endpoint http://127.0.0.1:11435 \
  --pilot results/rq1-default-26-2026-11-07 \
  --output results/autodl-4090-setup/smoke
python3 scripts/rq1/benchmark-remote.py \
  --endpoint http://127.0.0.1:11435 \
  --case results/rq1-default-26-2026-11-07/webpack/bailicangdu--vue2-elm \
  --output results/autodl-4090-setup/paired
```

Report aggregate speedup as total local request time divided by total remote request time, separately for embedding and validation. Include medians, server-only speedup, decision agreement, and model residency. Exclude downloads and setup from inference timings. These request-level measurements do not establish the full experiment speedup: local parsing, candidate ranking, and other stages still take time.

Measured results: [AutoDL 4090 pilot speed comparison](AUTODL-BENCHMARK.md).
