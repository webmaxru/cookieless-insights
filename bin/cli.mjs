#!/usr/bin/env node
// cookieless-insights CLI — scaffold, provision, and report.
//
//   cookieless-insights init                     Scaffold Azure templates + print wiring
//   cookieless-insights setup   [--name ..]      Print (or --run) the Azure CLI setup commands
//   cookieless-insights dashboard --app-insights-id <id>   Deploy the Portal dashboard (needs az)
//   cookieless-insights report  [--days N] [--open]        Pull engagement to the terminal (needs az)
//
// Everything that talks to Azure shells out to the Azure CLI (`az login` first).

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { parseArgs } from 'node:util';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = resolve(HERE, '..');

const DEFAULTS = {
  name: 'cookieless-insights',
  location: 'westeurope',
  resourceGroup: '',
  appInsights: '',
  dashboard: '',
  days: '30',
};

const QUERIES = [
  ['Overview (page views, sessions, events)',
    "union pageViews, customEvents | summarize PageViews=countif(itemType=='pageView'), Events=countif(itemType=='customEvent'), Sessions=dcount(session_Id), Countries=dcount(client_CountryOrRegion)"],
  ['Engagement per visit (events/session, dwell seconds)',
    "union pageViews, customEvents | summarize events=count(), start=min(timestamp), stop=max(timestamp) by session_Id | extend dwellSec=datetime_diff('second', stop, start) | summarize Sessions=count(), MedianEventsPerSession=percentile(events,50), MedianDwellSec=percentile(dwellSec,50), AvgDwellSec=round(avg(dwellSec),1)"],
  ['Key events (by name)',
    'customEvents | summarize Events=count(), Sessions=dcount(session_Id) by Event=name | sort by Events desc'],
  ['Top pages',
    'pageViews | summarize Views=count(), Sessions=dcount(session_Id) by Page=name | sort by Views desc | take 15'],
  ['Top countries',
    'pageViews | summarize Sessions=dcount(session_Id) by Country=client_CountryOrRegion | sort by Sessions desc | take 15'],
  ['Browser & OS',
    'pageViews | summarize Sessions=dcount(session_Id) by Browser=client_Browser, OS=client_OS | sort by Sessions desc | take 20'],
];

function az(args, { capture = true } = {}) {
  // shell:true so `az`/`az.cmd` resolves cross-platform. Our args contain no
  // double quotes (KQL uses single quotes), so wrapping each in "" is safe.
  const cmd = 'az ' + args.map((a) => `"${a}"`).join(' ');
  const res = spawnSync(cmd, { shell: true, encoding: 'utf8', stdio: capture ? 'pipe' : 'inherit' });
  if (res.status !== 0) {
    throw new Error(`az failed: ${cmd}\n${res.stderr || res.stdout || ''}`);
  }
  return (res.stdout || '').trim();
}

function openUrl(url) {
  const cmd = process.platform === 'win32' ? `start "" "${url}"`
    : process.platform === 'darwin' ? `open "${url}"`
    : `xdg-open "${url}"`;
  spawnSync(cmd, { shell: true, stdio: 'ignore' });
}

function printTable(cols, rows) {
  if (!rows.length) { console.log('  (no data yet)'); return; }
  const widths = cols.map((c, i) => Math.max(c.length, ...rows.map((r) => String(r[i] ?? '').length)));
  const line = (cells) => '  ' + cells.map((c, i) => String(c ?? '').padEnd(widths[i])).join('  ');
  console.log(line(cols));
  console.log('  ' + widths.map((w) => '-'.repeat(w)).join('  '));
  for (const r of rows) console.log(line(r));
}

// ── commands ───────────────────────────────────────────────────────────────

