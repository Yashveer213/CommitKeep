'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, ArrowUpRight, Check, Clock3, FileCode2, FolderGit2, GitBranch, GitCommitHorizontal, GitFork, History, Laptop, LoaderCircle, LogOut, Pause, Play, Plus, Settings, ShieldCheck, Trash2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

type Workspace = {
  account?: { displayName: string; githubLogin: string | null; avatarUrl: string | null };
  github: { connected: boolean; installations: { installationId: string; accountLogin: string; status: string }[] };
  repositories: { id: string; fullName: string; defaultBranch: string; enabled: boolean; automationStatus?: 'active' | 'paused' }[];
  schedules: { id: string; repositoryId: string; rule?:'activity_report'|'activity_journal'; localTime: string; timezone: string; enabled: boolean; status?: string; version?:number; mode?:'update'; startDate?:string|null; endDate?:string|null; times?: {localTime:string;nextRunAt:string|null;status?:string}[] }[];
  runs: { id: string; source: string; outcome: string; summary: string; commitUrl: string | null; createdAt: string }[];
  drafts: { id: string; repositoryId: string; path: string; preview: string; updatedAt: string }[];
};
type AvailableRepository = { id: string; fullName: string; defaultBranch: string; private: boolean; selected: boolean };

const emptyWorkspace: Workspace = { github: { connected: false, installations: [] }, repositories: [], schedules: [], runs: [], drafts: [] };

async function readApiJson<T>(response:Response):Promise<T>{
  const contentType=response.headers.get('content-type')??'';
  if(!contentType.includes('application/json'))return {error:response.status===503?'Commit-Keep is temporarily unavailable. Please try again.':'The server returned an unexpected response.'} as T;
  return response.json() as Promise<T>;
}

