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
const API_BASE = 'https://vibekit.bot/api/v1';
const CONFIG_DIR = process.env.HOME ? `${process.env.HOME}/.vibekit` : '.vibekit';
const CONFIG_FILE = `${CONFIG_DIR}/config.json`;
const fs = __importStar(require("fs"));
function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
        }
    }
    catch { }
    return {};
}
function saveConfig(config) {
    if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
}
function getApiKey() {
    const envKey = process.env.VIBEKIT_API_KEY;
    if (envKey)
        return envKey;
    const config = loadConfig();
    if (config.apiKey)
        return config.apiKey;
    error('No API key configured. Run: vibekit auth <your-api-key>');
    process.exit(10);
}
// ---- HTTP ----
async function api(method, endpoint, body) {
    const apiKey = getApiKey();
    const url = `${API_BASE}${endpoint}`;
    const opts = {
        method,
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
    };
    if (body) {
        opts.body = JSON.stringify(body);
    }
    const res = await fetch(url, opts);
    const data = await res.json();
    if (!res.ok) {
        error(data.error || `API error (${res.status})`);
        process.exit(40);
    }
    return data;
}
// ---- Output ----
const isJson = process.argv.includes('--json');
function output(data) {
    if (isJson) {
        console.log(JSON.stringify(data, null, 2));
    }
    else {
        if (typeof data === 'string') {
            console.log(data);
        }
        else {
            console.log(JSON.stringify(data, null, 2));
        }
    }
}
function error(msg) {
    if (isJson) {
        console.error(JSON.stringify({ error: msg }));
    }
    else {
        console.error(`✖ ${msg}`);
    }
}
function success(msg) {
    if (!isJson) {
        console.log(`✓ ${msg}`);
    }
}
// ---- Commands ----
async function cmdAuth(args) {
    const subCmd = args[0];
    if (subCmd && subCmd.startsWith('vk_')) {
        saveConfig({ ...loadConfig(), apiKey: subCmd });
        success(`API key saved to ${CONFIG_FILE}`);
        return;
    }
    if (subCmd === 'login' || !subCmd) {
        const provider = args[1] || await promptProvider();
        if (provider === 'anthropic' || provider === 'claude') {
            await authWithProvider('anthropic');
        }
        else if (provider === 'openai' || provider === 'codex') {
            await authWithProvider('openai');
        }
        else if (provider === 'key') {
            console.log('\n  Paste your VibeKit API key:');
            const key = await readLine('  > ');
            if (!key.startsWith('vk_')) {
                error('Keys start with vk_');
                process.exit(1);
            }
            saveConfig({ ...loadConfig(), apiKey: key });
            success(`API key saved to ${CONFIG_FILE}`);
        }
        else {
            error(`Unknown provider: ${provider}. Use: anthropic, openai, or key`);
            process.exit(1);
        }
        return;
    }
    if (subCmd === 'status') {
        const config = loadConfig();
        if (!config.apiKey) {
            console.log('  Not authenticated. Run: vibekit auth');
            return;
        }
        try {
            const data = await api('GET', '/account');
            console.log(`  Authenticated as: ${data.githubUsername || data.telegramId || 'unknown'}`);
            console.log(`  Plan: ${data.plan}`);
            console.log(`  Claude: ${data.claudeKeySet || data.hasClaudeKey ? '✓ Connected' : '✗ Not connected'}`);
            console.log(`  OpenAI: ${data.hasOpenaiKey ? '✓ Connected' : '✗ Not connected'}`);
        }
        catch {
            console.log('  API key saved but could not reach server.');
        }
        return;
    }
    error('Usage: vibekit auth [login|status] [anthropic|openai|key]');
}
async function authWithProvider(provider) {
    const config = loadConfig();
    if (!config.apiKey) {
        error('Set your VibeKit API key first: vibekit auth <vk_key>');
        error('Get one at https://vibekit.bot or via Telegram /apikey');
        process.exit(1);
    }
    const { loginAnthropic, loginOpenAI } = await Promise.resolve().then(() => __importStar(require('./auth-oauth')));
    console.log(`\n  Connecting ${provider === 'anthropic' ? 'Anthropic / Claude' : 'OpenAI / Codex'}...`);
    const result = provider === 'anthropic' ? await loginAnthropic() : await loginOpenAI();
    const endpoint = provider === 'anthropic' ? '/account/claude-key' : '/account/openai-key';
    const bodyKey = provider === 'anthropic' ? 'claudeKey' : 'openaiKey';
    try {
        await api('PUT', endpoint, { [bodyKey]: result.accessToken });
        success(`${provider === 'anthropic' ? 'Anthropic / Claude' : 'OpenAI / Codex'} connected via subscription!`);
        if (result.expiresIn) {
            const days = Math.round(result.expiresIn / 86400);
            console.log(`  Token expires in ~${days} days. Re-run this command to refresh.`);
        }
    }
    catch (err) {
        error(`Failed to save token: ${err.message}`);
        process.exit(1);
    }
}
async function promptProvider() {
    console.log('\n  Connect a provider to use your subscription:\n');
    console.log('  1) Anthropic / Claude  — use your Pro/Max subscription');
    console.log('  2) OpenAI / Codex      — use your Plus/Pro/Team subscription');
    console.log('  3) API key             — paste a VibeKit API key\n');
    const choice = await readLine('  Choose (1/2/3): ');
    if (choice === '1' || choice.toLowerCase().includes('anthropic') || choice.toLowerCase().includes('claude'))
        return 'anthropic';
    if (choice === '2' || choice.toLowerCase().includes('openai') || choice.toLowerCase().includes('codex'))
        return 'openai';
    if (choice === '3' || choice.toLowerCase().includes('key'))
        return 'key';
    return choice;
}
function readLine(prompt) {
    return new Promise((resolve) => {
        const readline = require('readline');
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        rl.question(prompt, (answer) => { rl.close(); resolve(answer.trim()); });
    });
}
async function cmdAccount() {
    const data = await api('GET', '/account');
    if (isJson) {
        output(data);
    }
    else {
        console.log(`Plan:       ${data.plan}`);
        console.log(`Credits:    $${(data.credits || 0).toFixed(2)}`);
        const mins = data.containerMinutes;
        if (mins)
            console.log(`Container:  ${mins.used}/${mins.limit === 'unlimited' ? '∞' : mins.limit} min`);
        const tasks = data.scheduledTasks;
        if (tasks)
            console.log(`Schedules:  ${tasks.limit === 'unlimited' ? '∞' : tasks.limit} allowed`);
    }
}
// ---- App Commands ----
async function cmdApps() {
    const data = await api('GET', '/hosting/apps');
    if (isJson) {
        output(data);
    }
    else {
        const apps = data.apps || data || [];
        if (apps.length === 0) {
            console.log('No apps yet. Create one: vibekit app create --template nextjs --subdomain myapp');
            return;
        }
        for (const a of apps) {
            const status = a.status === 'running' ? '●' : a.status === 'stopped' ? '○' : '◐';
            const url = a.customDomain ? `https://${a.customDomain}` : `https://${a.subdomain}.vibekit.bot`;
            console.log(`${status} ${(a.subdomain || a.id).padEnd(20)}  ${a.status?.padEnd(10) || ''}  ${url}`);
        }
    }
}
async function cmdApp(args) {
    const subCmd = args[0];
    const rest = args.slice(1);
    switch (subCmd) {
        case 'list':
        case 'ls': return cmdApps();
        case 'create': return cmdAppCreate(rest);
        case 'delete':
        case 'rm': return cmdAppDelete(rest);
        case 'logs': return cmdAppLogs(rest);
        case 'restart': return cmdAppRestart(rest);
        case 'stop': return cmdAppStop(rest);
        case 'start': return cmdAppStart(rest);
        case 'deploy': return cmdAppDeploy(rest);
        case 'redeploy': return cmdAppRedeploy(rest);
        case 'rollback': return cmdAppRollback(rest);
        case 'env': return cmdAppEnv(rest);
        case 'exec': return cmdAppExec(rest);
        case 'stats': return cmdAppStats(rest);
        case 'chat': return cmdAppChat(rest);
        case 'history': return cmdAppHistory(rest);
        default: {
            // vibekit app <slug> — show app details
            if (subCmd) {
                const data = await api('GET', `/hosting/app/${subCmd}`);
                if (isJson) {
                    output(data);
                }
                else {
                    const a = data.app || data;
                    const url = a.customDomain ? `https://${a.customDomain}` : `https://${a.subdomain}.vibekit.bot`;
                    console.log(`Name:      ${a.subdomain || a.id}`);
                    console.log(`Status:    ${a.status}`);
                    console.log(`URL:       ${url}`);
                    console.log(`Plan:      ${a.plan}`);
                    if (a.containerId)
                        console.log(`Container: ${a.containerId}`);
                }
                return;
            }
            console.log(`Usage:
  vibekit app                          List all apps
  vibekit app <slug>                   Show app details
  vibekit app create --subdomain <s>   Create a new app
  vibekit app delete <slug>            Delete an app
  vibekit app logs <slug>              View logs
  vibekit app restart <slug>           Restart app
  vibekit app stop <slug>              Stop app
  vibekit app start <slug>             Start app
  vibekit app deploy <slug>            Redeploy from workspace
  vibekit app rollback <slug> <id>     Roll back to a snapshot
  vibekit app env <slug>               View env vars
  vibekit app env <slug> KEY=VAL ...   Set env vars
  vibekit app env <slug> --delete KEY  Delete an env var
  vibekit app exec <slug> "<cmd>"      Run a shell command in container
  vibekit app stats <slug>             CPU/memory/disk stats
  vibekit app chat <slug> "<msg>"      Chat with AI agent
  vibekit app history <slug>           View agent chat history`);
        }
    }
}
async function cmdAppCreate(args) {
    const subdomain = getFlag(args, '--subdomain') || getFlag(args, '-s');
    const template = getFlag(args, '--template') || getFlag(args, '-t') || 'express';
    if (!subdomain) {
        error('Usage: vibekit app create --subdomain <name> [--template <template>]');
        process.exit(1);
    }
    const data = await api('POST', '/hosting/apps', { subdomain, template });
    if (isJson) {
        output(data);
    }
    else {
        success(`App created: ${subdomain}.vibekit.bot`);
        if (data.app?.id)
            console.log(`ID: ${data.app.id}`);
    }
}
async function cmdAppDelete(args) {
    const slug = args[0];
    if (!slug) {
        error('Usage: vibekit app delete <slug>');
        process.exit(1);
    }
    await api('DELETE', `/hosting/app/${slug}`);
    success(`App deleted: ${slug}`);
}
async function cmdAppLogs(args) {
    const slug = args[0];
    if (!slug) {
        error('Usage: vibekit app logs <slug> [--lines N]');
        process.exit(1);
    }
    const lines = getFlag(args, '--lines') || '100';
    const data = await api('GET', `/hosting/app/${slug}/logs?lines=${lines}`);
    if (isJson) {
        output(data);
    }
    else {
        const logs = data.logs || data;
        if (typeof logs === 'string') {
            console.log(logs);
        }
        else if (Array.isArray(logs)) {
            console.log(logs.join('\n'));
        }
        else {
            console.log(JSON.stringify(logs, null, 2));
        }
    }
}
async function cmdAppRestart(args) {
    const slug = args[0];
    if (!slug) {
        error('Usage: vibekit app restart <slug>');
        process.exit(1);
    }
    await api('POST', `/hosting/app/${slug}/restart`);
    success(`Restarting ${slug}`);
}
async function cmdAppStop(args) {
    const slug = args[0];
    if (!slug) {
        error('Usage: vibekit app stop <slug>');
        process.exit(1);
    }
    await api('POST', `/hosting/app/${slug}/stop`);
    success(`Stopped ${slug}`);
}
async function cmdAppStart(args) {
    const slug = args[0];
    if (!slug) {
        error('Usage: vibekit app start <slug>');
        process.exit(1);
    }
    await api('POST', `/hosting/app/${slug}/start`);
    success(`Started ${slug}`);
}
async function cmdAppDeploy(args) {
    const slug = args[0];
    if (!slug) {
        error('Usage: vibekit app deploy <slug>');
        process.exit(1);
    }
    const data = await api('POST', `/hosting/app/${slug}/redeploy`);
    if (isJson) {
        output(data);
    }
    else {
        success(`Deploying ${slug}...`);
    }
}
async function cmdAppRedeploy(args) {
    return cmdAppDeploy(args);
}
async function cmdAppRollback(args) {
    const slug = args[0];
    const deployId = args[1];
    if (!slug || !deployId) {
        error('Usage: vibekit app rollback <slug> <deploy-id>');
        error('       Use: vibekit app history <slug> to list snapshots');
        process.exit(1);
    }
    await api('POST', `/hosting/app/${slug}/deploys/${deployId}/rollback`);
    success(`Rolled back ${slug} to ${deployId}`);
}
async function cmdAppEnv(args) {
    const slug = args[0];
    if (!slug) {
        error('Usage: vibekit app env <slug> [KEY=VALUE ...] [--delete KEY]');
        process.exit(1);
    }
    const delKey = getFlag(args, '--delete') || getFlag(args, '-d');
    if (delKey) {
        await api('DELETE', `/hosting/app/${slug}/env/${delKey}`);
        success(`Deleted ${delKey} from ${slug}`);
        return;
    }
    const pairs = args.slice(1).filter(a => a.includes('=') && !a.startsWith('--'));
    if (pairs.length === 0) {
        // Get env
        const data = await api('GET', `/hosting/app/${slug}/env`);
        if (isJson) {
            output(data);
        }
        else {
            const vars = data.vars || data.env || data || {};
            for (const [k, v] of Object.entries(vars)) {
                console.log(`${k}=${v}`);
            }
        }
    }
    else {
        // Set env
        const vars = {};
        for (const pair of pairs) {
            const eq = pair.indexOf('=');
            vars[pair.slice(0, eq)] = pair.slice(eq + 1);
        }
        await api('PUT', `/hosting/app/${slug}/env`, { vars });
        success(`Set ${Object.keys(vars).length} variable(s) for ${slug}`);
    }
}
async function cmdAppExec(args) {
    const slug = args[0];
    const cleanArgs = args.slice(1).filter(a => !a.startsWith('--'));
    const command = cleanArgs.join(' ');
    if (!slug || !command) {
        error('Usage: vibekit app exec <slug> "<command>"');
        process.exit(1);
    }
    const data = await api('POST', `/hosting/app/${slug}/exec`, { command });
    if (isJson) {
        output(data);
    }
    else {
        const out = data.output || data.stdout || data.result || JSON.stringify(data);
        console.log(out);
    }
}
async function cmdAppStats(args) {
    const slug = args[0];
    if (!slug) {
        error('Usage: vibekit app stats <slug>');
        process.exit(1);
    }
    const data = await api('GET', `/hosting/app/${slug}/stats`);
    if (isJson) {
        output(data);
    }
    else {
        if (data.cpu !== undefined)
            console.log(`CPU:    ${data.cpu}%`);
        if (data.memory !== undefined)
            console.log(`Memory: ${data.memory} MB`);
        if (data.disk !== undefined)
            console.log(`Disk:   ${data.disk} MB`);
        if (data.uptime !== undefined)
            console.log(`Uptime: ${data.uptime}`);
        if (!data.cpu && !data.memory)
            console.log(JSON.stringify(data, null, 2));
    }
}
async function cmdAppChat(args) {
    const slug = args[0];
    const cleanArgs = args.slice(1).filter(a => !a.startsWith('--'));
    const message = cleanArgs.join(' ');
    if (!slug || !message) {
        error('Usage: vibekit app chat <slug> "<message>"');
        process.exit(1);
    }
    if (!isJson)
        process.stdout.write('Agent: ');
    const data = await api('POST', `/hosting/app/${slug}/agent`, { message });
    if (isJson) {
        output(data);
    }
    else {
        const response = data.response || data.text || data.message || JSON.stringify(data);
        console.log(response);
    }
}
async function cmdAppHistory(args) {
    const slug = args[0];
    if (!slug) {
        error('Usage: vibekit app history <slug> [--limit N]');
        process.exit(1);
    }
    const limit = getFlag(args, '--limit') || '20';
    const data = await api('GET', `/hosting/app/${slug}/agent/history?limit=${limit}`);
    if (isJson) {
        output(data);
    }
    else {
        const msgs = data.messages || data || [];
        for (const m of msgs) {
            const role = m.role === 'user' ? 'You' : 'Agent';
            const text = (m.text || m.content || '').slice(0, 120);
            const time = m.createdAt ? new Date(m.createdAt).toLocaleString() : '';
            console.log(`[${time}] ${role}: ${text}${text.length >= 120 ? '…' : ''}`);
        }
    }
}
// ---- Task Commands ----
async function cmdTask(args) {
    const cleanArgs = args.filter(a => !a.startsWith('--'));
    const prompt = cleanArgs.join(' ');
    if (!prompt) {
        error('Usage: vibekit task "Build a landing page with email signup"');
        process.exit(1);
    }
    const repo = getFlag(args, '--repo');
    const branch = getFlag(args, '--branch');
    const callbackUrl = getFlag(args, '--callback');
    const noDeploy = args.includes('--no-deploy');
    const body = { prompt };
    if (repo)
        body.repo = repo;
    if (branch)
        body.branch = branch;
    if (callbackUrl)
        body.callbackUrl = callbackUrl;
    if (noDeploy)
        body.deploy = false;
    const data = await api('POST', '/task', body);
    if (isJson) {
        output(data);
    }
    else {
        success(`Task started: ${data.taskId}`);
        console.log(`Status: ${data.status}`);
        console.log(`\nPoll: vibekit status ${data.taskId}`);
        console.log(`Wait: vibekit wait ${data.taskId}`);
    }
}
async function cmdStatus(args) {
    const taskId = args[0];
    if (!taskId) {
        error('Usage: vibekit status <task-id>');
        process.exit(1);
    }
    const data = await api('GET', `/task/${taskId}`);
    if (isJson) {
        output(data);
    }
    else {
        console.log(`Task:    ${data.taskId}`);
        console.log(`Status:  ${data.status}`);
        console.log(`Started: ${data.startedAt}`);
        if (data.completedAt)
            console.log(`Done:    ${data.completedAt}`);
        if (data.result) {
            console.log(`\nResult:`);
            if (data.result.summary)
                console.log(data.result.summary);
            if (data.result.commitUrl)
                console.log(`\nCommit: ${data.result.commitUrl}`);
            if (data.result.deployUrl)
                console.log(`Deploy: ${data.result.deployUrl}`);
        }
        if (data.error)
            console.log(`\nError: ${data.error}`);
    }
}
async function cmdWait(args) {
    const taskId = args[0];
    if (!taskId) {
        error('Usage: vibekit wait <task-id>');
        process.exit(1);
    }
    if (!isJson)
        process.stdout.write('Waiting');
    for (let i = 0; i < 120; i++) {
        const data = await api('GET', `/task/${taskId}`);
        if (data.status === 'complete' || data.status === 'failed') {
            if (!isJson)
                console.log('');
            output(data);
            process.exit(data.status === 'failed' ? 1 : 0);
        }
        if (!isJson)
            process.stdout.write('.');
        await new Promise(r => setTimeout(r, 5000));
    }
    if (!isJson)
        console.log('');
    error('Timed out waiting for task');
    process.exit(1);
}
async function cmdTasks() {
    const data = await api('GET', '/tasks');
    if (isJson) {
        output(data);
    }
    else {
        if (data.tasks.length === 0) {
            console.log('No tasks yet.');
            return;
        }
        for (const t of data.tasks) {
            const status = t.status === 'complete' ? '✓' : t.status === 'running' ? '⟳' : '✖';
            console.log(`${status} ${t.taskId}  ${t.status.padEnd(8)}  ${t.prompt}`);
        }
    }
}
async function cmdSchedule(args) {
    const cleanArgs = args.filter(a => !a.startsWith('--'));
    const prompt = cleanArgs.join(' ');
    if (!prompt) {
        error('Usage: vibekit schedule "Improve SEO" --repo owner/repo --every daily');
        process.exit(1);
    }
    const repo = getFlag(args, '--repo');
    const interval = getFlag(args, '--every') || 'daily';
    if (!repo) {
        error('--repo is required for scheduled tasks');
        process.exit(1);
    }
    const data = await api('POST', '/schedule', { prompt, repo, interval });
    if (isJson) {
        output(data);
    }
    else {
        success(`Schedule created: ${data.scheduleId}`);
        console.log(`Interval: ${data.interval}`);
        console.log(`Next run: ${data.nextRun}`);
    }
}
async function cmdSchedules() {
    const data = await api('GET', '/schedules');
    if (isJson) {
        output(data);
    }
    else {
        if (data.schedules.length === 0) {
            console.log('No scheduled tasks.');
            return;
        }
        for (const s of data.schedules) {
            const status = s.enabled ? '✓' : '○';
            console.log(`${status} ${s.scheduleId}  ${s.interval.padEnd(12)}  ${s.name}  (${s.runCount} runs)`);
        }
    }
}
async function cmdUnschedule(args) {
    const scheduleId = args[0];
    if (!scheduleId) {
        error('Usage: vibekit unschedule <schedule-id>');
        process.exit(1);
    }
    await api('DELETE', `/schedule/${scheduleId}`);
    success('Schedule cancelled');
}
// ---- Helpers ----
function getFlag(args, flag) {
    const idx = args.indexOf(flag);
    if (idx !== -1 && idx + 1 < args.length) {
        return args[idx + 1];
    }
    return undefined;
}
function printHelp() {
    console.log(`
vibekit — AI-powered app hosting and development

Usage:
  vibekit auth                      Connect provider (interactive)
  vibekit auth login anthropic      Connect Claude subscription
  vibekit auth login openai         Connect OpenAI subscription
  vibekit auth <api-key>            Save VibeKit API key
  vibekit auth status               Show connection status
  vibekit account                   Show plan & usage

  vibekit app                       List all apps
  vibekit app <slug>                Show app details
  vibekit app create --subdomain s  Create a new app
  vibekit app delete <slug>         Delete an app
  vibekit app logs <slug>           View logs
  vibekit app restart <slug>        Restart app
  vibekit app stop <slug>           Stop app
  vibekit app start <slug>          Start app
  vibekit app deploy <slug>         Redeploy from workspace
  vibekit app rollback <slug> <id>  Roll back to a snapshot
  vibekit app env <slug>            View env vars
  vibekit app env <slug> K=V ...    Set env vars
  vibekit app env <slug> --delete K Delete an env var
  vibekit app exec <slug> "<cmd>"   Run a shell command in container
  vibekit app stats <slug>          CPU/memory/disk stats
  vibekit app chat <slug> "<msg>"   Chat with AI agent
  vibekit app history <slug>        View agent chat history

  vibekit task "<prompt>"           Submit a coding task
  vibekit status <task-id>          Check task status
  vibekit wait <task-id>            Wait for task to complete
  vibekit tasks                     List recent tasks
  vibekit schedule "<prompt>"       Create recurring task
  vibekit schedules                 List scheduled tasks
  vibekit unschedule <id>           Cancel a schedule

Flags:
  --json                            Machine-readable JSON output
  --repo owner/name                 Target GitHub repo
  --branch name                     Target branch (default: main)
  --every interval                  Schedule interval: hourly|daily|weekly
  --callback <url>                  Webhook URL for task completion
  --no-deploy                       Skip auto-deploy
  --lines N                         Number of log lines (default: 100)
  --limit N                         Max results to return

Examples:
  vibekit auth login anthropic
  vibekit app list
  vibekit app create --subdomain myapp --template nextjs
  vibekit app logs myapp --lines 50
  vibekit app env myapp DATABASE_URL=postgres://...
  vibekit app chat myapp "add a contact form"
  vibekit task "Build a landing page" --repo myorg/myapp
  vibekit wait task_abc123

Get your API key: https://vibekit.bot
API docs: https://vibekit.bot/SKILL.md
`);
}
// ---- Main ----
async function main() {
    const args = process.argv.slice(2).filter(a => a !== '--json');
    const command = args[0];
    const rest = args.slice(1);
    if (!command || command === 'help' || command === '--help' || command === '-h') {
        printHelp();
        process.exit(0);
    }
    try {
        switch (command) {
            case 'auth':
                await cmdAuth(rest);
                break;
            case 'account':
                await cmdAccount();
                break;
            case 'app':
                await cmdApp(rest);
                break;
            case 'apps':
                await cmdApps();
                break;
            case 'task':
                await cmdTask(rest);
                break;
            case 'status':
                await cmdStatus(rest);
                break;
            case 'wait':
                await cmdWait(rest);
                break;
            case 'tasks':
                await cmdTasks();
                break;
            case 'schedule':
                await cmdSchedule(rest);
                break;
            case 'schedules':
                await cmdSchedules();
                break;
            case 'unschedule':
                await cmdUnschedule(rest);
                break;
            default:
                // Treat unknown command as a task prompt
                await cmdTask(args);
        }
    }
    catch (err) {
        error(err.message || 'Unknown error');
        process.exit(1);
    }
}
main();
