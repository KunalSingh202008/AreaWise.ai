import { useEffect, useState } from 'react';
import { Building2 } from 'lucide-react';
import { authenticatedFetch, useAuth } from '../../context/AuthContext';
import { downloadTextFile, readJson } from '../../api';
import type { PlaceSummary } from '../../types';
import { PlaceSearch } from '../geography/PlaceSearch';

interface Workspace {
  id: string;
  name: string;
  role: 'owner' | 'editor' | 'viewer';
}
interface Project { id: string; name: string; placeIds: string[] }
interface Detail extends Workspace { projects: Project[] }

function post<T>(path: string, body: object) {
  return authenticatedFetch('/api/v1/workspaces' + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }).then((response) => readJson<T>(response));
}

export function ProfessionalView({ onOpenComparison }: { onOpenComparison: (ids: string[]) => void }) {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [canCreate, setCanCreate] = useState(false);
  const [selected, setSelected] = useState<string>();
  const [workspace, setWorkspace] = useState<Detail | null>(null);
  const [places, setPlaces] = useState<PlaceSummary[]>([]);
  const [invite, setInvite] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [incomingInvite, setIncomingInvite] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('invite'));
  const uid = user?.id;

  async function loadWorkspaceList(signal?: AbortSignal) {
    const data = await authenticatedFetch('/api/v1/workspaces', { signal }).then((response) =>
      readJson<{ workspaces: Workspace[]; canCreate: boolean }>(response));
    if (signal?.aborted) return;
    setWorkspaces(data.workspaces);
    setCanCreate(data.canCreate);
    setSelected((id) => id && data.workspaces.some((item) => item.id === id) ? id : data.workspaces[0]?.id);
  }

  useEffect(() => {
    if (!uid) return;
    const abort = new AbortController();
    void loadWorkspaceList(abort.signal).catch((error: unknown) => {
      if (!abort.signal.aborted) setError(error instanceof Error ? error.message : 'Could not load workspaces.');
    });
    return () => abort.abort();
  }, [uid]);

  useEffect(() => {
    if (!uid || !selected) return;
    const abort = new AbortController();
    authenticatedFetch('/api/v1/workspaces/' + selected, { signal: abort.signal }).then((response) => readJson<Detail>(response))
      .then((value) => { if (!abort.signal.aborted) setWorkspace(value); })
      .catch((error: unknown) => { if (!abort.signal.aborted) setError(error instanceof Error ? error.message : 'Could not open workspace.'); });
    return () => abort.abort();
  }, [uid, selected]);

  async function run(action: () => Promise<unknown>) {
    if (busy) return;
    setError('');
    setBusy(true);
    try { await action(); }
    catch (error) { setError(error instanceof Error ? error.message : 'Workspace action failed.'); }
    finally { setBusy(false); }
  }

  const active = workspace?.id === selected ? workspace : null;
  const field = 'block rounded-lg border border-slate-300 bg-transparent p-2 text-sm dark:border-slate-700';
  const submit = 'rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-60';
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold"><Building2 className="h-6 w-6 text-emerald-600" /> Professional research</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">Workspaces for shared location shortlists and evidence exports.</p>
      </header>
      {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
      {!user ? <p className="text-sm text-slate-500">Sign in to open a workspace or accept an invitation.</p> : (
        <>
          {incomingInvite && <button disabled={busy} className={submit} onClick={() => void run(async () => {
            const joined = await post<{ workspaceId: string }>('/accept-invite', { token: incomingInvite });
            setIncomingInvite(null);
            history.replaceState(null, '', '/professional');
            await loadWorkspaceList();
            setSelected(joined.workspaceId);
          })}>Accept workspace invitation</button>}
          {canCreate && <form className="flex flex-wrap items-end gap-2" onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const name = new FormData(form).get('name');
            void run(async () => {
              const next = await post<Workspace>('', { name });
              form.reset();
              await loadWorkspaceList();
              setSelected(next.id);
            });
          }}>
            <label className="space-y-1 text-xs font-semibold">Workspace name<input name="name" required maxLength={100} className={field} /></label>
            <button className={submit} disabled={busy}>Create workspace</button>
          </form>}
          {!canCreate && !workspaces.length && <p className="text-sm text-slate-500">Workspace creation requires Professional access. Team invitations work with a signed-in account.</p>}
          {workspaces.length > 0 && <label className="inline-flex items-center gap-2 text-sm font-semibold">Workspace
            <select className={field} value={selected ?? ''} onChange={(event) => { setSelected(event.target.value); setPlaces([]); setInvite(''); }}>
              {workspaces.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.role}</option>)}
            </select>
          </label>}

          {active && (
            <>
              <section className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <h2 className="font-bold">Research projects</h2>
                {!active.projects.length && <p className="text-sm text-slate-500">This workspace has no projects yet.</p>}
                {active.projects.map((project) => <div key={project.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 py-2 text-sm dark:border-slate-800">
                  <button className="font-semibold underline" onClick={() => onOpenComparison(project.placeIds)}>{project.name} · {project.placeIds.length} places</button>
                  <button className="text-xs underline" disabled={busy} onClick={() => void run(async () => {
                    await downloadTextFile(await authenticatedFetch(`/api/v1/workspaces/${active.id}/projects/${project.id}/export.csv`), 'areawise-project-evidence.csv');
                  })}>Export evidence CSV</button>
                </div>)}
                {active.role !== 'viewer' && <div className="space-y-2">
                  {places.length < 5 && <PlaceSearch label="Add a research place" onSelect={(place) => setPlaces((previous) =>
                    previous.some((item) => item.id === place.id) ? previous : [...previous, place])} />}
                  <ul className="flex flex-wrap gap-2 text-xs">
                    {places.map((place) => <li key={place.id}><button className="rounded-full border px-2 py-1" onClick={() =>
                      setPlaces((previous) => previous.filter((item) => item.id !== place.id))}>{place.name} ×</button></li>)}
                  </ul>
                  <form className="flex flex-wrap items-end gap-2" onSubmit={(event) => {
                    event.preventDefault();
                    const form = event.currentTarget;
                    const name = new FormData(form).get('name');
                    void run(async () => {
                      const project = await post<Project>(`/${active.id}/projects`, { name, placeIds: places.map((place) => place.id) });
                      setWorkspace((previous) => previous?.id === active.id ? { ...previous, projects: [project, ...previous.projects] } : previous);
                      setPlaces([]);
                      form.reset();
                    });
                  }}>
                    <label className="space-y-1 text-xs font-semibold">Project name<input name="name" required maxLength={120} className={field} /></label>
                    <button className={submit} disabled={busy || places.length < 2}>Save project</button>
                  </form>
                </div>}
              </section>
              {active.role === 'owner' && <section className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <h2 className="font-bold">Team invitations</h2>
                <form className="flex flex-wrap items-end gap-2" onSubmit={(event) => {
                  event.preventDefault();
                  const role = new FormData(event.currentTarget).get('role');
                  void run(async () => {
                    const created = await post<{ token: string }>(`/${active.id}/invites`, { role });
                    const url = new URL('/professional', window.location.origin);
                    url.hash = 'invite=' + created.token;
                    setInvite(url.toString());
                  });
                }}>
                  <label className="space-y-1 text-xs font-semibold">Role<select name="role" className={field}><option value="viewer">Viewer</option><option value="editor">Editor</option></select></label>
                  <button className={submit} disabled={busy}>Generate invitation link</button>
                </form>
                {invite && <label className="block space-y-1 text-xs">One-use link · expires in 48 hours
                  <input className={field + ' w-full'} readOnly value={invite} onFocus={(event) => event.target.select()} />
                </label>}
              </section>}
            </>
          )}
        </>
      )}
    </div>
  );
}
