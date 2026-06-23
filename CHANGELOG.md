# Changelog

## v0.1.1 (2026-06-23)

- backend: refactored LLM call to conditionally build params, avoiding DeepSeek unsupported fields
- sandbox: fixed Dockerfile for arm64 TigerVNC compatibility (split install to use official ports)
- frontend: deduplicated plan events in timeline, millisecond timestamp support, CSS overhaul

## v0.1.0 (2026-06-21)

- Initial commit: project setup with FastAPI backend, Vue UI, sandbox
- GitHub repository created and linked
