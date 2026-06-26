"""DeFi Transparency Microscope — Python backend.

This package is the implementation of the DTM backend, replacing
the previous TypeScript/Fastify service.  The wire contract
(REST endpoints under `/api/v1` + the `/ws` WebSocket protocol)
is preserved byte-for-byte so the existing frontend
`HttpAPI` and `WsClient` continue to work without changes.
"""

__version__ = "0.1.0"
