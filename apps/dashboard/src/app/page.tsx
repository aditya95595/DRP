'use client';

import { useEffect, useMemo, useState } from 'react';

const nav = [
  ['Overview', 'overview'],
  ['Roleplay', 'roleplay'],
  ['Departments', 'departments'],
  ['Records', 'records'],
  ['Announcements', 'announcements'],
  ['Statistics', 'statistics'],
  ['Leaderboards', 'leaderboards'],
  ['Configuration', 'configuration'],
  ['Bot', 'bot'],
] as const;

const automationLabels = [
  ['lowPlayerEnabled', 'Low player count', 'Publish a configured alert when the RP server drops below the threshold.'],
  ['fullServerEnabled', 'Server full', 'Announce capacity reached.'],
  ['noStaffEnabled', 'No staff online', 'Alert when an active session has no staff presence.'],
  ['staffPresenceEnabled', 'Staff presence', 'Announce staff presence lost/restored transitions.'],
  ['startupEnabled', 'Server startup', 'Publish the rich startup embed.'],
] as const;

const defaultConfig = {
  guildName: 'District Roleplay',
  serverName: 'District Roleplay',
  serverCode: '',
  serverCapacity: 50,
  joinUrl: '',
  staffRoleIds: [],
  announcementChannelId: '',
  logChannelId: '',
  presence: { status: 'online', activityType: 'playing', activityText: 'Emergency Hamburg RP', streamUrl: '', rotationEnabled: false, rotationSeconds: 30 },
  automation: { lowPlayerEnabled: true, lowPlayerThreshold: 8, lowPlayerCooldownMinutes: 15, noStaffEnabled: true, noStaffDelayMinutes: 5, fullServerEnabled: true, startupEnabled: true, staffPresenceEnabled: true },
  embeds: {
    startup: { enabled: true, title: '🟢 SERVER STARTUP', description: '**{serverName}** is now online.\n\nServer Owner: **{owner}**\nServer Code: **{serverCode}**\nStarted By: **{startedBy}**\nPlayers: **{players} / {capacity}**', color: '#35C759', footer: 'DRP • Server Status', joinButtonLabel: 'JOIN SERVER ↗', joinUrl: '' },
    lowPlayers: { enabled: true, title: '🟠 LOW PLAYER COUNT', description: 'The current roleplay session has a low player count.\n\nConsider joining the server and helping bring the session to life!', color: '#FF9F0A', footer: 'DRP • Player Activity', joinButtonLabel: 'JOIN SERVER ↗', joinUrl: '' },
    serverFull: { enabled: true, title: '🔴 SERVER FULL', description: 'The current Emergency Hamburg RP server is full.', color: '#FF453A', footer: 'DRP • Server Status', joinButtonLabel: 'JOIN SERVER ↗', joinUrl: '' },
    noStaff: { enabled: true, title: '⚠️ NO STAFF ONLINE', description: 'The roleplay server is running without staff.', color: '#FFD60A', footer: 'DRP • Staff Presence', joinButtonLabel: 'JOIN SERVER ↗', joinUrl: '' },
    staffRestored: { enabled: true, title: '🟢 STAFF PRESENCE RESTORED', description: 'Staff presence has been restored.', color: '#30D158', footer: 'DRP • Staff Presence', joinButtonLabel: 'JOIN SERVER ↗', joinUrl: '' },
    staffLost: { enabled: true, title: '⚠️ STAFF PRESENCE LOST', description: 'No configured staff are currently present.', color: '#FF9F0A', footer: 'DRP • Staff Presence', joinButtonLabel: 'JOIN SERVER ↗', joinUrl: '' },
    sessionStart: { enabled: true, title: '🎮 ROLEPLAY SESSION STARTED', description: 'A new roleplay session is now active.', color: '#5865F2', footer: 'DRP • Sessions', joinButtonLabel: 'JOIN SERVER ↗', joinUrl: '' },
    sessionEnd: { enabled: true, title: '🏁 ROLEPLAY SESSION ENDED', description: 'The active roleplay session has ended.', color: '#8E8E93', footer: 'DRP • Sessions', joinButtonLabel: 'JOIN SERVER ↗', joinUrl: '' },
    operationStart: { enabled: true, title: '🚨 OPERATION STARTED', description: 'A new roleplay operation has started.', color: '#AF52DE', footer: 'DRP • Operations', joinButtonLabel: 'VIEW ROSTER', joinUrl: '' },
    operationEnd: { enabled: true, title: '✅ OPERATION COMPLETED', description: 'The roleplay operation has ended.', color: '#32D74B', footer: 'DRP • Operations', joinButtonLabel: 'VIEW REPORT', joinUrl: '' },
  },
};

