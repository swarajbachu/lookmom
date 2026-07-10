/** Worker entrypoint — wires middleware + route groups. */
import { Hono } from "hono";
import type { Env, Vars } from "./types";
import { viewerSession } from "./auth/session";
import { agentRoutes } from "./auth/agent";
import { viewRoutes } from "./routes/view";
import { publishRoutes } from "./routes/publish";
import { authRoutes } from "./routes/auth";
import { shareRoutes } from "./routes/share";
import { githubApiRoutes } from "./routes/github-api";
import { FAVICON_PNG_BASE64, LOGO_PNG_BASE64, LOGO_PNG_MIME } from "./brand";

const app = new Hono<{ Bindings: Env; Variables: Vars }>();

// Populate c.var.viewer from the session cookie on every request (non-blocking).
app.use("*", viewerSession);


// Brand assets (inlined PNGs).
app.get("/logo.png", (c) => {
  const bytes = Uint8Array.from(atob(LOGO_PNG_BASE64), (ch) => ch.charCodeAt(0));
  return new Response(bytes, {
    headers: {
      "content-type": LOGO_PNG_MIME,
      "cache-control": "public, max-age=86400",
    },
  });
});
app.get("/favicon.ico", (c) => {
  const bytes = Uint8Array.from(atob(FAVICON_PNG_BASE64), (ch) => ch.charCodeAt(0));
  return new Response(bytes, {
    headers: {
      "content-type": LOGO_PNG_MIME,
      "cache-control": "public, max-age=86400",
    },
  });
});
app.get("/favicon.png", (c) => c.redirect("/logo.png", 302));

// Health + root.
app.get("/", (c) => c.redirect("/gallery"));
app.get("/healthz", (c) => c.json({ ok: true }));

// Route groups.
app.route("/", authRoutes); // /auth/*, /connect/github
app.route("/", agentRoutes); // /auth.md, /.well-known/..., /agent/*, /oauth2/*
app.route("/", publishRoutes); // /api/publish
app.route("/", githubApiRoutes); // /api/github/*
app.route("/", shareRoutes); // /gallery, /share/*
app.route("/", viewRoutes); // /a/:id, /raw/:id

app.notFound((c) => c.json({ error: "not_found" }, 404));
app.onError((err, c) => {
  console.error("worker error:", err);
  return c.json({ error: "internal" }, 500);
});

export default app;
