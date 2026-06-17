# Debugging the demo with harness-fe (solo MCP)

The `electron-demo` is instrumented with [harness-fe](https://github.com/Morphicai/harness-fe) so an AI agent can inspect and drive the running window over MCP — console/network/DOM streaming, click/type, session replay — without you spelling out tool calls.

It runs in **solo mode**: a local gateway on **`127.0.0.1:47620`**, loopback-only, no token. The port (47620) is meetcap's own so it never collides with harness's default `47729` or your other dev servers.

## One-time agent setup

Install the harness-fe skill (teaches the agent the workflow):

```bash
npx @harness-fe/skill install   # auto-detects Claude Code / Cursor / Kiro
```

The MCP server is already wired in [`.mcp.json`](../.mcp.json):

```jsonc
{
  "mcpServers": {
    "harness-fe": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@harness-fe/cli", "mcp"],
      "env": { "HARNESS_PORT": "47620" }
    }
  }
}
```

`@harness-fe/cli mcp` auto-spawns the gateway on `HARNESS_PORT` the first time and proxies the agent's MCP traffic to it. Reload MCP in your IDE after cloning.

## Run

```bash
pnpm demo            # builds + launches the Electron demo
```

The demo renderer (`examples/electron-demo/renderer/app.ts`) sets `window.__HARNESS_FE__ = { mcpUrl: 'ws://127.0.0.1:47620/ws', … }` and imports `@harness-fe/runtime`, which connects to the gateway. A floating "H" overlay confirms the connection.

Open the console to watch live: <http://127.0.0.1:47620/console>

## What the agent can then do

- `page_*` — click, type, navigate, screenshot the demo window
- `*_tail` — stream console, network, errors, DOM mutations
- `session_*` — replay what happened before a bug

Typical loop: describe the symptom ("Start recording does nothing") → the agent tails console/network, finds the source, fixes, re-drives, verifies.

## Notes

- This example always instruments because solo mode is tokenless and local. If you copy the pattern into a shipping app, gate it behind a `NODE_ENV` / feature flag (see harness-fe's [electron.md](https://github.com/Morphicai/harness-fe/blob/main/docs/electron.md)).
- Multi-window session sharing (one session across several `BrowserWindow`s) uses the `window.__HARNESS_FE_SEED__` contract — not needed here (single window).