function cmdInit() {
  const cwd = process.cwd();
  for (const sub of ['azure', 'scripts']) {
    const src = join(PKG_ROOT, sub);
    if (existsSync(src)) {
      mkdirSync(join(cwd, sub), { recursive: true });
      cpSync(src, join(cwd, sub), { recursive: true });
    }
  }
  console.log(`Scaffolded Azure dashboard template + report script into ./azure and ./scripts

Next steps:
  1. Create Azure resources (free tier):   npx cookieless-insights setup --name my-site --location westeurope --run
  2. Wire it into your app entry (framework-agnostic):

     import { init, trackEvent } from '@webmaxru/cookieless-insights';
     init({ connectionString: import.meta.env.VITE_APPINSIGHTS_CONNECTION_STRING });
     // ...later, on any interaction:
     trackEvent('Signup Clicked', { plan: 'pro' });

  3. Provide the connection string at BUILD time (public client key):
     - Local:  put VITE_APPINSIGHTS_CONNECTION_STRING=... in .env (or your bundler's env)
     - CI:     set it as a repo variable and pass it to the build step
  4. Deploy the dashboard:   npx cookieless-insights dashboard --app-insights-id <resourceId>
  5. Pull engagement:        npx cookieless-insights report --days 30 --open

Kill switch: init({ ..., enabled: false })  disables all telemetry.`);
}

function cmdSetup(opts) {
  const name = opts.name || DEFAULTS.name;
  const loc = opts.location || DEFAULTS.location;
  const rg = opts.resourceGroup || `${name}-rg`;
  const law = `${name}-law`;
  const ai = `${name}-ai`;
  const steps = [
    ['Create resource group', ['group', 'create', '-n', rg, '-l', loc, '-o', 'table']],
    ['Create Log Analytics workspace (30-day retention = free)',
      ['monitor', 'log-analytics', 'workspace', 'create', '-g', rg, '-n', law, '-l', loc, '--retention-time', '30', '-o', 'table']],
    ['Cap daily ingestion at 0.16 GB (stays under the 5 GB/month free grant)',
      ['monitor', 'log-analytics', 'workspace', 'update', '-g', rg, '--workspace-name', law, '--quota', '0.16', '-o', 'table']],
  ];

  if (!opts.run) {
    console.log('# Run these (or re-run with --run). Ensure `az login` first.\n');
    for (const [desc, args] of steps) console.log(`# ${desc}\naz ${args.join(' ')}\n`);
    console.log(`# Create workspace-based Application Insights
WSID=$(az monitor log-analytics workspace show -g ${rg} -n ${law} --query id -o tsv)
az monitor app-insights component create --app ${ai} -g ${rg} -l ${loc} --workspace $WSID --kind web --application-type web
# Get the connection string (public client key):
az monitor app-insights component show --app ${ai} -g ${rg} --query connectionString -o tsv`);
    return;
  }

  for (const [desc, args] of steps) { console.log(`==> ${desc}`); az(args, { capture: false }); }
  console.log('==> Create workspace-based Application Insights');
  const wsid = az(['monitor', 'log-analytics', 'workspace', 'show', '-g', rg, '-n', law, '--query', 'id', '-o', 'tsv']);
  az(['monitor', 'app-insights', 'component', 'create', '--app', ai, '-g', rg, '-l', loc, '--workspace', wsid, '--kind', 'web', '--application-type', 'web', '-o', 'table'], { capture: false });
  const cs = az(['monitor', 'app-insights', 'component', 'show', '--app', ai, '-g', rg, '--query', 'connectionString', '-o', 'tsv']);
  console.log(`\nConnection string (set as VITE_APPINSIGHTS_CONNECTION_STRING at build time):\n${cs}`);
}

function cmdDashboard(opts) {
  const id = opts['app-insights-id'];
  if (!id) throw new Error('--app-insights-id <resourceId> is required');
  const rg = opts.resourceGroup || id.split('/resourceGroups/')[1]?.split('/')[0];
  if (!rg) throw new Error('--resource-group is required (could not derive it from the id)');
  const template = join(PKG_ROOT, 'azure', 'dashboard.json');
  console.log(`Deploying dashboard to resource group ${rg} ...`);
  az(['deployment', 'group', 'create', '-g', rg, '--name', 'cookieless-insights-dashboard',
    '--template-file', template, '--parameters', `appInsightsId=${id}`, '-o', 'table'], { capture: false });
}