type DashboardData = any;

type Guild = { id: string; name: string; icon?: string | null; owner: boolean; permissions: string };

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)); }

export default function Dashboard() {
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [guildId, setGuildId] = useState('');
  const [data, setData] = useState<DashboardData | null>(null);
  const [config, setConfig] = useState(clone(defaultConfig));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [query, setQuery] = useState('');
  const [commands, setCommands] = useState<any[]>([]);
  const [category, setCategory] = useState('all');
  const [openCommand, setOpenCommand] = useState<any | null>(null);

  useEffect(() => {
    fetch('/api/guilds').then((r) => r.json()).then((value) => setGuilds(value.guilds || [])).catch(() => undefined);
    fetch('/api/commands').then((r) => r.json()).then((value) => setCommands(value.commands || [])).catch(() => undefined);
  }, []);

  useEffect(() => {
    const id = guildId || guilds[0]?.id;
    if (!guildId && id) setGuildId(id);
    if (!id) return;
    setLoading(true);
    fetch(`/api/dashboard?guildId=${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((value) => { setData(value); if (value.config) setConfig(value.config); })
      .catch(() => setToast('Could not load live dashboard data.'))
      .finally(() => setLoading(false));
  }, [guildId, guilds]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const metric = data?.metrics || { sessions: 0, operations: 0, records: 0, staff: 0, departments: 0 };
  const heartbeat = data?.heartbeat;
  const session = data?.activeSession;

  const save = async (restart = false) => {
    if (!guildId) { setToast('Select a Discord server first.'); return; }
    setSaving(true);
    try {
      const response = await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ guildId, action: restart ? 'save-restart' : 'save', config }) });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error || 'Save failed');
      setToast(restart ? `Saved as v${value.version}. Restart queued.` : `Configuration saved as v${value.version}.`);
      load();
    } catch (error) { setToast(error instanceof Error ? error.message : 'Save failed.'); }
    finally { setSaving(false); }
  };

  const load = () => {
    if (!guildId) return;
    fetch(`/api/dashboard?guildId=${encodeURIComponent(guildId)}`).then((r) => r.json()).then((value) => { setData(value); if (value.config) setConfig(value.config); });
  };

  const setPath = (path: string, value: any) => {
    setConfig((current: any) => {
      const next = clone(current);
      const keys = path.split('.');
      let cursor = next;
      keys.slice(0, -1).forEach((key) => { cursor = cursor[key]; });
      cursor[keys[keys.length - 1]] = value;
      return next;
    });
  };

  const filteredCommands = useMemo(() => commands.filter((c) => (category === 'all' || c.category === category) && (`${c.name} ${c.description}`.toLowerCase().includes(query.toLowerCase()))), [commands, query, category]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">D</div><div><strong>DRP Control</strong><span>District Roleplay</span></div></div>
        <div className="workspace-card">
          <span>WORKSPACE</span>
          <select value={guildId} onChange={(e) => setGuildId(e.target.value)} disabled={!guilds.length}>
            {guilds.length ? guilds.map((guild) => <option key={guild.id} value={guild.id}>{guild.name}</option>) : <option value="">Connect Discord</option>}
          </select>
          {!data?.authenticated && <a href="/api/auth/signin/discord" className="connect-link">Connect Discord →</a>}
        </div>
        <nav className="nav-group">
          {nav.map(([label, id], index) => <a key={id} className={index === 0 ? 'active' : ''} href={`#${id}`}><span className="nav-icon">{['⌂','◈','♙','▤','◉','◌','♜','⚙','●'][index]}</span>{label}</a>)}
        </nav>
        <div className="sidebar-bottom">
          <div className={`status-mini ${heartbeat?.status === 'online' ? 'online' : ''}`}><span className="pulse" /> {heartbeat?.status === 'online' ? 'Bot online' : 'Bot offline'}</div>
          <a href="/api/auth/signout" className="ghost-link">Sign out</a>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div><div className="crumb">{data?.guild?.name || 'District Roleplay'} <span>•</span> Control Center</div><h1>Everything your RP community needs.</h1><p>Run sessions, manage departments, track records and control your Discord bot from one place.</p></div>
          <div className="top-actions"><button className="icon-button" onClick={load} aria-label="Refresh">↻</button><button className="secondary-button" onClick={() => save(false)} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button><button className="primary-button" onClick={() => save(true)} disabled={saving}>{saving ? 'Working…' : 'Save & Restart'}</button></div>
        </header>

        {!data?.authenticated && <div className="notice"><div><strong>Preview mode</strong><span>Connect Discord to manage a real server. Saved configuration requires Manage Server access.</span></div><a href="/api/auth/signin/discord">Continue with Discord</a></div>}
        {data?.authenticated && !data.authorized && <div className="notice danger"><div><strong>Access required</strong><span>This Discord account is not authorized to manage the selected server.</span></div><a href="/api/auth/signin/discord">Switch account</a></div>}

        <section className="stat-grid" id="overview">
          <Metric title="Members" value={data?.guild ? 'Live' : '—'} detail={data?.guild?.name || 'Connect a server'} icon="♙" />
          <Metric title="RP sessions" value={metric.sessions} detail="Recorded sessions" icon="◈" />
          <Metric title="Departments" value={metric.departments} detail="Enabled departments" icon="♜" />
          <Metric title="Bot latency" value={heartbeat?.latencyMs != null ? `${heartbeat.latencyMs}ms` : '—'} detail={heartbeat?.status === 'online' ? 'Gateway healthy' : 'Waiting for heartbeat'} icon="◉" />
        </section>

        <section className="content-grid two-column" id="roleplay">
          <Panel title="Active roleplay session" eyebrow="LIVE">
            <div className="hero-row"><div><div className="hero-title">{session?.serverName || 'No active session'}</div><div className="hero-sub">{session ? `Started ${new Date(session.startedAt).toLocaleString()}` : 'Start a session with /session-start or from the bot.'}</div></div><span className={`pill ${session ? 'green' : ''}`}>{session ? 'ACTIVE' : 'OFFLINE'}</span></div>
            <div className="mini-stats"><MiniStat label="Players" value={session ? `${session.currentPlayers}/${session.capacity}` : '—'} /><MiniStat label="Peak" value={session?.peakPlayers ?? '—'} /><MiniStat label="Server code" value={session?.serverCode || config.serverCode || '—'} /><MiniStat label="Staff" value={session ? 'Tracked' : '—'} /></div>
            <div className="button-row"><a className="secondary-button" href="#announcements">Announcement Center</a><a className="secondary-button" href="#statistics">Open analytics</a></div>
          </Panel>
          <Panel title="Bot health & controls" eyebrow="OPERATIONS" id="bot">
            <HealthRow label="Gateway" value={heartbeat?.status || 'offline'} live={heartbeat?.status === 'online'} />
            <HealthRow label="Database" value="PostgreSQL" live={true} />
            <HealthRow label="Heartbeat" value={heartbeat?.lastSeen ? new Date(heartbeat.lastSeen).toLocaleTimeString() : '—'} live={Boolean(heartbeat)} />
            <HealthRow label="Config version" value={`v${data?.guild?.configVersion || 1}`} live={true} />
            <div className="button-row"><button className="primary-button" onClick={() => save(true)} disabled={saving}>Save & Restart</button><button className="secondary-button" onClick={() => setToast('Maintenance request is sent through the shared control queue.')} >Maintenance</button></div>
          </Panel>
        </section>

        <section className="content-grid two-column" id="announcements">
          <Panel title="Automation center" eyebrow="AUTOMATIONS">
            <div className="setting-list">
              {automationLabels.map(([key, title, desc]) => <div className="setting-row" key={key}><div><strong>{title}</strong><span>{desc}</span></div><button className={`toggle ${config.automation[key] ? 'on' : ''}`} onClick={() => setPath(`automation.${key}`, !config.automation[key])}><span /></button></div>)}
            </div>
            <div className="inline-settings"><Field label="Low player threshold" value={config.automation.lowPlayerThreshold} type="number" onChange={(v) => setPath('automation.lowPlayerThreshold', Number(v))} /><Field label="Cooldown (min)" value={config.automation.lowPlayerCooldownMinutes} type="number" onChange={(v) => setPath('automation.lowPlayerCooldownMinutes', Number(v))} /><Field label="No staff delay (min)" value={config.automation.noStaffDelayMinutes} type="number" onChange={(v) => setPath('automation.noStaffDelayMinutes', Number(v))} /></div>
          </Panel>
          <Panel title="Live embed preview" eyebrow="DISCORD">
            <EmbedPreview config={config.embeds.startup} values={{ serverName: config.serverName, owner: data?.guild?.name || 'Server Owner', serverCode: config.serverCode || 'TEAT', startedBy: 'you', players: session?.currentPlayers ?? 4, capacity: config.serverCapacity }} />
            <div className="button-row"><a className="secondary-button" href="#configuration">Edit templates</a><button className="secondary-button" onClick={() => setToast('Preview uses your current unsaved configuration.')}>Preview</button></div>
          </Panel>
        </section>

        <section className="section-block" id="departments"><SectionHeader title="Departments & duty" description="Fully database-driven roles, ranks and on-duty tracking." action="Configure departments" />
          <div className="cards-3"><FeatureCard icon="👮" title="Departments" text="Create Police, Fire, EMS, Mechanic, Civilian or your own custom departments." /><FeatureCard icon="🏷" title="Ranks" text="Assign configurable ranks to every department without hard-coding your hierarchy." /><FeatureCard icon="🟢" title="Duty" text="Track on-duty status, participation and staff presence for active sessions." /></div>
        </section>

        <section className="section-block" id="records"><SectionHeader title="Records" description="Separate in-game RP records from Discord server records." action="Open record center" /><div className="stat-grid compact"><Metric title="In-game records" value={metric.records} detail="Ban, kick & warning records" icon="▤" /><Metric title="Discord records" value={metric.records} detail="Separate record scope" icon="◫" /><Metric title="Operations" value={metric.operations} detail="RP operation history" icon="🚨" /><Metric title="Staff profiles" value={metric.staff} detail="Tracked community staff" icon="♙" /></div></section>

        <section className="section-block" id="statistics"><SectionHeader title="Statistics" description="Track sessions, peak players, operations and staff participation." action="View full analytics" /><div className="analytics-grid"><div className="chart-card"><div className="chart-title"><strong>RP activity</strong><span>Last 30 days</span></div><div className="bars">{[18,34,27,49,41,63,51,73,62,80,68,91].map((v, i) => <div className="bar" style={{ height: `${v}%` }} key={i}><span /></div>)}</div><div className="chart-axis"><span>Week 1</span><span>Week 2</span><span>Week 3</span><span>Week 4</span></div></div><div className="list-card"><div className="chart-title"><strong>Recent activity</strong><span>{data?.recentActivity?.length || 0} events</span></div>{(data?.recentActivity || []).slice(0, 6).map((item: any) => <div className="activity-row" key={item.id}><span className="activity-dot" /><div><strong>{String(item.action).replaceAll('_', ' ')}</strong><span>{item.target || 'Community configuration'}</span></div><time>{new Date(item.createdAt).toLocaleTimeString()}</time></div>)}{!data?.recentActivity?.length && <div className="empty">Activity will appear here once the bot and dashboard start writing audit events.</div>}</div></div></section>

        <section className="section-block" id="leaderboards"><SectionHeader title="Leaderboards" description="Participation-oriented rankings for staff, departments and operations." /><div className="cards-3"><FeatureCard icon="🏆" title="Most active staff" text="Rank by duty time, session attendance and operation participation." /><FeatureCard icon="📈" title="Department activity" text="Compare participation across your configurable departments." /><FeatureCard icon="🚨" title="Operation participation" text="See who consistently joins RP operations and events." /></div></section>

        <section className="section-block" id="configuration"><SectionHeader title="Configuration" description="Save versioned configuration to PostgreSQL. The bot applies it on restart." action={<> <button className="secondary-button" onClick={() => setConfig(clone(defaultConfig))}>Reset editor</button> <button className="primary-button" onClick={() => save(true)}>Save & Restart</button></>} />
          <div className="config-grid"><Panel title="Server settings" eyebrow="CORE"><Field label="Community name" value={config.guildName} onChange={(v) => setPath('guildName', v)} /><Field label="RP server name" value={config.serverName} onChange={(v) => setPath('serverName', v)} /><Field label="Server code" value={config.serverCode} onChange={(v) => setPath('serverCode', v)} /><Field label="Capacity" type="number" value={config.serverCapacity} onChange={(v) => setPath('serverCapacity', Number(v))} /><Field label="Join URL" value={config.joinUrl} onChange={(v) => setPath('joinUrl', v)} /></Panel>
            <Panel title="Bot presence" eyebrow="BOT"><div className="select-row"><Field label="Status" value={config.presence.status} type="select" options={['online','idle','dnd','invisible']} onChange={(v) => setPath('presence.status', v)} /><Field label="Activity" value={config.presence.activityType} type="select" options={['playing','watching','listening','streaming','custom']} onChange={(v) => setPath('presence.activityType', v)} /></div><Field label="Activity text" value={config.presence.activityText} onChange={(v) => setPath('presence.activityText', v)} /><Field label="Streaming URL" value={config.presence.streamUrl} onChange={(v) => setPath('presence.streamUrl', v)} /><div className="setting-row"><div><strong>Rotate presence</strong><span>Cycle the configured activity on a timer.</span></div><button className={`toggle ${config.presence.rotationEnabled ? 'on' : ''}`} onClick={() => setPath('presence.rotationEnabled', !config.presence.rotationEnabled)}><span /></button></div></Panel>
          </div>
        </section>

        <section className="section-block"><SectionHeader title="Command center" description="Every registered slash command has a detailed searchable definition." /><div className="command-toolbar"><input placeholder="Search commands…" value={query} onChange={(e) => setQuery(e.target.value)} /> <select value={category} onChange={(e) => setCategory(e.target.value)}><option value="all">All categories</option>{['roleplay','departments','records','sessions','statistics','activity','configuration','bot','utility'].map((x) => <option key={x} value={x}>{x}</option>)}</select></div><div className="command-grid">{filteredCommands.map((command) => <button className="command-card" key={command.name} onClick={() => setOpenCommand(command)}><div><span className="command-name">/{command.name}</span><span className="command-category">{command.category}</span></div><p>{command.description}</p><span className="command-usage">{command.usage}</span></button>)}</div></section>

        <footer className="footer">DRP Control • {commands.length || 0} registered commands • Shared PostgreSQL configuration • Vercel + WispByte ready</footer>
      </main>

      {openCommand && <div className="modal-backdrop" onClick={() => setOpenCommand(null)}><div className="modal" onClick={(event) => event.stopPropagation()}><div className="modal-head"><div><div className="eyebrow">COMMAND DETAIL</div><h2>/{openCommand.name}</h2></div><button className="icon-button" onClick={() => setOpenCommand(null)}>×</button></div><p>{openCommand.description}</p><div className="modal-grid"><div><span>Category</span><strong>{openCommand.category}</strong></div><div><span>Permissions</span><strong>{openCommand.permissions?.length ? openCommand.permissions.join(', ') : 'Everyone'}</strong></div><div className="wide"><span>Usage</span><code>{openCommand.usage}</code></div><div><span>Cooldown</span><strong>{openCommand.cooldownSeconds}s</strong></div><div><span>Dashboard</span><strong>{openCommand.dashboard ? 'Enabled' : 'Disabled'}</strong></div></div></div></div>}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function Metric({ title, value, detail, icon }: { title: string; value: any; detail: string; icon: string }) { return <div className="metric-card"><div className="metric-top"><span>{title}</span><b>{icon}</b></div><div className="metric-number">{value}</div><div className="metric-detail">{detail}</div></div>; }
function MiniStat({ label, value }: { label: string; value: any }) { return <div><span>{label}</span><strong>{value}</strong></div>; }
function Panel({ title, eyebrow, children, id }: { title: string; eyebrow?: string; children: React.ReactNode; id?: string }) { return <div className="panel" id={id}><div className="panel-head"><div><div className="eyebrow">{eyebrow}</div><h2>{title}</h2></div></div>{children}</div>; }
function SectionHeader({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) { return <div className="section-header"><div><div className="eyebrow">DRP CONTROL</div><h2>{title}</h2><p>{description}</p></div>{action && <div className="section-action">{action}</div>}</div>; }
function FeatureCard({ icon, title, text }: { icon: string; title: string; text: string }) { return <div className="feature-card"><div className="feature-icon">{icon}</div><h3>{title}</h3><p>{text}</p></div>; }
function HealthRow({ label, value, live }: { label: string; value: string; live: boolean }) { return <div className="health-row"><span>{label}</span><strong><i className={live ? 'live-dot' : ''} />{value}</strong></div>; }
function Field({ label, value, onChange, type = 'text', options = [] }: { label: string; value: any; onChange: (value: string) => void; type?: string; options?: string[] }) { return <label className="field"><span>{label}</span>{type === 'select' ? <select value={value} onChange={(e) => onChange(e.target.value)}>{options.map((o) => <option value={o} key={o}>{o}</option>)}</select> : <input type={type} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />}</label>; }
function EmbedPreview({ config, values }: { config: any; values: Record<string, any> }) { const render = (text: string) => text.replace(/\{([a-zA-Z0-9_-]+)\}/g, (_, key) => String(values[key] ?? `{${key}}`)); return <div className="discord-preview"><div className="discord-author"><span className="server-avatar">D</span><div><strong>District Roleplay</strong><span>Today at 18:24</span></div></div><div className="discord-embed" style={{ borderLeftColor: config.color }}><strong>{render(config.title)}</strong><p>{render(config.description)}</p><div className="embed-footer">{config.footer}</div></div><button className="discord-button">{config.joinButtonLabel}</button></div>; }
