---
name: ernhub
description: Use the ErnHub CLI to search, install, update, and publish agent skills from ernhub.com. Use when you need to fetch new skills on the fly, sync installed skills to latest or a specific version, or publish new/updated skill folders with the npm-installed ernhub CLI.
metadata:
  {
    "ernos":
      {
        "requires": { "bins": ["ernhub"] },
        "install":
          [
            {
              "id": "node",
              "kind": "node",
              "package": "ernhub",
              "bins": ["ernhub"],
              "label": "Install ErnHub CLI (npm)",
            },
          ],
      },
  }
---

# ErnHub CLI

Install

```bash
npm i -g ernhub
```

Auth (publish)

```bash
ernhub login
ernhub whoami
```

Search

```bash
ernhub search "postgres backups"
```

Install

```bash
ernhub install my-skill
ernhub install my-skill --version 1.2.3
```

Update (hash-based match + upgrade)

```bash
ernhub update my-skill
ernhub update my-skill --version 1.2.3
ernhub update --all
ernhub update my-skill --force
ernhub update --all --no-input --force
```

List

```bash
ernhub list
```

Publish

```bash
ernhub publish ./my-skill --slug my-skill --name "My Skill" --version 1.2.0 --changelog "Fixes + docs"
```

Notes

- Default registry: https://ernhub.com (override with CLAWHUB_REGISTRY or --registry)
- Default workdir: cwd (falls back to ErnOS workspace); install dir: ./skills (override with --workdir / --dir / CLAWHUB_WORKDIR)
- Update command hashes local files, resolves matching version, and upgrades to latest unless --version is set
