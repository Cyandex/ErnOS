# Sprout (plugin)

Adds the `sprout` agent tool as an **optional** plugin tool.

## What this is

- Sprout is a standalone workflow shell (typed JSON-first pipelines + approvals/resume).
- This plugin integrates Sprout with ErnOS _without core changes_.

## Enable

Because this tool can trigger side effects (via workflows), it is registered with `optional: true`.

Enable it in an agent allowlist:

```json
{
  "agents": {
    "list": [
      {
        "id": "main",
        "tools": {
          "allow": [
            "sprout" // plugin id (enables all tools from this plugin)
          ]
        }
      }
    ]
  }
}
```

## Using `ernos.invoke` (Sprout → ErnOS tools)

Some Sprout pipelines may include a `ernos.invoke` step to call back into ErnOS tools/plugins (for example: `gog` for Google Workspace, `gh` for GitHub, `message.send`, etc.).

For this to work, the ErnOS Gateway must expose the tool bridge endpoint and the target tool must be allowed by policy:

- ErnOS provides an HTTP endpoint: `POST /tools/invoke`.
- The request is gated by **gateway auth** (e.g. `Authorization: Bearer …` when token auth is enabled).
- The invoked tool is gated by **tool policy** (global + per-agent + provider + group policy). If the tool is not allowed, ErnOS returns `404 Tool not available`.

### Allowlisting recommended

To avoid letting workflows call arbitrary tools, set a tight allowlist on the agent that will be used by `ernos.invoke`.

Example (allow only a small set of tools):

```jsonc
{
  "agents": {
    "list": [
      {
        "id": "main",
        "tools": {
          "allow": ["sprout", "web_fetch", "web_search", "gog", "gh"],
          "deny": ["gateway"],
        },
      },
    ],
  },
}
```

Notes:

- If `tools.allow` is omitted or empty, it behaves like "allow everything (except denied)". For a real allowlist, set a **non-empty** `allow`.
- Tool names depend on which plugins you have installed/enabled.

## Security

- Runs the `sprout` executable as a local subprocess.
- Does not manage OAuth/tokens.
- Uses timeouts, stdout caps, and strict JSON envelope parsing.
- Ensure `sprout` is available on `PATH` for the gateway process.
