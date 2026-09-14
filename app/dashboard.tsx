'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, ArrowUpRight, Check, Clock3, FileCode2, FolderGit2, GitBranch, GitCommitHorizontal, GitFork, History, Laptop, LoaderCircle, Plus, ShieldCheck } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

type Workspace = {
  github: { connected: boolean; installations: { installationId: string; accountLogin: string; status: string }[] };
  repositories: { id: string; fullName: string; defaultBranch: string; enabled: boolean }[];
  schedules: { id: string; repositoryId: string; localTime: string; timezone: string; enabled: boolean }[];
  runs: { id: string; source: string; outcome: string; summary: string; commitUrl: string | null; createdAt: string }[];
};

const emptyWorkspace: Workspace = { github: { connected: false, installations: [] }, repositories: [], schedules: [], runs: [] };

export default function Dashboard({ account }: { account: string | null }) {
  const router = useRouter();
  const [workspace, setWorkspace] = useState<Workspace>(emptyWorkspace);
  const [loading, setLoading] = useState(Boolean(account));
  const [connect, setConnect] = useState(false);
  const [step, setStep] = useState(1);
  const [tab, setTab] = useState('repos');
  const [connectionError, setConnectionError] = useState('');

  useEffect(() => {
    if (!account) return;
    let active = true;
    fetch('/api/workspace', { headers: { Accept: 'application/json' } })
      .then(async (response) => {
        if (!response.ok) throw new Error((await response.json()).error ?? 'Workspace could not be loaded.');
        return response.json() as Promise<Workspace>;
      })
      .then((data) => { if (active) setWorkspace(data); })
      .catch((error: Error) => { if (active) setConnectionError(error.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [account]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('github') === 'connected') {
      queueMicrotask(() => {
        setConnect(true);
        setStep(2);
      });
    }
  }, []);

  const metrics = useMemo(() => [
    { label: 'Repositories', value: workspace.repositories.length, icon: FolderGit2 },
    { label: 'Daily schedules', value: workspace.schedules.filter((item) => item.enabled).length, icon: Clock3 },
    { label: 'Commits created', value: workspace.runs.filter((item) => item.outcome === 'committed').length, icon: GitCommitHorizontal },
    { label: 'Files saved', value: workspace.runs.filter((item) => item.source === 'saved_work').length, icon: FileCode2 },
  ], [workspace]);

  async function connectGitHub() {
    setConnectionError('');
    const response = await fetch('/api/github/connect', { redirect: 'manual' });
    if (response.type === 'opaqueredirect' || response.status === 302) {
      router.push('/api/github/connect');
      return;
    }
    const result = await response.json().catch(() => ({ error: 'GitHub connection could not start.' }));
    setConnectionError(result.error);
  }

  return (
    <div className="shell">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="CommitKeep home"><span className="brandmark"><GitBranch size={21} strokeWidth={1.7} /></span>commitkeep</Link>
        <div className="account"><span className="avatar">{account?.slice(0, 1).toUpperCase() ?? 'Y'}</span><span>{account ?? 'Your workspace'}</span></div>
      </header>

      <main>
        <section className="heading">
          <div><div className="eyebrow">PERSONAL WORKSPACE</div><h1>Overview<span className="heading-period">.</span></h1><p>Your repositories, schedules, and saved work.</p></div>
          <button className="primary" onClick={() => setConnect(true)}><Plus size={17} />Set up automation</button>
        </section>

        <div className="stage-notice">
          <span className="status-dot" />
          <p><strong>Stage 2 is underway.</strong> Account-owned history and the secure GitHub App connection are ready for configuration.</p>
          <span className="stage-label">APPLICATION</span>
        </div>

        <section className="metrics" aria-label="Workspace summary">
          {metrics.map(({ label, value, icon: Icon }) => <article key={label}><div><Icon size={16} strokeWidth={1.5} /><span>{label}</span></div><strong>{loading ? '—' : value}</strong></article>)}
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
                  <div className="repo-icon">{loading ? <LoaderCircle className="spin" size={27} /> : <FolderGit2 size={29} strokeWidth={1.25} />}</div>
                  <h2>{workspace.github.connected ? 'Choose your first repository' : 'Connect your work'}</h2>
                  <p>{workspace.github.connected ? `GitHub account @${workspace.github.installations[0]?.accountLogin} is connected. Repository selection is the next step.` : 'Install CommitKeep only on the repositories you want it to manage.'}</p>
                  <button className="primary" onClick={() => { setConnect(true); setStep(workspace.github.connected ? 2 : 1); }}>
                    {workspace.github.connected ? 'Select repositories' : 'Connect GitHub'}<ArrowRight size={16} />
                  </button>
                  <span className="empty-note"><ShieldCheck size={13} />Access stays limited to your selection</span>
                </div>
                <aside className="guide">
                  <div className="guide-heading"><span className="eyebrow">SETUP PROGRESS</span><span className="guide-count">01 — 03</span></div>
                  {[
                    ['01', 'Connect GitHub', workspace.github.connected ? 'Connected' : 'Install the GitHub App.'],
                    ['02', 'Select repositories', workspace.repositories.length ? `${workspace.repositories.length} selected` : 'Choose where CommitKeep can work.'],
                    ['03', 'Choose a daily action', workspace.schedules.length ? 'Schedule created' : 'Set the action, time, and timezone.'],
                  ].map(([number, title, note], index) => (
                    <div className="guide-step" key={number}><span className="step-number">{number}</span><div><h3>{title}{index < step - 1 && <Check size={13} />}</h3><p>{note}</p></div></div>
                  ))}
                  <button className="text-button" onClick={() => setConnect(true)}>Continue setup<ArrowUpRight size={15} /></button>
                </aside>
              </section>
            </TabsContent>

            <TabsContent value="history" forceMount className="workspace-view" inert={tab !== 'history'} aria-hidden={tab !== 'history'}>
              <section className="panel empty history-empty">
                <div className="repo-icon"><History size={29} strokeWidth={1.25} /></div>
                <h2>{workspace.runs.length ? 'Your change history' : 'Every change, in one place'}</h2>
                <p>{workspace.runs.length ? 'Automatic updates, saved work, skipped runs, and failures are recorded under your account.' : 'The first completed or skipped run will appear here with its reason and commit link.'}</p>
                <div className="history-legend"><span>Automatic updates</span><span>Saved work</span><span>Skipped runs</span></div>
              </section>
            </TabsContent>

            <TabsContent value="work" forceMount className="workspace-view" inert={tab !== 'work'} aria-hidden={tab !== 'work'}>
              <section className="panel empty"><div className="repo-icon"><Laptop size={29} strokeWidth={1.25} /></div><h2>Pick up where you left off</h2><p>Web drafts will be saved here. Local folders will connect through the desktop companion in a later Stage 2 increment.</p><button className="primary" onClick={() => setConnect(true)}>Start setup<ArrowRight size={16} /></button></section>
            </TabsContent>
          </div>
        </Tabs>

        <footer><span><GitCommitHorizontal size={15} />{workspace.runs.length ? `${workspace.runs.length} recorded runs` : 'Nothing committed yet.'}</span><span>CommitKeep<span className="footer-divider">/</span>Stage 2 · Application</span></footer>
      </main>

      <Dialog open={connect} onOpenChange={setConnect}>
        <DialogContent className="connect-dialog setup-dialog">
          <div className="setup-progress" aria-label={`Setup step ${step} of 3`}>
            {[1, 2, 3].map((item) => <span key={item} className={item <= step ? 'active' : ''} />)}
          </div>
          <span className="dialog-icon">{step === 1 ? <GitFork size={24} /> : step === 2 ? <FolderGit2 size={24} /> : <Clock3 size={24} />}</span>
          <span className="eyebrow">STEP {step} OF 3</span>
          <DialogTitle>{step === 1 ? 'Connect GitHub' : step === 2 ? 'Select repositories' : 'Set the daily action'}</DialogTitle>
          <DialogDescription>
            {step === 1 && 'Install the CommitKeep GitHub App and choose exactly which repositories it may access.'}
            {step === 2 && 'Your approved repositories will appear here after GitHub is connected.'}
            {step === 3 && 'Choose what CommitKeep should update and when it should run.'}
          </DialogDescription>

          {step === 1 && <div className="connection-note"><ShieldCheck size={19} /><div><h3>Least-privilege access</h3><p>CommitKeep stores the installation ID. Temporary GitHub credentials are created only when a job runs.</p></div></div>}
          {step === 2 && <div className="setup-field"><label>Repository</label><button className="repository-picker" disabled={!workspace.github.connected}><FolderGit2 size={17} />{workspace.github.connected ? 'Repository sync arrives in the next increment' : 'Connect GitHub first'}</button></div>}
          {step === 3 && <div className="setup-fields"><label>Daily action<select defaultValue="both"><option value="both">Update content and save work</option><option value="update">Update content</option><option value="save">Save pending work</option></select></label><label>Run time<input type="time" defaultValue="09:00" /></label><label>Timezone<input value={Intl.DateTimeFormat().resolvedOptions().timeZone} readOnly /></label></div>}

          {connectionError && <p className="form-error" role="alert">{connectionError}</p>}
          <div className="dialog-actions">
            {step > 1 && <button className="secondary-button" onClick={() => setStep(step - 1)}>Back</button>}
            {step === 1 ? <button className="primary" onClick={connectGitHub}>{workspace.github.connected ? 'Connected' : 'Continue with GitHub'}<ArrowRight size={16} /></button> :
             step < 3 ? <button className="primary" disabled={!workspace.github.connected} onClick={() => setStep(step + 1)}>Continue<ArrowRight size={16} /></button> :
             <button className="primary" disabled>Create schedule<ArrowRight size={16} /></button>}
          </div>
          <p className="dialog-footnote">No repository content is changed during setup.</p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
