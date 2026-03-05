#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const API_BASE = process.env.VIBEKIT_API_URL || 'https://vibekit.bot/api/v1';
const CONFIG_DIR = process.env.HOME ? `${process.env.HOME}/.vibekit` : '.vibekit';
const CONFIG_FILE = `${CONFIG_DIR}/config.json`;
const fs = __importStar(require("fs"));
// ── Config ──────────────────────────────────────────────────────────────────
function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE))
            return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    }
    catch { }
    return {};
}
function saveConfig(config) {
    if (!fs.existsSync(CONFIG_DIR))
        fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
}
function getApiKey() {
    const envKey = process.env.VIBEKIT_API_KEY;
    if (envKey)
        return envKey;
    const config = loadConfig();
    if (config.apiKey)
        return config.apiKey;
    die('No API key. Run: vibekit auth <key>\nGet yours at https://app.vibekit.bot/settings');
    return '';
}
// ── HTTP ────────────────────────────────────────────────────────────────────
async function api(method, path, body) {
    const res = await fetch(`${API_BASE}${path}`, {
        method,
        headers: { 'Authorization': `Bearer ${getApiKey()}`, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 204)
        return {};
    const data = await res.json();
    if (!res.ok)
        die(data.error || `API error (${res.status})`);
    return data;
}
async function apiRaw(method, path) {
    return fetch(`${API_BASE}${path}`, {
        method,
        headers: { 'Authorization': `Bearer ${getApiKey()}` },
    });
}
// ── Output ──────────────────────────────────────────────────────────────────
const JSON_OUT = process.argv.includes('--json');
function out(data) {
    if (JSON_OUT)
        return console.log(JSON.stringify(data, null, 2));
    if (typeof data === 'string')
        console.log(data);
    else
        console.log(JSON.stringify(data, null, 2));
}
function ok(msg) { if (!JSON_OUT)
    console.log(`  ${msg}`); }
function die(msg) { console.error(`  ${msg}`); process.exit(1); }
function table(rows) {
    if (rows.length === 0)
        return;
    const widths = rows[0].map((_, i) => Math.max(...rows.map(r => (r[i] || '').length)));
    rows.forEach((row, ri) => {
        console.log(row.map((c, i) => c.padEnd(widths[i])).join('  '));
        if (ri === 0)
            console.log(widths.map(w => '-'.repeat(w)).join('  '));
    });
}
function timeAgo(iso) {
    const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60)
        return `${s}s ago`;
    if (s < 3600)
        return `${Math.floor(s / 60)}m ago`;
    if (s < 86400)
        return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
}
function truncate(s, n) {
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
// ── Commands ────────────────────────────────────────────────────────────────
async function cmdAuth(args) {
    const key = args[0];
    if (!key)
        die('Usage: vibekit auth <api-key>\nGet yours at https://app.vibekit.bot/settings');
    if (!key.startsWith('vk_'))
        die('Invalid key format — keys start with vk_');
    saveConfig({ ...loadConfig(), apiKey: key });
    ok(`API key saved to ${CONFIG_FILE}`);
}
async function cmdAccount() {
    const d = await api('GET', '/account');
    if (JSON_OUT)
        return out(d);
    console.log(`  Plan:      ${d.plan}`);
    console.log(`  Balance:   $${d.balance?.toFixed(2) || d.credits?.toFixed(2)}`);
    console.log(`  Sessions:  ${d.sessions?.used || 0}/${d.sessions?.limit || '?'}`);
}
// ── Apps ─────────────────────────────────────────────────────────────────────
async function cmdApps() {
    const d = await api('GET', '/hosting/apps');
    const apps = d.apps || d;
    if (JSON_OUT)
        return out(apps);
    if (!apps.length)
        return ok('No apps yet. Create one at https://app.vibekit.bot');
    table([
        ['Slug', 'Name', 'Status', 'URL'],
        ...apps.map((a) => [
            a.subdomain || a.id.slice(0, 8),
            a.name || '-',
            a.status || '-',
            a.url || `${a.subdomain}.vibekit.bot`,
        ]),
    ]);
}
async function cmdAppInfo(args) {
    const id = args[0];
    if (!id)
        die('Usage: vibekit app <id>');
    const d = await api('GET', `/hosting/app/${id}`);
    if (JSON_OUT)
        return out(d);
    console.log(`  Name:       ${d.name || d.appName || '-'}`);
    console.log(`  Agent:      ${d.agentName || '-'}`);
    console.log(`  Status:     ${d.status}`);
    console.log(`  URL:        ${d.url || (d.subdomain + '.vibekit.bot')}`);
    console.log(`  Plan:       ${d.plan || '-'}`);
    console.log(`  Created:    ${d.created_at || '-'}`);
    if (d.customDomain)
        console.log(`  Domain:     ${d.customDomain}`);
    if (d.addons?.database)
        console.log(`  Database:   provisioned`);
}
// ── Deploy ───────────────────────────────────────────────────────────────────
async function cmdDeploy(args) {
    const id = args[0];
    if (!id)
        die('Usage: vibekit deploy <id>');
    const d = await api('POST', `/hosting/app/${id}/redeploy`);
    if (JSON_OUT)
        return out(d);
    ok(`Deploy triggered for ${id}`);
    if (d.message)
        ok(d.message);
}
async function cmdDeploys(args) {
    const id = args[0];
    if (!id)
        die('Usage: vibekit deploys <id>');
    const d = await api('GET', `/hosting/app/${id}/deploys`);
    if (JSON_OUT)
        return out(d);
    const deploys = d.deploys || d;
    if (!deploys.length)
        return ok('No deploys yet');
    table([
        ['ID', 'Status', 'Trigger', 'When'],
        ...deploys.slice(0, 20).map((dep) => [
            (dep.id || dep.deploy_id || '-').slice(0, 8),
            dep.status || '-',
            dep.trigger || '-',
            dep.created_at ? timeAgo(dep.created_at) : '-',
        ]),
    ]);
}
async function cmdRollback(args) {
    const [id, deployId] = args;
    if (!id || !deployId)
        die('Usage: vibekit rollback <app-id> <deploy-id>');
    const d = await api('POST', `/hosting/app/${id}/deploys/${deployId}/rollback`);
    if (JSON_OUT)
        return out(d);
    ok(`Rolled back to ${deployId}`);
}
// ── Logs ─────────────────────────────────────────────────────────────────────
async function cmdLogs(args) {
    const id = args[0];
    if (!id)
        die('Usage: vibekit logs <id>');
    const lines = parseInt(getFlag(args, '--lines') || '50');
    const d = await api('GET', `/hosting/app/${id}/logs?lines=${lines}`);
    if (JSON_OUT)
        return out(d);
    const logs = d.logs || d;
    if (typeof logs === 'string')
        console.log(logs);
    else if (Array.isArray(logs))
        logs.forEach((l) => console.log(typeof l === 'string' ? l : `${l.timestamp || ''} ${l.message || l.text || JSON.stringify(l)}`));
    else
        out(logs);
}
// ── Agent Chat ───────────────────────────────────────────────────────────────
async function cmdChat(args) {
    const id = args[0];
    const msg = args.slice(1).join(' ');
    if (!id || !msg)
        die('Usage: vibekit chat <app-id> "your message"');
    const d = await api('POST', `/hosting/app/${id}/agent`, { message: msg });
    if (JSON_OUT)
        return out(d);
    if (d.response)
        console.log(d.response);
    else if (d.message)
        console.log(d.message);
    else
        ok('Message sent to agent');
}
async function cmdAgentStatus(args) {
    const id = args[0];
    if (!id)
        die('Usage: vibekit agent <id>');
    const d = await api('GET', `/hosting/app/${id}/agent/status`);
    if (JSON_OUT)
        return out(d);
    console.log(`  Status:     ${d.status || d.state || '-'}`);
    console.log(`  Model:      ${d.model || '-'}`);
    if (d.uptime)
        console.log(`  Uptime:     ${d.uptime}`);
    if (d.roles)
        console.log(`  Roles:      ${d.roles.join(', ')}`);
}
// ── Env Vars ─────────────────────────────────────────────────────────────────
async function cmdEnv(args) {
    const id = args[0];
    if (!id)
        die('Usage: vibekit env <id> [set KEY=VAL | del KEY]');
    const action = args[1];
    if (action === 'set') {
        const pair = args[2];
        if (!pair || !pair.includes('='))
            die('Usage: vibekit env <id> set KEY=VALUE');
        const [key, ...rest] = pair.split('=');
        const value = rest.join('=');
        await api('POST', `/hosting/app/${id}/env`, { vars: { [key]: value } });
        ok(`Set ${key}`);
    }
    else if (action === 'del' || action === 'delete') {
        const key = args[2];
        if (!key)
            die('Usage: vibekit env <id> del KEY');
        await api('DELETE', `/hosting/app/${id}/env/${key}`);
        ok(`Deleted ${key}`);
    }
    else {
        const reveal = args.includes('--reveal');
        const d = await api('GET', `/hosting/app/${id}/env${reveal ? '?reveal=true' : ''}`);
        if (JSON_OUT)
            return out(d);
        const vars = d.vars || d.env || d;
        if (typeof vars === 'object') {
            Object.entries(vars).forEach(([k, v]) => console.log(`  ${k}=${v}`));
        }
        else {
            out(vars);
        }
    }
}
// ── Container Control ────────────────────────────────────────────────────────
async function cmdStart(args) {
    const id = args[0];
    if (!id)
        die('Usage: vibekit start <id>');
    await api('POST', `/hosting/app/${id}/start`);
    ok('App started');
}
async function cmdStop(args) {
    const id = args[0];
    if (!id)
        die('Usage: vibekit stop <id>');
    await api('POST', `/hosting/app/${id}/stop`);
    ok('App stopped');
}
async function cmdRestart(args) {
    const id = args[0];
    if (!id)
        die('Usage: vibekit restart <id>');
    await api('POST', `/hosting/app/${id}/restart`);
    ok('App restarted');
}
// ── Database ─────────────────────────────────────────────────────────────────
async function cmdDb(args) {
    const id = args[0];
    if (!id)
        die('Usage: vibekit db <id> [query "SQL" | schema | tables <name> | export]');
    const action = args[1] || 'status';
    if (action === 'query') {
        const sql = args.slice(2).join(' ');
        if (!sql)
            die('Usage: vibekit db <id> query "SELECT * FROM users"');
        const d = await api('POST', `/hosting/app/${id}/database/query`, { sql });
        if (JSON_OUT)
            return out(d);
        console.log(`  ${d.rowCount} rows (${d.durationMs}ms)\n`);
        if (d.rows?.length) {
            table([d.columns, ...d.rows.map((r) => d.columns.map((c) => truncate(String(r[c] ?? 'null'), 40)))]);
        }
    }
    else if (action === 'schema') {
        const d = await api('GET', `/hosting/app/${id}/database/schema`);
        if (JSON_OUT)
            return out(d);
        (d.tables || []).forEach((t) => {
            console.log(`\n  ${t.name}`);
            t.columns.forEach((c) => {
                const flags = [c.isPrimary ? 'PK' : '', c.nullable ? 'null' : 'not null'].filter(Boolean).join(' ');
                console.log(`    ${c.name.padEnd(24)} ${c.type.padEnd(16)} ${flags}`);
            });
        });
    }
    else if (action === 'tables' || action === 'table') {
        const tableName = args[2];
        if (!tableName)
            die('Usage: vibekit db <id> tables <table-name>');
        const limit = getFlag(args, '--limit') || '20';
        const d = await api('GET', `/hosting/app/${id}/database/tables/${tableName}?limit=${limit}`);
        if (JSON_OUT)
            return out(d);
        console.log(`  ~${d.totalRows} rows\n`);
        if (d.rows?.length) {
            table([d.columns, ...d.rows.map((r) => d.columns.map((c) => truncate(String(r[c] ?? 'null'), 30)))]);
        }
    }
    else if (action === 'export') {
        const res = await apiRaw('GET', `/hosting/app/${id}/database/export`);
        if (!res.ok)
            die('Export failed');
        const text = await res.text();
        console.log(text);
    }
    else {
        // status
        const d = await api('GET', `/hosting/app/${id}/database`);
        if (JSON_OUT)
            return out(d);
        if (!d.provisioned)
            return ok('No database provisioned');
        console.log(`  Schema:     ${d.schema}`);
        console.log(`  Tables:     ${d.tables}`);
        console.log(`  Size:       ${d.totalSizeMb} MB`);
        console.log(`  Rows:       ${d.totalRows}`);
        console.log(`  Conns:      ${d.connections}`);
    }
}
// ── Files ────────────────────────────────────────────────────────────────────
async function cmdFiles(args) {
    const id = args[0];
    if (!id)
        die('Usage: vibekit files <id> [path]');
    const path = args[1] || '';
    const d = await api('GET', `/hosting/app/${id}/agent/files${path ? `?path=${encodeURIComponent(path)}` : ''}`);
    if (JSON_OUT)
        return out(d);
    const files = d.files || d;
    if (Array.isArray(files)) {
        files.forEach((f) => {
            const name = typeof f === 'string' ? f : f.name || f.path;
            const size = f.size ? ` (${f.size})` : '';
            console.log(`  ${name}${size}`);
        });
    }
    else
        out(files);
}
// ── QA ───────────────────────────────────────────────────────────────────────
async function cmdQa(args) {
    const id = args[0];
    if (!id)
        die('Usage: vibekit qa <id>');
    const d = await api('POST', `/hosting/app/${id}/qa`);
    if (JSON_OUT)
        return out(d);
    ok('QA run started');
    if (d.runId)
        ok(`Run ID: ${d.runId}`);
}
// ── Usage ────────────────────────────────────────────────────────────────────
async function cmdUsage(args) {
    const id = args[0];
    if (id) {
        const d = await api('GET', `/hosting/app/${id}/usage`);
        if (JSON_OUT)
            return out(d);
        out(d);
    }
    else {
        const d = await api('GET', '/account/usage');
        if (JSON_OUT)
            return out(d);
        out(d);
    }
}
// ── Collaborators ────────────────────────────────────────────────────────────
async function cmdCollaborators(args) {
    const id = args[0];
    if (!id)
        die('Usage: vibekit collaborators <id> [add <email> | remove <id>]');
    const action = args[1];
    if (action === 'add') {
        const email = args[2];
        if (!email)
            die('Usage: vibekit collaborators <id> add <email>');
        const role = getFlag(args, '--role') || 'editor';
        const d = await api('POST', `/hosting/app/${id}/collaborators`, { email, role });
        if (JSON_OUT)
            return out(d);
        ok(`Invited ${email} as ${role}`);
    }
    else if (action === 'remove') {
        const collabId = args[2];
        if (!collabId)
            die('Usage: vibekit collaborators <id> remove <collab-id>');
        await api('DELETE', `/hosting/app/${id}/collaborators/${collabId}`);
        ok('Collaborator removed');
    }
    else {
        const d = await api('GET', `/hosting/app/${id}/collaborators`);
        if (JSON_OUT)
            return out(d);
        const collabs = d.collaborators || d;
        if (!collabs?.length)
            return ok('No collaborators');
        table([
            ['ID', 'Email', 'Role', 'Status'],
            ...collabs.map((c) => [c.id?.slice(0, 8) || '-', c.email || '-', c.role || '-', c.status || '-']),
        ]);
    }
}
// ── Tasks (legacy API) ───────────────────────────────────────────────────────
async function cmdTask(args) {
    const cleanArgs = args.filter(a => !a.startsWith('--'));
    const prompt = cleanArgs.join(' ');
    if (!prompt)
        die('Usage: vibekit task "Build a landing page"');
    const repo = getFlag(args, '--repo');
    const branch = getFlag(args, '--branch');
    const body = { prompt };
    if (repo)
        body.repo = repo;
    if (branch)
        body.branch = branch;
    if (args.includes('--no-deploy'))
        body.deploy = false;
    const d = await api('POST', '/task', body);
    if (JSON_OUT)
        return out(d);
    ok(`Task started: ${d.taskId}`);
    ok(`Poll: vibekit status ${d.taskId}`);
}
async function cmdTaskStatus(args) {
    const taskId = args[0];
    if (!taskId)
        die('Usage: vibekit status <task-id>');
    const d = await api('GET', `/task/${taskId}`);
    if (JSON_OUT)
        return out(d);
    console.log(`  Task:    ${d.taskId}`);
    console.log(`  Status:  ${d.status}`);
    if (d.result?.deployUrl)
        console.log(`  URL:     ${d.result.deployUrl}`);
    if (d.error)
        console.log(`  Error:   ${d.error}`);
}
async function cmdTasks() {
    const d = await api('GET', '/tasks');
    if (JSON_OUT)
        return out(d);
    const tasks = d.tasks || [];
    if (!tasks.length)
        return ok('No tasks');
    tasks.forEach((t) => {
        const icon = t.status === 'complete' ? '+' : t.status === 'running' ? '~' : 'x';
        console.log(`  ${icon} ${t.taskId}  ${(t.status || '').padEnd(10)}  ${truncate(t.prompt || '', 60)}`);
    });
}
// ── Domain ───────────────────────────────────────────────────────────────────
async function cmdDomain(args) {
    const id = args[0];
    if (!id)
        die('Usage: vibekit domain <id> [set <domain> | ssl]');
    const action = args[1];
    if (action === 'set') {
        const domain = args[2];
        if (!domain)
            die('Usage: vibekit domain <id> set <domain>');
        const d = await api('POST', `/hosting/app/${id}/domain`, { domain });
        if (JSON_OUT)
            return out(d);
        ok(`Domain set to ${domain}`);
        if (d.cname)
            ok(`CNAME: ${d.cname}`);
    }
    else if (action === 'ssl') {
        const d = await api('POST', `/hosting/app/${id}/domain/ssl`);
        if (JSON_OUT)
            return out(d);
        ok('SSL certificate requested');
    }
    else {
        const d = await api('GET', `/hosting/app/${id}`);
        if (JSON_OUT)
            return out({ domain: d.customDomain, subdomain: d.subdomain });
        console.log(`  Subdomain:  ${d.subdomain}.vibekit.bot`);
        if (d.customDomain)
            console.log(`  Domain:     ${d.customDomain}`);
    }
}
// ── Helpers ──────────────────────────────────────────────────────────────────
function getFlag(args, flag) {
    const idx = args.indexOf(flag);
    return (idx !== -1 && idx + 1 < args.length) ? args[idx + 1] : undefined;
}
function printHelp() {
    console.log(`
vibekit — manage AI-powered apps from your terminal

Auth:
  vibekit auth <api-key>                   Save your API key

Account:
  vibekit account                          Plan, balance, usage
  vibekit usage [app-id]                   Usage stats

Apps:
  vibekit apps                             List your apps
  vibekit app <id>                         App details
  vibekit start <id>                       Start app
  vibekit stop <id>                        Stop app
  vibekit restart <id>                     Restart app

Agent:
  vibekit chat <id> "message"              Send message to your AI agent
  vibekit agent <id>                       Agent status & model info

Deploy:
  vibekit deploy <id>                      Trigger redeploy
  vibekit deploys <id>                     Deploy history
  vibekit rollback <id> <deploy-id>        Rollback to a previous deploy

Logs & Files:
  vibekit logs <id> [--lines 50]           View app logs
  vibekit files <id> [path]                Browse workspace files

Environment:
  vibekit env <id>                         List env vars
  vibekit env <id> set KEY=VALUE           Set env var
  vibekit env <id> del KEY                 Delete env var
  vibekit env <id> --reveal                Show real values

Database:
  vibekit db <id>                          Database status
  vibekit db <id> schema                   Show tables & columns
  vibekit db <id> table <name>             Browse table data
  vibekit db <id> query "SQL"              Run read-only SQL
  vibekit db <id> export                   Export as SQL dump

Domain:
  vibekit domain <id>                      Show domain config
  vibekit domain <id> set <domain>         Set custom domain
  vibekit domain <id> ssl                  Request SSL cert

Quality:
  vibekit qa <id>                          Run QA audit

Collaboration:
  vibekit collaborators <id>               List collaborators
  vibekit collaborators <id> add <email>   Invite (--role editor|viewer)
  vibekit collaborators <id> remove <id>   Remove collaborator

Tasks (API):
  vibekit task "prompt"                    Submit coding task
  vibekit status <task-id>                 Check task status
  vibekit tasks                            List recent tasks

Flags:
  --json        Machine-readable JSON output
  --reveal      Show unmasked env values

Get your API key: https://app.vibekit.bot/settings
Docs: https://vibekit.bot/SKILL.md
`);
}
// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
    const args = process.argv.slice(2).filter(a => a !== '--json');
    const cmd = args[0];
    const rest = args.slice(1);
    if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
        printHelp();
        return;
    }
    try {
        switch (cmd) {
            case 'auth': return cmdAuth(rest);
            case 'account': return cmdAccount();
            case 'apps': return cmdApps();
            case 'app': return cmdAppInfo(rest);
            case 'deploy': return cmdDeploy(rest);
            case 'deploys': return cmdDeploys(rest);
            case 'rollback': return cmdRollback(rest);
            case 'logs': return cmdLogs(rest);
            case 'chat': return cmdChat(rest);
            case 'agent': return cmdAgentStatus(rest);
            case 'env': return cmdEnv(rest);
            case 'start': return cmdStart(rest);
            case 'stop': return cmdStop(rest);
            case 'restart': return cmdRestart(rest);
            case 'db': return cmdDb(rest);
            case 'files': return cmdFiles(rest);
            case 'qa': return cmdQa(rest);
            case 'usage': return cmdUsage(rest);
            case 'collaborators': return cmdCollaborators(rest);
            case 'domain': return cmdDomain(rest);
            case 'task': return cmdTask(rest);
            case 'status': return cmdTaskStatus(rest);
            case 'tasks': return cmdTasks();
            default:
                // Treat unknown command as a chat message to first app? No — just show help
                console.error(`  Unknown command: ${cmd}`);
                console.error('  Run vibekit help for usage');
                process.exit(1);
        }
    }
    catch (err) {
        die(err.message || 'Unknown error');
    }
}
main();
