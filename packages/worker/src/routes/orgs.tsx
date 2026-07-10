/**
 * First-class GitHub Orgs UI.
 *   GET  /orgs              — list orgs this user can see
 *   GET  /orgs/:slug        — org home (artifacts + members)
 *   POST /orgs/link         — link an org (requires owner GitHub with read:org)
 *   POST /orgs/:slug/sync   — re-sync members (linker only)
 *   POST /orgs/:slug/unlink — remove org link (linker only)
 */
import { Hono } from "hono";
import type { AppContext, Env, Vars } from "../types";
import {
  getDb,
  getOwnerGithub,
  upsertGithubOrgLink,
  getGithubOrgLink,
  listGithubOrgMembers,
  listOrgsForViewer,
  listArtifactsByOrg,
  deleteGithubOrgLink,
} from "../db";
import { listUserOrgs } from "../github/orgs";
import { syncOrgMembers } from "../github/roster-sync";
import { normalizeGithubSlug } from "../auth/github";
import { Layout } from "../chrome";
import { LOGO_DATA_URI as LOGO } from "../brand";

export const orgRoutes = new Hono<{ Bindings: Env; Variables: Vars }>();

function loginRedirect(c: AppContext, path: string) {
  return c.redirect(`/auth/login?return_to=${encodeURIComponent(path)}`);
}

function fmtWhen(ts: number | null | undefined): string {
  if (!ts) return "never";
  try {
    return new Date(ts * 1000).toLocaleString();
  } catch {
    return "unknown";
  }
}