export default function Dashboard({ account }: { account: {displayName:string;githubLogin:string|null;avatarUrl:string|null} | null }) {
  const router = useRouter();
  const [workspace, setWorkspace] = useState<Workspace>(emptyWorkspace);
  const [loading, setLoading] = useState(Boolean(account));
  const [connect, setConnect] = useState(false);
  const [step, setStep] = useState(1);
  const [tab, setTab] = useState('repos');
  const [connectionError, setConnectionError] = useState('');
  const [availableRepositories, setAvailableRepositories] = useState<AvailableRepository[]>([]);
  const [selectedRepositoryIds, setSelectedRepositoryIds] = useState<string[]>([]);
  const [dailyTimes, setDailyTimes] = useState(['09:00']);
  const [timezone, setTimezone] = useState('UTC');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [mode] = useState<'update'>('update');
  const [action,setAction]=useState<'activity_report'|'activity_journal'>('activity_report');
  const [journalAcknowledged,setJournalAcknowledged]=useState(false);
  const [saving, setSaving] = useState(false);
  const [draftName, setDraftName] = useState('daily-notes');
  const [draftContent, setDraftContent] = useState('');
  const [accountDialog, setAccountDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [editScheduleId, setEditScheduleId] = useState<string|null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [pauseDialog, setPauseDialog] = useState<'pause'|'resume'|null>(null);
  const [automationSelection, setAutomationSelection] = useState<string[]>([]);

  const timezoneOptions = useMemo(() => { try { return Intl.supportedValuesOf('timeZone'); } catch { return ['UTC','Asia/Kolkata','America/New_York','Europe/London']; } }, []);
  useEffect(() => { queueMicrotask(()=>{const detected=Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC'; setTimezone(detected); const parts=new Intl.DateTimeFormat('en-CA',{timeZone:detected,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()); const value=(type:string)=>parts.find(part=>part.type===type)?.value??''; setStartDate(`${value('year')}-${value('month')}-${value('day')}`);}); }, []);

  useEffect(() => {
    if (!account) return;
    let active = true;
    fetch('/api/workspace', { headers: { Accept: 'application/json' } })
      .then(async (response) => {
        if (!response.ok) throw new Error(((await response.json()) as { error?: string }).error ?? 'Workspace could not be loaded.');
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

  useEffect(() => {
    if (!connect || step !== 2 || !workspace.github.connected) return;
    fetch('/api/repositories').then(async (response) => {
      const result = await response.json() as { error?: string; repositories: AvailableRepository[] };
      if (!response.ok) throw new Error(result.error ?? 'Repositories could not be loaded.');
      return result as { repositories: AvailableRepository[] };
    }).then(({ repositories }) => {
      setAvailableRepositories(repositories);
      setSelectedRepositoryIds(repositories.filter((repo) => repo.selected).map((repo) => repo.id));
    }).catch((error: Error) => setConnectionError(error.message));
  }, [connect, step, workspace.github.connected]);

  const metrics = useMemo(() => [
    { label: 'Repositories', value: workspace.repositories.length, icon: FolderGit2 },
    { label: 'Daily schedules', value: workspace.schedules.filter((item) => item.enabled).length, icon: Clock3 },
    { label: 'Commits created', value: workspace.runs.filter((item) => item.outcome === 'committed').length, icon: GitCommitHorizontal },
    { label: 'Files saved', value: workspace.runs.filter((item) => item.source === 'saved_work').length, icon: FileCode2 },
  ], [workspace]);

  async function connectGitHub() {
    setConnectionError('');
    if (!account) { router.push('/api/auth/github/start'); return; }
    const response = await fetch('/api/github/connect', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    const result = await readApiJson<{ error?: string; redirectUrl?: string }>(response);
    if(response.ok&&result.redirectUrl){window.location.assign(result.redirectUrl);return;}
    setConnectionError(result.error ?? 'GitHub connection could not start.');
  }

  async function saveRepositories() {
    setSaving(true); setConnectionError('');
    const response = await fetch('/api/repositories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ repositoryIds: selectedRepositoryIds }) });
    const result = await readApiJson<{ error?: string; repositories: Workspace['repositories'] }>(response);
    setSaving(false);
    if (!response.ok) { setConnectionError(result.error ?? 'Repositories could not be saved.'); return; }
    setWorkspace((current) => ({ ...current, repositories: result.repositories }));
    setStep(3);
  }

  async function createSchedule() {
    const repositoryIds = editScheduleId?selectedRepositoryIds:workspace.repositories.filter((repository)=>repository.enabled).map((repository)=>repository.id);
    if (!repositoryIds.length) return;
    if(new Set(dailyTimes).size!==dailyTimes.length){setConnectionError('Choose a different time for every scheduled run.');return;}
    setSaving(true); setConnectionError('');
    const current=editScheduleId?workspace.schedules.find(item=>item.id===editScheduleId):null;
    const response = await fetch(editScheduleId?`/api/schedules/${editScheduleId}`:'/api/schedules', { method: editScheduleId?'PATCH':'POST', headers: { 'Content-Type': 'application/json', ...(editScheduleId?{}:{'Idempotency-Key': crypto.randomUUID()}) }, body: JSON.stringify(editScheduleId?{expectedVersion:current?.version,mode,times:dailyTimes,timezone,startDate,endDate:endDate||null}:{ repositoryIds, action, mode, times:dailyTimes, timezone, startDate, endDate:endDate||null, journalAcknowledged, organizationJournalEnabled:journalAcknowledged }) });
    const result = await readApiJson<{ error?: string; id?:string;version?:number;times?:string[];schedules?: {id:string;repositoryId:string;version:number;times:string[]}[] }>(response);
    setSaving(false);
    if (!response.ok) { setConnectionError(result.error ?? 'The schedule could not be created.'); return; }
    const saved=result.schedules??[{id:result.id!,repositoryId:repositoryIds[0],version:result.version!,times:result.times!}];
    setWorkspace((currentWorkspace) => ({ ...currentWorkspace, schedules: [...currentWorkspace.schedules.filter((item) => !repositoryIds.includes(item.repositoryId)), ...saved.map(item=>({id:item.id,repositoryId:item.repositoryId,rule:editScheduleId?(current?.rule??action):action,localTime:item.times[0],timezone,startDate,endDate:endDate||null,mode,version:item.version,enabled:true,status:'active',times:item.times.map(localTime=>({localTime,nextRunAt:null}))}))] }));
    setEditScheduleId(null);setConnect(false);
  }

  async function changeAutomation(action:'pause'|'resume'){
    setSaving(true);setConnectionError('');const response=await fetch(`/api/automation/${action}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({repositoryIds:automationSelection})});const result=await readApiJson<{error?:string;repositories?:{repositoryId:string;status:'active'|'paused'}[]}>(response);setSaving(false);if(!response.ok){setConnectionError(result.error??`Schedules could not be ${action}d.`);return;}setWorkspace(current=>({...current,repositories:current.repositories.map(repository=>{const changed=result.repositories?.find(item=>item.repositoryId===repository.id);return changed?{...repository,automationStatus:changed.status}:repository})}));setPauseDialog(null);setAutomationSelection([]);
  }

  async function runDryCheck(repositoryId: string) {
    setConnectionError('');
    const response = await fetch('/api/runs/dry-run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ repositoryId }) });
    const result = await readApiJson<{ error?: string; run: Workspace['runs'][number] }>(response);
    if (!response.ok) { setConnectionError(result.error ?? 'The access check could not run.'); return; }
    setWorkspace((current) => ({ ...current, runs: [result.run, ...current.runs] }));
    setTab('history');
  }

  async function saveDraft() {
    const repository = workspace.repositories[0];
    if (!repository || !draftContent.trim()) return;
    setSaving(true); setConnectionError('');
    const response = await fetch('/api/drafts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ repositoryId: repository.id, name: draftName, content: draftContent }) });
    const result = await readApiJson<{ error?: string; draft: Workspace['drafts'][number] & { content?: string } }>(response);
    setSaving(false);
    if (!response.ok) { setConnectionError(result.error ?? 'The draft could not be saved.'); return; }
    const saved = { ...result.draft, preview: result.draft.content?.slice(0, 240) ?? draftContent.slice(0, 240) };
    setWorkspace((current) => ({ ...current, drafts: [saved, ...current.drafts.filter((draft) => draft.id !== saved.id)] }));
    setDraftContent('');
  }

  async function commitDraft(draft: Workspace['drafts'][number]) {
    setSaving(true); setConnectionError('');
    const response = await fetch('/api/drafts/commit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ draftId: draft.id, expectedUpdatedAt: draft.updatedAt }) });
    const result = await readApiJson<{ error?: string; run: Workspace['runs'][number] }>(response);
    setSaving(false);
    if (!response.ok) { setConnectionError(result.error ?? 'The draft could not be committed.'); return; }
    setWorkspace((current) => ({ ...current, drafts: current.drafts.filter((item) => item.id !== draft.id), runs: [result.run, ...current.runs] }));
    setTab('history');
  }

  async function deleteAccount() {
    setSaving(true); setConnectionError('');
    const response = await fetch('/api/account', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmation: deleteConfirmation }) });
    const result = await readApiJson<{ error?: string }>(response);
    if (!response.ok) { setSaving(false); setConnectionError(result.error ?? 'Account deletion could not be completed.'); return; }
    await fetch('/api/auth/signout', { method: 'POST' });
    router.push('/'); router.refresh();
  }

  async function signOut() {
    const response=await fetch('/api/auth/signout',{method:'POST',headers:{'Content-Type':'application/json'}});
    if(!response.ok){setConnectionError('Sign out could not be completed.');return;}
    setWorkspace(emptyWorkspace);setAccountDialog(false);router.push('/');router.refresh();
  }

  async function disableSchedule(){
    if(!editScheduleId)return;setSaving(true);
    const response=await fetch(`/api/schedules/${editScheduleId}`,{method:'DELETE',headers:{'Content-Type':'application/json'}});
    setSaving(false);if(!response.ok){setConnectionError('The schedule could not be disabled.');return;}
    setWorkspace(current=>({...current,schedules:current.schedules.map(item=>item.id===editScheduleId?{...item,status:'disabled',enabled:false}:item)}));setEditScheduleId(null);setConnect(false);
  }

  function editRepositorySchedule(repositoryId:string){
    const schedule=workspace.schedules.find(item=>item.repositoryId===repositoryId&&item.status!=='disabled');
    if(!schedule){setEditScheduleId(null);setSelectedRepositoryIds([repositoryId]);setConnect(true);setStep(3);return;}
    setEditScheduleId(schedule.id);setAction(schedule.rule??'activity_report');setJournalAcknowledged(schedule.rule==='activity_journal');setSelectedRepositoryIds([repositoryId]);setDailyTimes(schedule.times?.filter(time=>Boolean(time.nextRunAt)).map(time=>time.localTime)??[schedule.localTime]);setTimezone(schedule.timezone);setStartDate(schedule.startDate??'');setEndDate(schedule.endDate??'');setConnect(true);setStep(3);
  }

  function scheduleSummary(repositoryId:string){
    const schedule=workspace.schedules.find(item=>item.repositoryId===repositoryId&&item.status!=='disabled');
    if(!schedule)return 'No schedule configured';
    const times=schedule.times?.filter(time=>time.status!=='disabled').map(time=>time.localTime).join(', ')||schedule.localTime;
    return `${schedule.status??'active'} · ${times} · ${schedule.timezone} · from ${schedule.startDate??'legacy start'}${schedule.endDate?` through ${schedule.endDate}`:''}`;
  }

  return (
    <div className="shell">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="Commit-Keep home"><span className="brandmark"><GitBranch size={21} strokeWidth={1.7} /></span>Commit-Keep</Link>
        <button className="account account-button" onClick={() => account ? setAccountDialog(true) : router.push('/api/auth/github/start')}>{account?.avatarUrl?<img className="avatar" src={account.avatarUrl} alt="" referrerPolicy="no-referrer"/>:<span className="avatar">{account?.displayName.slice(0, 1).toUpperCase() ?? 'G'}</span>}<span>{account?.displayName ?? 'Sign in with GitHub'}</span></button>
      </header>

      <main>
        <section className="heading">
          <div><div className="eyebrow">PERSONAL WORKSPACE</div><h1>Overview<span className="heading-period">.</span></h1><p>Your repositories, schedules, and saved work.</p></div>
          <button className="primary" onClick={() => setConnect(true)}><Plus size={17} />Set up automation</button>
        </section>

        <div className="stage-notice">
          <span className="status-dot" />
          <p><strong>Automation workspace.</strong> Configure useful scheduled actions and review every result.</p>
          <span className="stage-label">COMMIT-KEEP</span>
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
            <span className="private-label"><ShieldCheck size={14} />{account?'Only you can see this workspace':'Sign in to open your private workspace'}</span>
          </div>

          <div className="view-stack">
            <TabsContent value="repos" forceMount className="workspace-view" inert={tab !== 'repos'} aria-hidden={tab !== 'repos'}>
              <section className="workspace-grid">
                <div className={`panel ${workspace.repositories.length ? 'repository-panel' : 'empty'}`}>
                  {workspace.repositories.length ? <><div className="panel-heading"><div><span className="eyebrow">CONNECTED</span><h2>Your repositories</h2></div><div className="panel-actions"><button className="secondary-button" onClick={() => { setConnect(true); setStep(2); }}>Manage GitHub access</button><button className="secondary-button" onClick={()=>{setPauseDialog('pause');setAutomationSelection([])}}><Pause size={15}/>Pause schedules</button></div></div><div className="connected-repositories">{workspace.repositories.map((repository) => <article key={repository.id}><div className="repository-name"><FolderGit2 size={18} /><span><strong>{repository.fullName}</strong><small>{repository.defaultBranch} · {repository.automationStatus==='paused'?'Schedules paused':scheduleSummary(repository.id)}</small></span></div><div className="panel-actions"><button className="text-button" onClick={() => editRepositorySchedule(repository.id)}><Settings size={14}/>Configure</button><button className="text-button" onClick={() => runDryCheck(repository.id)}>Run access check<ArrowRight size={14} /></button></div></article>)}</div></> : <>
                  <div className="repo-icon">{loading ? <LoaderCircle className="spin" size={27} /> : <FolderGit2 size={29} strokeWidth={1.25} />}</div>
                  <h2>{workspace.github.connected ? 'Choose your first repository' : 'Connect your work'}</h2>
                  <p>{workspace.github.connected ? `GitHub account @${workspace.github.installations[0]?.accountLogin} is connected. Repository selection is the next step.` : 'Install Commit-Keep only on the repositories you want it to manage.'}</p>
                  <button className="primary" onClick={() => { setConnect(true); setStep(workspace.github.connected ? 2 : 1); }}>
                    {workspace.github.connected ? 'Select repositories' : 'Connect GitHub'}<ArrowRight size={16} />
                  </button>
                  <span className="empty-note"><ShieldCheck size={13} />Access stays limited to your selection</span>
                  </>}
                </div>
                <aside className="guide">
                  <div className="guide-heading"><span className="eyebrow">SETUP PROGRESS</span><span className="guide-count">01 — 03</span></div>
                  {[
                    ['01', 'Connect GitHub', workspace.github.connected ? 'Connected' : 'Install the GitHub App.'],
                    ['02', 'Select repositories', workspace.repositories.length ? `${workspace.repositories.length} selected` : 'Choose where Commit-Keep can work.'],
                    ['03', 'Choose a daily action', workspace.schedules.length ? 'Schedule created' : 'Set the action, time, and timezone.'],
                  ].map(([number, title, note], index) => (
                    <div className="guide-step" key={number}><span className="step-number">{number}</span><div><h3>{title}{index < step - 1 && <Check size={13} />}</h3><p>{note}</p></div></div>
                  ))}
                  <button className="text-button" onClick={() => setConnect(true)}>Continue setup<ArrowUpRight size={15} /></button>
                </aside>
              </section>
            </TabsContent>

            <TabsContent value="history" forceMount className="workspace-view" inert={tab !== 'history'} aria-hidden={tab !== 'history'}>
              <section className={`panel ${workspace.runs.length ? 'history-panel' : 'empty history-empty'}`}>
                {workspace.runs.length ? <><div className="panel-heading"><div><span className="eyebrow">AUDIT LOG</span><h2>Change history</h2></div></div><div className="run-list">{workspace.runs.map((run) => <article key={run.id}><span className={`run-status ${run.outcome}`}>{run.outcome}</span><div><strong>{run.summary}</strong><small>{run.source.replace('_', ' ')} · {new Date(run.createdAt).toLocaleString()}</small></div>{run.commitUrl && <a href={run.commitUrl} target="_blank" rel="noreferrer" aria-label="Open commit on GitHub"><ArrowUpRight size={16} /></a>}</article>)}</div></> : <>
                <div className="repo-icon"><History size={29} strokeWidth={1.25} /></div>
                <h2>{workspace.runs.length ? 'Your change history' : 'Every change, in one place'}</h2>
                <p>{workspace.runs.length ? 'Automatic updates, saved work, skipped runs, and failures are recorded under your account.' : 'The first completed or skipped run will appear here with its reason and commit link.'}</p>
                <div className="history-legend"><span>Automatic updates</span><span>Saved work</span><span>Skipped runs</span></div>
                </>}
              </section>
            </TabsContent>

            <TabsContent value="work" forceMount className="workspace-view" inert={tab !== 'work'} aria-hidden={tab !== 'work'}>
              <section className={`panel ${workspace.repositories.length ? 'draft-panel' : 'empty'}`}>
                {workspace.repositories.length ? <><div className="panel-heading"><div><span className="eyebrow">SAVED WORK</span><h2>Repository notes</h2></div></div><div className="draft-layout"><div className="draft-editor"><label>Note name<input value={draftName} maxLength={60} onChange={(event) => setDraftName(event.target.value)} /></label><label>Markdown content<textarea value={draftContent} maxLength={100000} rows={8} placeholder="Write or paste work you want to save…" onChange={(event) => setDraftContent(event.target.value)} /></label><button className="primary" disabled={saving || !draftContent.trim()} onClick={saveDraft}>{saving ? 'Saving…' : 'Save draft'}</button></div><div className="draft-list"><span className="eyebrow">PENDING PREVIEW</span>{workspace.drafts.length ? workspace.drafts.map((draft) => <article key={draft.id}><strong>{draft.path}</strong><p>{draft.preview}</p><button className="text-button" disabled={saving} onClick={() => commitDraft(draft)}>Commit this draft<ArrowRight size={14} /></button></article>) : <p>No pending drafts.</p>}</div></div></> : <><div className="repo-icon"><Laptop size={29} strokeWidth={1.25} /></div><h2>Pick up where you left off</h2><p>Connect a repository before saving a web draft.</p><button className="primary" onClick={() => setConnect(true)}>Start setup<ArrowRight size={16} /></button></>}
              </section>
            </TabsContent>
          </div>
        </Tabs>

        <footer><span><GitCommitHorizontal size={15} />{workspace.runs.length ? `${workspace.runs.length} recorded runs` : 'Nothing committed yet.'}</span><span>Commit-Keep<span className="footer-divider">/</span>Automation workspace</span></footer>
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
            {step === 1 && 'Install the Commit-Keep GitHub App and choose exactly which repositories it may access.'}
            {step === 2 && 'Your approved repositories will appear here after GitHub is connected.'}
            {step === 3 && 'Choose what Commit-Keep should update and when it should run.'}
          </DialogDescription>

          {step === 1 && <div className="connection-note"><ShieldCheck size={19} /><div><h3>Least-privilege access</h3><p>Commit-Keep stores the installation ID. Temporary GitHub credentials are created only when a job runs.</p></div></div>}
          {step === 2 && <div className="repository-list">{availableRepositories.length ? availableRepositories.map((repository) => <label key={repository.id} className="repository-choice"><input type="checkbox" checked={selectedRepositoryIds.includes(repository.id)} onChange={(event) => setSelectedRepositoryIds((current) => event.target.checked ? [...current, repository.id] : current.filter((id) => id !== repository.id))} /><span><strong>{repository.fullName}</strong><small>{repository.private ? 'Private' : 'Public'} · {repository.defaultBranch}</small></span></label>) : <div className="repository-picker"><LoaderCircle className="spin" size={17} />Loading approved repositories…</div>}</div>}
          {step === 3 && <div className="setup-fields"><div className="schedule-summary"><strong>Applies to {editScheduleId?selectedRepositoryIds.length:workspace.repositories.filter(repository=>repository.enabled).length} repositories</strong><span>{workspace.repositories.filter(repository=>editScheduleId?selectedRepositoryIds.includes(repository.id):repository.enabled).map(repository=>repository.fullName).join(', ')}</span></div><label>Daily action<select value={action} disabled={Boolean(editScheduleId)} onChange={(event)=>{const next=event.target.value as typeof action;setAction(next);if(next==="activity_journal")setDailyTimes(current=>current.slice(0,1))}}><option value="activity_report">Update daily repository report</option><option value="activity_journal">Activity journal (opt-in)</option></select></label><label>Scheduled runs per day<select value={dailyTimes.length} onChange={(event)=>{const count=Number(event.target.value);const defaults=['09:00','11:00','13:00','15:00','17:00','19:00','21:00','23:00'];setDailyTimes(current=>Array.from({length:count},(_,index)=>current[index]??defaults[index]))}}>{Array.from({length:action==="activity_journal"?1:8},(_,index)=><option key={index+1} value={index+1}>{index+1}</option>)}</select></label><div className="time-grid">{dailyTimes.map((time,index)=><label key={index}>Run {index+1} time<input type="time" value={time} aria-invalid={dailyTimes.indexOf(time)!==index} onChange={(event)=>setDailyTimes(current=>current.map((value,item)=>item===index?event.target.value:value))}/></label>)}</div>{action==="activity_journal"&&<label className="connection-note"><input type="checkbox" checked={journalAcknowledged} onChange={(event)=>setJournalAcknowledged(event.target.checked)}/><span>I understand this writes one transparent entry per day to <code>.commitkeep/log/YYYY-MM.md</code>, identifies Commit-Keep as the generator, does not claim engineering work, and does not guarantee a contribution.<small>Preview: “Commit-Keep ran its disclosed activity-journal action… This entry does not represent source-code work.”</small></span></label>}<label>Timezone<input list="commitkeep-timezones" value={timezone} onChange={(event)=>setTimezone(event.target.value)} autoComplete="off"/><datalist id="commitkeep-timezones">{timezoneOptions.map(zone=><option key={zone} value={zone}/>)}</datalist></label><div className="date-grid"><label>Start date (inclusive)<input type="date" required value={startDate} onChange={(event)=>setStartDate(event.target.value)}/></label><label>End date (optional, inclusive)<input type="date" min={startDate} value={endDate} onChange={(event)=>setEndDate(event.target.value)}/></label></div><div className="schedule-summary" aria-live="polite"><strong>Schedule summary</strong><span>{dailyTimes.slice().sort().join(', ')} · {timezone}</span><span>Starts {startDate||'when a start date is chosen'}{endDate?` and ends ${endDate}`:' with no end date'}.</span><small>Commit-Keep runs the selected action at these times. A commit is created only when repository content actually changes. Times already passed today are not backfilled.</small></div></div>}

          {connectionError && <p className="form-error" role="alert">{connectionError}</p>}
          <div className="dialog-actions">
            {step===3&&editScheduleId&&<button className="secondary-button" disabled={saving} onClick={disableSchedule}>Disable schedule</button>}
            {step > 1 && <button className="secondary-button" onClick={() => setStep(step - 1)}>Back</button>}
            {step === 1 ? <button className="primary" onClick={connectGitHub}>{workspace.github.connected ? 'Connected' : 'Continue with GitHub'}<ArrowRight size={16} /></button> :
             step < 3 ? <button className="primary" disabled={!selectedRepositoryIds.length || saving} onClick={saveRepositories}>{saving ? 'Saving…' : 'Continue'}<ArrowRight size={16} /></button> :
             <button className="primary" disabled={saving || !workspace.repositories.length || !startDate || !timezone || new Set(dailyTimes).size!==dailyTimes.length || Boolean(endDate&&endDate<startDate) || (action==='activity_journal'&&!journalAcknowledged)} onClick={createSchedule}>{saving ? 'Creating…' : 'Create schedules'}<ArrowRight size={16} /></button>}
          </div>
          <p className="dialog-footnote">No repository content is changed during setup.</p>
        </DialogContent>
      </Dialog>
      <Dialog open={accountDialog} onOpenChange={setAccountDialog}>
        <DialogContent className="connect-dialog"><DialogTitle>Account</DialogTitle><div className="repository-name">{account?.avatarUrl?<img className="avatar" src={account.avatarUrl} alt="" referrerPolicy="no-referrer"/>:<span className="avatar">{account?.displayName.slice(0,1)}</span>}<span><strong>{account?.displayName}</strong><small>@{account?.githubLogin??'GitHub account'}</small></span></div><div className="setup-fields">{account?.githubLogin&&<a className="secondary-button" href={`https://github.com/${account.githubLogin}`} target="_blank" rel="noreferrer">Open GitHub profile<ArrowUpRight size={15}/></a>}<button className="secondary-button" onClick={()=>{setAccountDialog(false);setConnect(true);setStep(workspace.github.connected?2:1)}}><Settings size={15}/>Manage GitHub access</button><button className="secondary-button" onClick={signOut}><LogOut size={15}/>Log out</button><button className="text-button danger" onClick={()=>{setAccountDialog(false);setDeleteDialog(true)}}><Trash2 size={15}/>Delete Commit-Keep account</button></div><p className="dialog-footnote">Logging out ends this browser session. Schedules and GitHub access continue unchanged.</p></DialogContent>
      </Dialog>
      <Dialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <DialogContent className="connect-dialog"><span className="dialog-icon"><Trash2 size={22} /></span><DialogTitle>Delete Commit-Keep account</DialogTitle><DialogDescription>This revokes Commit-Keep’s GitHub installations and permanently removes your repositories, schedules, drafts, and history from Commit-Keep.</DialogDescription><div className="setup-fields"><label>Type DELETE to confirm<input value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} /></label></div>{connectionError && <p className="form-error" role="alert">{connectionError}</p>}<div className="dialog-actions"><button className="secondary-button" onClick={() => setDeleteDialog(false)}>Cancel</button><button className="primary" disabled={saving || deleteConfirmation !== 'DELETE'} onClick={deleteAccount}>{saving ? 'Deleting…' : 'Delete account'}</button></div></DialogContent>
      </Dialog>
      <Dialog open={Boolean(pauseDialog)} onOpenChange={(open)=>{if(!open){setPauseDialog(null);setAutomationSelection([])}}}>
        <DialogContent className="connect-dialog"><span className="dialog-icon">{pauseDialog==='pause'?<Pause size={22}/>:<Play size={22}/>}</span><DialogTitle>{pauseDialog==='pause'?'Pause schedules':'Resume schedules'}</DialogTitle><DialogDescription>Select repositories. Pausing keeps GitHub access, settings, and history intact.</DialogDescription><div className="repository-list">{workspace.repositories.filter(repository=>pauseDialog==='pause'?repository.automationStatus!=='paused':repository.automationStatus==='paused').map(repository=><label className="repository-choice" key={repository.id}><input type="checkbox" checked={automationSelection.includes(repository.id)} onChange={(event)=>setAutomationSelection(current=>event.target.checked?[...current,repository.id]:current.filter(id=>id!==repository.id))}/><span><strong>{repository.fullName}</strong><small>{workspace.schedules.filter(schedule=>schedule.repositoryId===repository.id&&schedule.enabled&&schedule.status==='active').length} active schedules affected</small></span></label>)}</div><p className="dialog-footnote">{workspace.schedules.filter(schedule=>automationSelection.includes(schedule.repositoryId)&&schedule.enabled&&schedule.status==='active').length} active schedules selected</p>{connectionError&&<p className="form-error" role="alert">{connectionError}</p>}<div className="dialog-actions"><button className="secondary-button" onClick={()=>setPauseDialog(null)}>Cancel</button><button className="primary" disabled={!automationSelection.length||saving} onClick={()=>changeAutomation(pauseDialog??'pause')}>{saving?'Saving…':pauseDialog==='pause'?'Pause schedules':'Resume schedules'}</button></div></DialogContent>
      </Dialog>
    </div>
  );
}
