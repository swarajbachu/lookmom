/**
 * Owner surfaces (AuthKit-gated): the gallery of your artifacts, and per-artifact
 * share controls (mode + email allowlist). Plain <form> POSTs — no client JS.
 */
import { Hono } from "hono";
import type { AppContext, Env, Vars, ShareMode } from "../types";
import { getDb, getArtifact, listArtifactsByOwner, setShareMode, addToAllowlist } from "../db";
import { Gallery, Layout } from "../chrome";

const SHARE_MODES: ShareMode[] = ["private", "allowlist", "public"];

export const shareRoutes = new Hono<{ Bindings: Env; Variables: Vars }>();

function loginRedirect(c: AppContext) {
  const path = new URL(c.req.url).pathname;
  return c.redirect(`/auth/login?return_to=${encodeURIComponent(path)}`);
}

shareRoutes.get("/gallery", async (c) => {
  const viewer = c.get("viewer");
  if (!viewer) return loginRedirect(c);
  const db = getDb(c.env.DB);
  const artifacts = await listArtifactsByOwner(db, viewer.email);
  return c.html(<Gallery email={viewer.email} artifacts={artifacts} host={c.env.APP_HOST} />);
});

shareRoutes.get("/share/:id", async (c) => {
  const viewer = c.get("viewer");
  if (!viewer) return loginRedirect(c);
  const id = c.req.param("id");
  const db = getDb(c.env.DB);
  const art = await getArtifact(db, id);
  if (!art) return c.notFound();
  if (art.ownerEmail !== viewer.email) return c.text("Forbidden", 403);

  return c.html(
    <Layout title={`Share — ${art.title}`}>
      <div class="wrap">
        <div class="card">
          <h1>Share “{art.title}”</h1>
          <p>
            <a href={`${c.env.APP_HOST}/a/${id}`}>{c.env.APP_HOST}/a/{id}</a>
          </p>

          <form method="post" action={`/share/${id}/mode`} style="margin-bottom:24px">
            <strong>Who can view</strong>
            {SHARE_MODES.map((m) => (
              <label class="row" style="margin:8px 0">
                <input type="radio" name="mode" value={m} checked={art.shareMode === m} />
                <span>
                  {m === "private"
                    ? "Private — only you"
                    : m === "allowlist"
                      ? "Allowlist — only listed emails"
                      : "Public — anyone with the link"}
                </span>
              </label>
            ))}
            <div style="margin-top:10px">
              <button class="btn" type="submit">
                Save
              </button>
            </div>
          </form>

          <form method="post" action={`/share/${id}/allow`}>
            <strong>Add emails to the allowlist</strong>
            <textarea
              name="emails"
              placeholder="alice@example.com, bob@example.com"
              style="width:100%;min-height:90px;margin-top:8px;padding:10px;border-radius:9px;border:1px solid var(--line);background:var(--bg);color:var(--fg)"
            />
            <div style="margin-top:10px">
              <button class="btn secondary" type="submit">
                Add
              </button>
            </div>
          </form>
        </div>
      </div>
    </Layout>,
  );
});

shareRoutes.post("/share/:id/mode", async (c) => {
  const viewer = c.get("viewer");
  if (!viewer) return loginRedirect(c);
  const id = c.req.param("id");
  const db = getDb(c.env.DB);
  const art = await getArtifact(db, id);
  if (!art || art.ownerEmail !== viewer.email) return c.text("Forbidden", 403);

  const body = await c.req.parseBody();
  const mode = String(body.mode) as ShareMode;
  if (SHARE_MODES.includes(mode)) await setShareMode(db, id, mode);
  return c.redirect(`/share/${id}`);
});

shareRoutes.post("/share/:id/allow", async (c) => {
  const viewer = c.get("viewer");
  if (!viewer) return loginRedirect(c);
  const id = c.req.param("id");
  const db = getDb(c.env.DB);
  const art = await getArtifact(db, id);
  if (!art || art.ownerEmail !== viewer.email) return c.text("Forbidden", 403);

  const body = await c.req.parseBody();
  const emails = String(body.emails ?? "")
    .split(/[\s,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.includes("@") && e.length <= 254);
  await addToAllowlist(db, id, emails);
  return c.redirect(`/share/${id}`);
});
