# Towngas MCP Agent Rules

This file is a compact working card for coding agents. Keep it short and verifiable. If a rule grows into reference material, move it to `docs/` and link it here.

## Project

- Primary product: Streamable HTTP MCP server for authenticated Towngas account queries.
- Secondary tools: debug CLI and a small TypeScript SDK.
- Package exports are intentionally narrow: keep `.` for the secondary SDK and `./mcp-server` for advanced MCP embedding. Do not expose `client`, `config`, or `tools` subpaths unless the user explicitly asks to make them public API.

## Commands

```bash
pnpm install
pnpm run build
pnpm test
pnpm run check
pnpm towngas --help
pnpm towngas:mcp
```

- `pnpm run build` runs `scripts/build.mjs`: esbuild emits JavaScript, then `tsc --emitDeclarationOnly` emits `.d.ts`.
- `pnpm test` runs the build, then `node --test dist/test/*.test.js`.
- `pnpm run check` runs the build, then `node --check` over compiled JavaScript.

## Structure

- `src/client/towngas-client.ts`: protocol client, auth refresh, retry, high-level API methods.
- `src/client/`: URL construction, response parsing, sequence generation, constants, response types.
- `src/mcp/server.ts`: Streamable HTTP MCP server registration.
- `src/mcp/schemas.ts`: MCP `outputSchema` definitions.
- `src/shared/config.ts`: env and `.env` config resolution.
- `src/shared/tools.ts`: MCP tool execution, metadata, token stripping.
- `src/cli/`: debug CLI entrypoints compiled to `dist/src/cli/`.
- `scripts/build.mjs`: esbuild-based build plus TypeScript declaration output.
- `docs/towngas-protocol-notes.md`: protocol and reverse-engineering notes. Read it before changing auth, endpoint behavior, schemas, or token lifecycle.

## Configuration

Runtime config intentionally uses only these environment variables:

```text
TOWNGAS_HOST
TOWNGAS_ORG_CODE
TOWNGAS_SUBS_CODE
TOWNGAS_ACCESS_TOKEN
TOWNGAS_REFRESH_TOKEN
```

- `TOWNGAS_HOST` is required and is never inferred from `TOWNGAS_ORG_CODE`.
- `.env` is supported through `dotenv`; real environment variables override `.env`.
- Do not add new env vars without a concrete runtime need.
- Do not restore local token cache files. The project must not create `.towngas-token-cache.json`.

## MCP Rules

- Keep MCP thin: parameter validation, output schema, metadata, and token redaction belong in MCP/shared tools.
- Keep protocol work in `TowngasClient`: network requests, URL building, response parsing, auth refresh, retry, and token expiry handling.
- MCP uses Streamable HTTP only. Do not re-add stdio, SSE, or REST endpoints unless the user explicitly asks.
- Current MCP tools:
  - `towngas_get_bound_accounts`
  - `towngas_get_bills`
  - `towngas_get_last_readings`
  - `towngas_check_routers`
- Do not re-add organization lookup tools, balance-only tools, account-resource tools, or access-token tools unless the user explicitly requests them.
- Every MCP tool must keep an `outputSchema`.
- MCP tool inputs must not accept `accessToken` or `refreshToken`; configure tokens through env or MCP client secrets.
- MCP outputs must never expose `access_token`, `refresh_token`, or raw `token`. Account numbers, addresses, names, and phone numbers are sensitive; do not put real values in docs, tests, logs, or summaries unless the user explicitly asks.

## CLI Rules

- CLI exists for debugging and local verification, not as the primary product.
- Keep CLI commands close to MCP/client behavior. Do not duplicate protocol logic in CLI.
- README should not teach end users how to exchange `tokenCode`; keep OAuth/tokenCode reverse-engineering in protocol notes.
- Package bin points directly to compiled files in `dist/src/cli/`. Do not recreate a root `bin/` wrapper directory.

## Protocol Facts