orgRoutes.get("/orgs", async (c) => {
  const viewer = c.get("viewer");
  if (!viewer) return loginRedirect(c, "/orgs");
  const db = getDb(c.env.DB);
  const orgs = await listOrgsForViewer(db, {
    email: viewer.email,
    githubLogin: viewer.githubLogin,
  });
  const ownerGh = await getOwnerGithub(db, viewer.email);

  let linkable: Array<{ login: string; description: string }> = [];
  let linkError: string | undefined;
  if (ownerGh) {
    try {
      const all = await listUserOrgs(ownerGh.accessToken);
      const linked = new Set(orgs.map((o) => o.orgSlug));
      linkable = all.filter((o) => !linked.has(o.login.toLowerCase()));
    } catch {
      linkError = "Could not list GitHub orgs. Reconnect GitHub with read:org.";
    }
  }

  return c.html(
    <Layout title="Orgs · lookmom">
      <header class="nav">
        <a class="nav-brand" href="/gallery">
          <img class="nav-mark" src={LOGO} width={28} height={28} alt="lookmom" />
          lookmom
        </a>
        <div class="nav-actions">
          <a class="btn secondary sm" href="/gallery">
            Gallery
          </a>
          <span class="nav-meta mono">{viewer.email}</span>
          <a class="btn secondary sm" href="/auth/logout">
            Log out
          </a>
        </div>
      </header>
      <main class="shell-main wide">
        <div class="page-head">
          <div>
            <p class="kicker">organizations</p>
            <h1>Orgs</h1>
            <p class="lede">
              Linked GitHub orgs. Artifacts can live here so the whole team can
              open them after connecting identity only.
            </p>
          </div>
          {!ownerGh ? (
            <a class="btn" href="/connect/github?return_to=/orgs">
              Connect GitHub
            </a>
          ) : null}
        </div>

        {orgs.length === 0 ? (
          <div class="empty">
            <h2>No orgs linked yet</h2>
            <p>
              Someone with org access connects GitHub once and links the org.
              Everyone else just proves their @login.
            </p>
          </div>
        ) : (
          <div class="grid">
            {orgs.map((o) => (
              <a class="art-card" href={`/orgs/${o.orgSlug}`}>
                <div class="art-card-top">
                  <span class="art-emoji" aria-hidden="true">
                    🐙
                  </span>
                  <span class="badge">org</span>
                </div>
                <div class="art-title">{o.orgSlug}</div>
                <div class="art-meta">
                  <span class="badge accent">@{o.githubLogin}</span>
                  <span class="badge">synced {fmtWhen(o.lastSyncedAt)}</span>
                </div>
              </a>
            ))}
          </div>
        )}

        <div class="card" style="margin-top:28px">
          <p class="kicker">link an org</p>
          <h2>Add organization</h2>
          {!ownerGh ? (
            <p>
              Connect GitHub with <span class="mono">read:org</span> first, then
              come back.
            </p>
          ) : (
            <>
              <p>
                Connected as <span class="mono">@{ownerGh.githubLogin}</span>.
                Pick an org you can access — we’ll sync members with your token.
              </p>
              {linkError ? <p class="err">{linkError}</p> : null}
              {linkable.length === 0 && !linkError ? (
                <p class="ok">All your orgs are already linked (or none found).</p>
              ) : (
                <form method="post" action="/orgs/link">
                  <label class="field">
                    Organization
                    <select class="text" name="org" required style="margin-top:6px">
                      <option value="">Select…</option>
                      {linkable.map((o) => (
                        <option value={o.login}>
                          {o.login}
                          {o.description ? ` — ${o.description.slice(0, 48)}` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div class="row" style="margin-top:14px">
                    <button class="btn" type="submit">
                      Link org &amp; sync members
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>
      </main>
    </Layout>,
  );
});

orgRoutes.post("/orgs/link", async (c) => {
  const viewer = c.get("viewer");
  if (!viewer) return loginRedirect(c, "/orgs");
  const body = await c.req.parseBody();
  const org = normalizeGithubSlug(String(body.org ?? ""));
  if (!org) return c.redirect("/orgs?err=pick_org");

  const db = getDb(c.env.DB);
  const ownerGh = await getOwnerGithub(db, viewer.email);
  if (!ownerGh) {
    return c.redirect("/connect/github?return_to=/orgs");
  }

  await upsertGithubOrgLink(db, {
    orgSlug: org,
    linkedByEmail: viewer.email,
    githubLogin: ownerGh.githubLogin,
    accessToken: ownerGh.accessToken,
  });

  const sync = await syncOrgMembers(db, {
    org,
    accessToken: ownerGh.accessToken,
  });

  if (sync.error) {
    return c.redirect(
      `/orgs/${org}?err=${encodeURIComponent(`Linked, but sync failed: ${sync.error}`)}`,
    );
  }
  return c.redirect(`/orgs/${org}?ok=synced&members=${sync.members}&emails=${sync.emails}`);
});

orgRoutes.get("/orgs/:slug", async (c) => {
  const viewer = c.get("viewer");
  if (!viewer) return loginRedirect(c, c.req.path);
  const slug = normalizeGithubSlug(c.req.param("slug") ?? "");
  if (!slug) return c.notFound();

  const db = getDb(c.env.DB);
  const link = await getGithubOrgLink(db, slug);
  if (!link) {
    return c.html(
      <Layout title="Org not found · lookmom">
        <header class="nav">
          <a class="nav-brand" href="/gallery">
            <img class="nav-mark" src={LOGO} width={28} height={28} alt="" />
            lookmom
          </a>
        </header>
        <main class="shell-main narrow">
          <div class="card">
            <p class="kicker">orgs</p>
            <h1>Org not linked</h1>
            <p>
              <span class="mono">{c.req.param("slug")}</span> isn’t linked in lookmom yet.
            </p>
            <a class="btn" href="/orgs">
              Back to Orgs
            </a>
          </div>
        </main>
      </Layout>,
    );
  }

  // Access: linker or roster member
  const canSee = await listOrgsForViewer(db, {
    email: viewer.email,
    githubLogin: viewer.githubLogin,
  });
  if (!canSee.some((o) => o.orgSlug === slug)) {
    return c.html(
      <Layout title="No access · lookmom">
        <header class="nav">
          <a class="nav-brand" href="/gallery">
            <img class="nav-mark" src={LOGO} width={28} height={28} alt="" />
            lookmom
          </a>
        </header>
        <main class="shell-main narrow">
          <div class="card">
            <p class="kicker">orgs</p>
            <h1>Not a member (yet)</h1>
            <p>
              Connect your GitHub identity so we can match you on the roster, or
              ask a linker to re-sync <span class="mono">{slug}</span>.
            </p>
            <div class="row" style="margin-top:14px">
              <a class="btn" href="/connect/github?return_to=/orgs">
                Connect GitHub
              </a>
              <a class="btn secondary" href="/orgs">
                Orgs
              </a>
            </div>
          </div>
        </main>
      </Layout>,
    );
  }

  const isLinker = link.linkedByEmail === viewer.email.toLowerCase();
  const members = await listGithubOrgMembers(db, slug);
  const artifacts = await listArtifactsByOrg(db, slug);
  const err = c.req.query("err");
  const ok = c.req.query("ok");
  const membersN = c.req.query("members");
  const emailsN = c.req.query("emails");

  return c.html(
    <Layout title={`${slug} · lookmom`}>
      <header class="nav">
        <a class="nav-brand" href="/gallery">
          <img class="nav-mark" src={LOGO} width={28} height={28} alt="" />
          lookmom
        </a>
        <div class="nav-actions">
          <a class="btn secondary sm" href="/orgs">
            All orgs
          </a>
          <a class="btn secondary sm" href="/gallery">
            Gallery
          </a>
          <a class="btn secondary sm" href="/auth/logout">
            Log out
          </a>
        </div>
      </header>
      <main class="shell-main wide">
        <div class="page-head">
          <div>
            <p class="kicker">organization</p>
            <h1>{slug}</h1>
            <p class="lede">
              Linked by <span class="mono">@{link.githubLogin}</span>
              {" · "}
              last sync {fmtWhen(link.lastSyncedAt)}
              {" · "}
              {members.length} members
            </p>
          </div>
          {isLinker ? (
            <div class="row">
              <form method="post" action={`/orgs/${slug}/sync`} style="margin:0">
                <button class="btn" type="submit">
                  Sync members
                </button>
              </form>
              <form method="post" action={`/orgs/${slug}/unlink`} style="margin:0">
                <button class="btn secondary" type="submit">
                  Unlink
                </button>
              </form>
            </div>
          ) : null}
        </div>

        {err ? <p class="err">{err}</p> : null}
        {ok === "synced" ? (
          <p class="ok">
            Synced {membersN ?? members.length} members
            {emailsN ? ` · ${emailsN} public emails` : ""}.
          </p>
        ) : null}

        <h2 style="margin:8px 0 12px">Artifacts</h2>
        {artifacts.length === 0 ? (
          <div class="empty" style="margin-bottom:24px">
            <h2>No artifacts yet</h2>
            <p>Share an artifact to this org from the Share dialog.</p>
          </div>
        ) : (
          <div class="grid" style="margin-bottom:28px">
            {artifacts.map((a) => (
              <a class="art-card" href={`/a/${a.id}`}>
                <div class="art-card-top">
                  <span class="art-emoji">{a.emoji || "📄"}</span>
                  <span class="badge">v{a.currentVersion}</span>
                </div>
                <div class="art-title">{a.title}</div>
                <div class="art-meta">
                  <span class="badge accent">org</span>
                </div>
              </a>
            ))}
          </div>
        )}

        <h2 style="margin:8px 0 12px">Members</h2>
        <div class="card">
          <p style="margin-bottom:12px">
            Members only need <strong style="color:var(--ink)">identity</strong> GitHub
            (their @login). No org OAuth for each person.
          </p>
          {members.length === 0 ? (
            <p class="err">Roster empty — linker should hit Sync members.</p>
          ) : (
            <div class="table-wrap" style="box-shadow:none;border:2px solid var(--ink);border-radius:14px;overflow:auto">
              <table class="data" style="width:100%;border-collapse:collapse;font-size:1.05rem">
                <thead>
                  <tr>
                    <th style="text-align:left;padding:10px">GitHub</th>
                    <th style="text-align:left;padding:10px">Email (if public)</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m: { githubLogin: string; email: string | null }) => (
                    <tr>
                      <td style="padding:8px 10px;border-top:1px solid rgba(31,48,24,.1)" class="mono">
                        @{m.githubLogin}
                      </td>
                      <td style="padding:8px 10px;border-top:1px solid rgba(31,48,24,.1)" class="mono">
                        {m.email ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </Layout>,
  );
});

orgRoutes.post("/orgs/:slug/sync", async (c) => {
  const viewer = c.get("viewer");
  if (!viewer) return loginRedirect(c, "/orgs");
  const slug = normalizeGithubSlug(c.req.param("slug") ?? "");
  if (!slug) return c.redirect("/orgs");
  const db = getDb(c.env.DB);
  const link = await getGithubOrgLink(db, slug);
  if (!link || link.linkedByEmail !== viewer.email.toLowerCase()) {
    return c.redirect(`/orgs/${slug}?err=${encodeURIComponent("Only the linker can sync.")}`);
  }
  // Prefer fresh owner token if available
  const ownerGh = await getOwnerGithub(db, viewer.email);
  const token = ownerGh?.accessToken ?? link.accessToken;
  if (ownerGh) {
    await upsertGithubOrgLink(db, {
      orgSlug: slug,
      linkedByEmail: viewer.email,
      githubLogin: ownerGh.githubLogin,
      accessToken: ownerGh.accessToken,
    });
  }
  const sync = await syncOrgMembers(db, { org: slug, accessToken: token });
  if (sync.error) {
    return c.redirect(`/orgs/${slug}?err=${encodeURIComponent(sync.error)}`);
  }
  return c.redirect(`/orgs/${slug}?ok=synced&members=${sync.members}&emails=${sync.emails}`);
});

orgRoutes.post("/orgs/:slug/unlink", async (c) => {
  const viewer = c.get("viewer");
  if (!viewer) return loginRedirect(c, "/orgs");
  const slug = normalizeGithubSlug(c.req.param("slug") ?? "");
  if (!slug) return c.redirect("/orgs");
  const db = getDb(c.env.DB);
  const link = await getGithubOrgLink(db, slug);
  if (!link || link.linkedByEmail !== viewer.email.toLowerCase()) {
    return c.redirect(`/orgs/${slug}?err=${encodeURIComponent("Only the linker can unlink.")}`);
  }
  await deleteGithubOrgLink(db, slug);
  return c.redirect("/orgs");
});
