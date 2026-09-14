'use client';

import { useState } from 'react';
import { GitBranch, GitCommitHorizontal, GitFork, Clock3, ArrowUpRight, Plus, ShieldCheck, FolderGit2, Laptop, FileCode2, History, ArrowRight, Settings2, X } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';

const metrics = [
  { label: 'Repositories', value: '0', icon: FolderGit2 },
  { label: 'Daily schedules', value: '0', icon: Clock3 },
  { label: 'Commits created', value: '0', icon: GitCommitHorizontal },
  { label: 'Files saved', value: '0', icon: FileCode2 },
];

export default function Dashboard({ account }: { account: string | null }) {
  const [connect, setConnect] = useState(false);
  const [tab, setTab] = useState('repos');
  const [notice, setNotice] = useState(true);

  return (
    <div className="shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Commitkeep home"><span className="brandmark"><GitBranch size={21} strokeWidth={1.7} /></span>commitkeep</a>
        <div className="account"><span className="avatar">{account ? account.slice(0, 1).toUpperCase() : 'Y'}</span><span>{account ?? 'Your workspace'}</span></div>
      </header>

      <main>
        <section className="heading">
          <div><div className="eyebrow">PERSONAL WORKSPACE</div><h1>Overview<span className="heading-period">.</span></h1><p>Your repositories, schedules, and saved work.</p></div>
          <button className="primary" onClick={() => setConnect(true)}><Plus size={17} />Connect GitHub</button>
        </section>

        {notice && <div className="preview-notice"><span className="preview-tag">UI PREVIEW</span><p>Explore the interface. GitHub connections and automation arrive in stage 2.</p><button className="icon-button" aria-label="Dismiss preview notice" onClick={() => setNotice(false)}><X size={16} /></button></div>}

        <section className="metrics" aria-label="Workspace summary">
          {metrics.map(({ label, value, icon: Icon }) => <article key={label}><div><Icon size={16} strokeWidth={1.5} /><span>{label}</span></div><strong>{value}</strong></article>)}
        </section>

        <Tabs value={tab} onValueChange={setTab}>
          <div className="tabbar">
            <TabsList variant="line" aria-label="Workspace views">
              <TabsTrigger value="repos"><FolderGit2 />Repositories</TabsTrigger>
              <TabsTrigger value="history"><History />History</TabsTrigger>
              <TabsTrigger value="work"><Laptop />Saved work</TabsTrigger>
            </TabsList>
            <span className="private-label"><ShieldCheck size={14} />Only you can see this workspace</span>
          </div>

          <div className="view-stack">
            <TabsContent value="repos" forceMount className="workspace-view" inert={tab !== 'repos'} aria-hidden={tab !== 'repos'}>
              <section className="workspace-grid">
                <div className="panel empty">
                  <div className="repo-icon"><FolderGit2 size={29} strokeWidth={1.25} /><span><Plus size={12} /></span></div>
                  <h2>A home for your repositories</h2>
                  <p>Connect GitHub to choose a repository<br className="desktop-break" /> and set up your first daily update.</p>
                  <button className="primary" onClick={() => setConnect(true)}>Connect a repository<ArrowRight size={16} /></button>
                  <span className="empty-note"><ShieldCheck size={13} />Access only to the repositories you choose</span>
                </div>
                <aside className="guide">
                  <div className="guide-heading"><span className="eyebrow">GETTING STARTED</span><span className="guide-count">01 — 03</span></div>
                  <div className="guide-step"><span className="step-number">01</span><div><h3>Connect a repository</h3><p>Choose where your work lives.</p></div></div>
                  <div className="guide-step"><span className="step-number">02</span><div><h3>Choose what happens daily</h3><p>Update content, save pending work, or both.</p></div></div>
                  <div className="guide-step"><span className="step-number">03</span><div><h3>Keep track of every change</h3><p>See what changed, why, and the resulting commit.</p></div></div>
                  <button className="text-button" onClick={() => setTab('history')}>Explore change history<ArrowUpRight size={15} /></button>
                </aside>
              </section>
            </TabsContent>

            <TabsContent value="history" forceMount className="workspace-view" inert={tab !== 'history'} aria-hidden={tab !== 'history'}>
              <section className="panel empty history-empty"><div className="repo-icon"><History size={29} strokeWidth={1.25} /></div><h2>Every change, in one place</h2><p>When your first automation runs, you’ll see its changed files, commit link, and outcome here.</p><div className="history-legend"><span>Automatic updates</span><span>Saved work</span><span>Skipped runs</span></div><button className="text-button" onClick={() => setTab('repos')}>Back to repositories<ArrowRight size={15} /></button></section>
            </TabsContent>

            <TabsContent value="work" forceMount className="workspace-view" inert={tab !== 'work'} aria-hidden={tab !== 'work'}>
              <section className="panel empty"><div className="repo-icon"><Laptop size={29} strokeWidth={1.25} /></div><h2>Pick up where you left off</h2><p>Your pending edits will live here before they become commits. Connect a repository to get started.</p><button className="primary" onClick={() => setConnect(true)}>Connect a repository<ArrowRight size={16} /></button><span className="empty-note">Local files will need a connected desktop companion.</span></section>
            </TabsContent>
          </div>
        </Tabs>

        <footer><span><GitCommitHorizontal size={15} />Nothing committed yet.</span><span>Commitkeep<span className="footer-divider">/</span>Stage 1 · UI & UX</span></footer>
      </main>

      <Dialog open={connect} onOpenChange={setConnect}>
        <DialogContent className="connect-dialog"><span className="dialog-icon"><GitFork size={24} strokeWidth={1.5} /></span><DialogTitle>Connect GitHub</DialogTitle><DialogDescription>Choose which repositories Commitkeep can access.</DialogDescription><div className="connection-note"><Settings2 size={19} /><div><h3>Available in stage 2</h3><p>This is the interface preview. GitHub authorization and repository selection will be connected next.</p></div></div><button className="primary" onClick={() => setConnect(false)}>Got it<ArrowRight size={16} /></button><p className="dialog-footnote">No repositories have been accessed or changed.</p></DialogContent>
      </Dialog>
    </div>
  );
}