function resolveAppId(opts) {
  if (opts.app) return opts.app;
  if (opts['app-insights'] && opts.resourceGroup) {
    return az(['monitor', 'app-insights', 'component', 'show', '--app', opts['app-insights'], '-g', opts.resourceGroup, '--query', 'appId', '-o', 'tsv']);
  }
  throw new Error('Provide --app <appId>, or --app-insights <name> --resource-group <rg>.');
}

function cmdReport(opts) {
  const appId = resolveAppId(opts);
  const days = opts.days || DEFAULTS.days;
  console.log(`\ncookieless-insights - engagement (last ${days} days)\n`);
  for (const [title, query] of QUERIES) {
    console.log(`== ${title} ==`);
    try {
      const out = az(['monitor', 'app-insights', 'query', '--app', appId, '--analytics-query', query, '--offset', `${days}d`, '-o', 'json']);
      const table = JSON.parse(out).tables?.[0];
      printTable((table?.columns || []).map((c) => c.name), table?.rows || []);
    } catch (e) {
      console.log(`  query failed: ${e.message.split('\n')[0]}`);
    }
    console.log('');
  }
  if (opts.open) {
    const sub = az(['account', 'show', '--query', 'id', '-o', 'tsv']);
    const tenant = az(['account', 'show', '--query', 'tenantId', '-o', 'tsv']);
    const rg = opts.resourceGroup;
    const name = opts.dashboard || 'cookieless-insights-dashboard';
    if (rg) {
      const dashId = `/subscriptions/${sub}/resourceGroups/${rg}/providers/Microsoft.Portal/dashboards/${name}`;
      const url = `https://portal.azure.com/#@${tenant}/dashboard/arm${dashId}`;
      console.log(`Opening dashboard: ${url}`);
      openUrl(url);
    } else {
      console.log('Pass --resource-group (and optionally --dashboard <name>) to open the dashboard.');
    }
  }
}

function help() {
  console.log(`cookieless-insights <command>

  init                                  Scaffold Azure templates into ./azure + ./scripts and print wiring
  setup [--name n --location l] [--run] Print (or run) the Azure CLI commands to create free-tier resources
  dashboard --app-insights-id <id>      Deploy the Azure Portal engagement dashboard (requires az)
  report [--days N] [--open]            Pull engagement metrics to the terminal (requires az)
                                        Identify the resource with --app <appId> OR
                                        --app-insights <name> --resource-group <rg>

Docs: https://github.com/webmaxru/cookieless-insights`);
}

// ── entry ────────────────────────────────────────────────────────────────

const [, , command] = process.argv;
const { values } = parseArgs({
  args: process.argv.slice(3),
  allowPositionals: false,
  options: {
    name: { type: 'string' }, location: { type: 'string' },
    'resource-group': { type: 'string' }, 'app-insights': { type: 'string' },
    'app-insights-id': { type: 'string' }, app: { type: 'string' },
    dashboard: { type: 'string' }, days: { type: 'string' },
    run: { type: 'boolean' }, open: { type: 'boolean' },
  },
});
const opts = { ...values, resourceGroup: values['resource-group'] };

try {
  switch (command) {
    case 'init': cmdInit(); break;
    case 'setup': cmdSetup(opts); break;
    case 'dashboard': cmdDashboard(opts); break;
    case 'report': cmdReport(opts); break;
    case undefined: case 'help': case '--help': case '-h': help(); break;
    default: console.error(`Unknown command: ${command}\n`); help(); process.exit(1);
  }
} catch (e) {
  console.error(`Error: ${e.message}`);
  process.exit(1);
}
