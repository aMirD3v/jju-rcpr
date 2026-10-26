export function WorkspaceLoading() {
  return (
    <div className="workspace-frame shell" aria-busy="true" aria-label="Loading secure workspace">
      <aside className="workspace-sidebar">
        <div className="workspace-sidebar-head">
          <div>
            <span className="workspace-sidebar-kicker">Workspace</span>
            <strong>Loading your workspace</strong>
          </div>
        </div>
      </aside>
      <main className="workspace-frame-content workspace-page">
        <p className="muted-copy">Loading secure workspace…</p>
      </main>
    </div>
  );
}