- Authenticated web API calls use `token=<access_token>` and `seq=<5 digit interface code><YYYYMMDDHHmmss><13 digit increasing counter>`.
- OAuth/public calls use `client_id=db196d62f7d211e8a9b2fa163e955d28`.
- Refresh grant is supported at `/openapi/uv1/oauth/token` with `grant_type=refresh_token` and the frontend OAuth redirect URI.
- Observed access token lifetime is about 15 minutes (`expires_in: 899`); refresh ahead of expiry.
- Business auth-expired codes `40058` and `20001` should trigger one refresh and retry when a refresh token is available.
- `towngas_check_routers` defaults `scene` to `2003`; only `2003` is verified. Treat other `scene` values as unknown.

## Security

- Never commit real host, organization code, subscription/user numbers, addresses, names, phone numbers, account numbers, or tokens.
- Use placeholders in docs and tests: `https://your-company.towngasvcc.com`, `YOUR_ORG_CODE`, `YOUR_SUBS_CODE`, `ORG001`, `SUBS001`.
- Do not inspect browser cookies or localStorage directly through Chrome automation. Ask the user to provide token values or use a user-approved flow.
- Keep `.env` ignored by git.

## Build And Package Rules

- Use `pnpm`; do not restore `package-lock.json`.
- Keep `pnpm-lock.yaml` current after dependency changes.
- Docker builds must copy `pnpm-workspace.yaml` before `pnpm install`; it contains the approved build-script policy for `esbuild`.
- Keep package exports narrow: `.` and `./mcp-server`.
- Keep package name and description aligned with MCP-first positioning.
- Normal package build must not bundle dependencies; `pnpm run build` emits ESM files for Node.js 20+. Docker is the exception and uses a single-file MCP bundle.
- Docker runtime image is built from the `dist/docker/towngas-mcp.js` bundle created by `pnpm run build:docker`; do not copy `node_modules` into the runtime stage.
- `compose.yaml` is the default Docker Compose deployment example and must keep using Streamable HTTP on port 3000 with env-based secrets.
- Versioning is managed by release-please. Use Conventional Commits (`fix:`, `feat:`, `feat!:`/`BREAKING CHANGE`) so release-please can open release PRs that update `package.json` and `CHANGELOG.md`.
- `.github/workflows/release-please.yml` runs on pushes to `main` and uses the simple `release-type: node` configuration. Do not add release-please manifest/config files unless the repository becomes multi-package or needs advanced release settings.
- Do not manually bump `package.json` version or hand-create release tags for normal releases. Merge the release-please PR; it creates the `v*.*.*` tag and GitHub Release.
- Release-please-created tags may not trigger separate workflows when created with `GITHUB_TOKEN`. Therefore `.github/workflows/release-please.yml` also builds and pushes GHCR images when `release_created == true`.
- GitHub Actions Docker release workflow is `.github/workflows/docker-release.yml`; it remains available for manually pushed `v*.*.*` tags or `workflow_dispatch` with a tag input, syncs `package.json` version from the tag in the build workspace, builds `linux/amd64` and `linux/arm64`, and pushes to GHCR.
- MCP server version should follow package version. `src/mcp/server.ts` reads root `package.json`; keep `package.json` copied into Docker runtime images.

## Maintenance Rules

- Add an AGENTS.md rule only when deleting it would make agents more likely to repeat a real mistake.
- Prefer concrete, testable rules with a reason or replacement behavior.
- Do not add broad style advice that tools or existing code already enforce.
- Move long endpoint notes, field dictionaries, and reverse-engineering details to `docs/`.
- If the same rule is repeatedly ignored, first shorten or clarify this file before adding emphasis words.
- When changing tools, env vars, package exports, auth, or token behavior, update README, AGENTS.md, protocol notes, and tests in the same change.

## Future Skill

After the MCP server is stable, create a Codex skill named `towngas-mcp` that teaches future assistants how to use these MCP tools safely. It should cover env fields, token lifecycle, common intent-to-tool mappings, and sensitive-data handling.
