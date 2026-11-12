"""Keep the historical localhost endpoint/cache identity on the inference host.

Only forwards TCP bytes from loopback :11435 to Ollama loopback :11434.
No prompt, response, or cache key is modified; no SSH connection is needed.
"""
import asyncio

async def forward(reader, writer):
    try:
        while data := await reader.read(65536):
            writer.write(data)
            await writer.drain()
    finally:
        writer.close()

async def connect(reader, writer):
    try:
        upstream_reader, upstream_writer = await asyncio.open_connection('127.0.0.1', 11434)
        await asyncio.gather(forward(reader, upstream_writer), forward(upstream_reader, writer))
    except (OSError, asyncio.IncompleteReadError):
        writer.close()

async def main():
    server = await asyncio.start_server(connect, '127.0.0.1', 11435)
    async with server:
        await server.serve_forever()

asyncio.run(main())
