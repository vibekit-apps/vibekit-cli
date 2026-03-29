# vibekit

CLI for VibeKit — manage hosted apps and AI agents from your terminal.

## Install

```bash
npm install -g vibekit
vibekit auth login
# or: vibekit auth vk_your_api_key
```

Get an API key at [app.vibekit.bot](https://app.vibekit.bot) → Settings → API Keys.

---

## App Management

```bash
# List all apps
vibekit apps

# Show app details
vibekit app myapp

# Create a new app
vibekit app create --subdomain myapp --template nextjs

# Tail logs
vibekit app logs myapp --lines 50

# Lifecycle
vibekit app restart myapp
vibekit app stop myapp
vibekit app start myapp
vibekit app delete myapp

# Deploy & rollback
vibekit app deploy myapp
vibekit app rollback myapp <deploy-id>

# Env vars
vibekit app env myapp                        # list
vibekit app env myapp API_KEY=abc PORT=3000  # set
vibekit app env myapp --delete OLD_KEY       # delete

# Run a shell command in the container
vibekit app exec myapp "node -e 'console.log(process.version)'"

# CPU/memory stats
vibekit app stats myapp
```

## AI Agent

```bash
# Chat with the agent
vibekit app chat myapp "add a dark mode toggle to the settings page"

# View conversation history
vibekit app history myapp
```

---

## Async Coding Tasks (GitHub-based)

```bash
# Submit a task
vibekit task "Add a contact form" --repo myorg/myapp

# Check status
vibekit status task_abc123

# Wait for completion
vibekit wait task_abc123

# List recent tasks
vibekit tasks

# Recurring tasks
vibekit schedule "Improve performance" --repo myorg/app --every daily
vibekit schedules
vibekit unschedule <id>
```

---

## Auth

```bash
vibekit auth login                  # interactive (prompts for provider)
vibekit auth login anthropic        # connect Claude subscription
vibekit auth login openai           # connect OpenAI subscription
vibekit auth <vk_key>               # save API key directly
vibekit auth status                 # show current auth state
```

---

## All Commands

### App Commands

| Command | Description |
|---------|-------------|
| `vibekit apps` | List all apps |
| `vibekit app <slug>` | Show app details |
| `vibekit app create` | Create a new app |
| `vibekit app delete <slug>` | Delete an app |
| `vibekit app logs <slug>` | View logs |
| `vibekit app restart <slug>` | Restart app |
| `vibekit app stop <slug>` | Stop app |
| `vibekit app start <slug>` | Start app |
| `vibekit app deploy <slug>` | Redeploy from workspace |
| `vibekit app rollback <slug> <id>` | Roll back to a snapshot |
| `vibekit app env <slug>` | View env vars |
| `vibekit app env <slug> K=V ...` | Set env vars |
| `vibekit app env <slug> --delete K` | Delete an env var |
| `vibekit app exec <slug> "<cmd>"` | Run shell command in container |
| `vibekit app stats <slug>` | CPU/memory/disk stats |
| `vibekit app chat <slug> "<msg>"` | Chat with AI agent |
| `vibekit app history <slug>` | View agent chat history |

### Task Commands

| Command | Description |
|---------|-------------|
| `vibekit task "<prompt>"` | Submit async coding task |
| `vibekit status <id>` | Check task status |
| `vibekit wait <id>` | Wait for task to complete |
| `vibekit tasks` | List recent tasks |
| `vibekit schedule "<prompt>"` | Create recurring task |
| `vibekit schedules` | List schedules |
| `vibekit unschedule <id>` | Cancel a schedule |

### Flags

| Flag | Description |
|------|-------------|
| `--json` | Machine-readable JSON output |
| `--repo owner/name` | Target GitHub repo |
| `--branch name` | Branch (default: main) |
| `--lines N` | Log line count (default: 100) |
| `--limit N` | Max results |
| `--every interval` | Schedule interval: hourly, daily, weekly |
| `--no-deploy` | Skip auto-deploy on task |
| `--callback <url>` | Webhook URL for task completion |

---

## JSON Mode

Every command supports `--json` for scripting:

```bash
vibekit apps --json
vibekit app logs myapp --json
vibekit task "Deploy latest" --repo myorg/app --json
vibekit wait task_abc123 --json
vibekit account --json
```

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `VIBEKIT_API_KEY` | Overrides saved API key |

---

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Task failed or general error |
| 10 | Not authenticated |
| 40 | API error |

---

## Links

- [Dashboard](https://app.vibekit.bot)
- [Website](https://vibekit.bot)
- [API Docs](https://vibekit.bot/SKILL.md)
- [GitHub](https://github.com/609NFT/vibekit)
