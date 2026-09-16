const nav = [
  ['Overview', '#overview'],
  ['Roleplay', '#roleplay'],
  ['Departments', '#departments'],
  ['Records', '#records'],
  ['Announcements', '#announcements'],
  ['Statistics', '#statistics'],
  ['Leaderboards', '#leaderboards'],
  ['Configuration', '#configuration'],
  ['Bot', '#bot'],
];

export default function Dashboard() {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand"><span className="logo">D</span><span>DRP Control</span></div>
        <nav className="nav">{nav.map(([label, href], i) => <a key={href} className={i === 0 ? 'active' : ''} href={href}>{label}</a>)}</nav>
      </aside>
      <main className="main" id="overview">
        <header className="topbar">
          <div>
            <div className="eyebrow">District Roleplay</div>
            <h1>Community Control Center</h1>
            <p className="sub">One place to manage sessions, departments, records, automations and your Discord bot.</p>
          </div>
          <div className="status"><span className="dot" /> Bot operational</div>
        </header>

        <section className="grid metrics">
          <div className="card"><div className="metric-label">Members</div><div className="metric-value">—</div><div className="metric-foot">Connect Discord to load live data</div></div>
          <div className="card"><div className="metric-label">Commands</div><div className="metric-value">72</div><div className="metric-foot">Central command registry</div></div>
          <div className="card"><div className="metric-label">Uptime</div><div className="metric-value">—</div><div className="metric-foot">Reported by bot heartbeat</div></div>
          <div className="card"><div className="metric-label">Database</div><div className="metric-value">Ready</div><div className="metric-foot">PostgreSQL connection health</div></div>
        </section>

        <section className="grid two" style={{marginTop: 14}}>
          <div className="card" id="roleplay">
            <h2>🎮 Active Roleplay Session</h2>
            <div className="rows">
              <div className="row"><span className="muted">Status</span><span className="badge">Not connected</span></div>
              <div className="row"><span className="muted">Server</span><span>—</span></div>
              <div className="row"><span className="muted">Players</span><span>— / configurable capacity</span></div>
              <div className="row"><span className="muted">Staff online</span><span>—</span></div>
            </div>
          </div>
          <div className="card" id="bot">
            <h2>🤖 Bot Controls</h2>
            <div className="rows">
              <div className="row"><span className="muted">Gateway</span><span className="badge">Waiting for token</span></div>
              <div className="row"><span className="muted">Presence</span><span>Configurable</span></div>
              <div className="row"><span className="muted">Maintenance</span><span>Off</span></div>
            </div>
            <button className="primary" style={{marginTop: 12}}>Save & Restart</button>
          </div>
        </section>

        <section className="grid two" style={{marginTop: 14}}>
          <div className="card" id="announcements">
            <h2>📢 Automation Center</h2>
            <div className="rows">
              {['Server Startup', 'Low Player Count', 'Server Full', 'No Staff Online', 'Staff Presence Restored'].map(x => <div className="row" key={x}><span>{x}</span><span className="badge">Configurable</span></div>)}
            </div>
          </div>
          <div className="card" id="configuration">
            <h2>⚙️ Configuration Version</h2>
            <div className="row"><span className="muted">Current</span><strong>v1</strong></div>
            <div className="row"><span className="muted">Workflow</span><span>Save → Restart → Apply</span></div>
            <div className="row"><span className="muted">Rollback</span><span>Version history enabled</span></div>
          </div>
        </section>

        <section className="card" id="departments" style={{marginTop: 14}}>
          <h2>👮 Departments & Duty</h2>
          <p className="sub">Departments, ranks, rosters and duty tracking are database-driven so your community can define its own structure.</p>
        </section>
        <section className="card" id="records" style={{marginTop: 14}}>
          <h2>📋 Records</h2>
          <div className="grid metrics"><div><span className="metric-label">In-game records</span><div className="metric-value">—</div></div><div><span className="metric-label">Discord records</span><div className="metric-value">—</div></div><div><span className="metric-label">Open sessions</span><div className="metric-value">—</div></div><div><span className="metric-label">Operations</span><div className="metric-value">—</div></div></div>
        </section>
        <section className="card" id="statistics" style={{marginTop: 14}}>
          <h2>📊 Statistics & 🏆 Activity</h2>
          <p className="sub">Session duration, peak players, staff participation, department activity and operation participation will be tracked here.</p>
        </section>
      </main>
    </div>
  );
}
