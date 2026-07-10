/** Server-rendered product chrome (Hono JSX). Playful hand-drawn brand UI. */
import type { FC, PropsWithChildren } from "hono/jsx";
import type { Artifact } from "./schema";
import { HAND_FONT_FACE, LOGO_DATA_URI } from "./brand";

/**
 * Design system — paper + forest-green ink (logo palette), hand-drawn
 * radii, sketchy buttons/cards, Patrick Hand, reduced-motion safe.
 */
const STYLE = `${HAND_FONT_FACE}

  :root {
    color-scheme: light;
    --ink: #1f3018;
    --ink-soft: rgba(31, 48, 24, 0.16);
    --fg: #1f3018;
    --fg-2: #3d4f32;
    --muted: #5c6b52;
    --bg: #f3efe4;
    --bg-dots: #d9d3c4;
    --bg-elevated: #fffcf5;
    --surface-2: #f7f1e4;
    --line: #1f3018;
    --accent: #3d6b3a;
    --accent-2: #6b8f5e;
    --accent-3: #c4a35a;
    --accent-soft: rgba(61, 107, 58, 0.12);
    --accent-fg: #fffcf5;
    --danger: #b5403a;
    --danger-soft: rgba(181, 64, 58, 0.1);
    --ok: #3d6b3a;
    --ok-soft: rgba(61, 107, 58, 0.12);
    --radius: 18px;
    --radius-md: 14px;
    --radius-sm: 12px;
    --radius-xs: 10px;
    --shadow-xs: 2px 2px 0 rgba(31, 48, 24, 0.12);
    --shadow-sm: 3px 4px 0 rgba(31, 48, 24, 0.1);
    --shadow-md: 4px 5px 0 rgba(31, 48, 24, 0.14);
    --shadow-ring: 0 0 0 2.5px var(--ink);
    --font: "Patrick Hand", "Segoe Print", "Bradley Hand", "Noteworthy", "Chalkboard SE", "Comic Sans MS", cursive;
    --font-display: "Caveat", "Patrick Hand", "Segoe Print", cursive;
    --mono: "Patrick Hand", ui-monospace, Menlo, monospace;
    --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
    --dur: 160ms;
    --bar-h: 54px;
  }

  *, *::before, *::after { box-sizing: border-box; }
  html { height: 100%; }
  body {
    margin: 0;
    min-height: 100%;
    font: 18px/1.45 var(--font);
    color: var(--fg);
    background-color: var(--bg);
    background-image:
      radial-gradient(ellipse 900px 480px at 8% -8%, rgba(61, 107, 58, 0.1), transparent 55%),
      radial-gradient(ellipse 700px 400px at 100% 0%, rgba(196, 163, 90, 0.12), transparent 50%),
      radial-gradient(var(--bg-dots) 1.15px, transparent 1.15px);
    background-size: auto, auto, 18px 18px;
    -webkit-font-smoothing: antialiased;
  }
  h1, h2, h3 {
    font-family: var(--font-display);
    text-wrap: balance;
    letter-spacing: 0.01em;
    margin: 0;
    font-weight: 700;
    color: var(--ink);
  }
  h1 { font-size: clamp(1.85rem, 3.5vw, 2.35rem); line-height: 1.1; transform: rotate(-0.5deg); }
  h2 { font-size: 1.35rem; line-height: 1.2; }
  p { margin: 0 0 14px; color: var(--muted); max-width: 40rem; }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; text-underline-offset: 3px; text-decoration-style: wavy; }

  .shell { min-height: 100vh; display: flex; flex-direction: column; }
  .shell-main {
    flex: 1;
    width: 100%;
    max-width: 920px;
    margin: 0 auto;
    padding: 36px 18px 64px;
  }
  .shell-main.narrow { max-width: 460px; }
  .shell-main.wide { max-width: 1040px; }
  .wrap {
    width: 100%;
    max-width: 440px;
    margin: 0 auto;
    padding: 48px 20px 64px;
  }

  /* Nav — sketchy paper strip */
  .nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    height: var(--bar-h);
    padding: 0 14px;
    background: color-mix(in srgb, var(--bg-elevated) 92%, transparent);
    border-bottom: 2.5px solid var(--ink);
    position: sticky;
    top: 0;
    z-index: 20;
  }
  .nav-brand {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    color: var(--ink);
    text-decoration: none !important;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 1.35rem;
    letter-spacing: 0.01em;
    transform: rotate(-0.8deg);
  }
  .nav-mark {
    width: 28px;
    height: 28px;
    border-radius: 40% 60% 55% 45% / 55% 40% 60% 45%;
    border: 2px solid var(--ink);
    box-shadow: 2px 2px 0 var(--ink);
    flex-shrink: 0;
    object-fit: cover;
    display: block;
    background: #fff;
  }
  .nav-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
  .nav-meta {
    font-size: 0.95rem;
    color: var(--muted);
    max-width: 180px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Viewer */
  .viewer { display: flex; flex-direction: column; height: 100vh; background: var(--bg); }
  .viewer-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    height: var(--bar-h);
    padding: 0 12px 0 14px;
    background: var(--bg-elevated);
    border-bottom: 2.5px solid var(--ink);
    flex-shrink: 0;
  }
  .viewer-title {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 1.2rem;
  }
  .viewer-title span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .viewer-emoji {
    width: 32px;
    height: 32px;
    display: grid;
    place-items: center;
    border-radius: 40% 60% 50% 50% / 50% 40% 60% 50%;
    background: #fff;
    border: 2px solid var(--ink);
    box-shadow: 2px 2px 0 var(--ink);
    font-size: 16px;
    flex-shrink: 0;
  }
  .viewer-frame {
    flex: 1;
    border: 0;
    width: 100%;
    background: #fff;
    display: block;
  }

  .card {
    background: var(--bg-elevated);
    padding: 26px 24px;
    border: 2.5px solid var(--ink);
    border-radius: 255px 28px 225px 28px / 28px 225px 28px 255px;
    box-shadow: var(--shadow-md);
    position: relative;
  }
  .card::before {
    content: "";
    position: absolute;
    top: -9px;
    left: 22px;
    width: 56px;
    height: 18px;
    background: color-mix(in srgb, var(--accent-3) 55%, #fff);
    opacity: 0.9;
    transform: rotate(-4deg);
    border: 1.5px solid color-mix(in srgb, var(--ink) 30%, transparent);
    pointer-events: none;
  }
  .kicker {
    font-size: 1rem;
    font-weight: 400;
    letter-spacing: 0.04em;
    color: var(--accent);
    margin: 0 0 6px;
    transform: rotate(-1.5deg);
    display: inline-block;
  }
  .lede { margin: 8px 0 0; color: var(--muted); max-width: 36ch; font-size: 1.05rem; }

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    min-height: 38px;
    padding: 0 14px;
    border-radius: 255px 14px 225px 14px / 14px 225px 14px 255px;
    font: inherit;
    font-size: 1.05rem;
    font-weight: 400;
    border: 2.5px solid var(--ink);
    cursor: pointer;
    text-decoration: none !important;
    background: var(--accent);
    color: var(--accent-fg);
    box-shadow: 2px 3px 0 var(--ink);
    transition: transform var(--dur) var(--ease-out), box-shadow var(--dur) ease, background var(--dur) ease;
  }
  .btn:hover {
    transform: translate(-1px, -1px) rotate(-0.8deg);
    box-shadow: 3px 4px 0 var(--ink);
  }
  .btn:active {
    transform: translate(1px, 1px);
    box-shadow: 1px 1px 0 var(--ink);
  }
  .btn:focus-visible {
    outline: 3px dashed var(--accent-2);
    outline-offset: 3px;
  }
  .btn.secondary {
    background: var(--bg-elevated);
    color: var(--ink);
  }
  .btn.secondary:hover { background: #eef5e8; color: var(--ink); }
  .btn.ghost {
    background: transparent;
    color: var(--muted);
    box-shadow: none;
    border-color: transparent;
    min-height: 34px;
  }
  .btn.ghost:hover {
    color: var(--ink);
    background: var(--accent-soft);
    box-shadow: none;
    transform: none;
  }
  .btn.sm { min-height: 34px; padding: 0 12px; font-size: 1rem; }
  .btn:disabled, .btn[disabled] {
    opacity: 0.45;
    cursor: not-allowed;
    transform: none;
  }
  .icon-btn {
    width: 36px;
    height: 36px;
    padding: 0;
    border-radius: 40% 60% 55% 45% / 55% 45% 55% 45%;
    display: inline-grid;
    place-items: center;
    background: var(--bg-elevated);
    border: 2px solid var(--ink);
    color: var(--ink);
    cursor: pointer;
    box-shadow: 2px 2px 0 var(--ink);
    font: inherit;
  }
  .icon-btn:hover { background: #eef5e8; }
  .icon-btn:focus-visible { outline: 3px dashed var(--accent-2); outline-offset: 2px; }

  .row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
  .stack { display: flex; flex-direction: column; gap: 12px; }
  .spacer { flex: 1; }
  .mono {
    font-family: var(--mono);
    font-size: 0.95em;
  }

  .page-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 24px;
  }
  .page-head p { margin: 8px 0 0; }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 14px;
  }
  .art-card {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    border: 2.5px solid var(--ink);
    border-radius: 255px 22px 225px 22px / 22px 225px 22px 255px;
    background: var(--bg-elevated);
    box-shadow: 3px 3px 0 rgba(31, 48, 24, 0.12);
    transition: transform var(--dur) var(--ease-out), box-shadow var(--dur) ease;
    text-decoration: none !important;
    color: inherit;
    min-height: 132px;
  }
  .art-card:nth-child(even) {
    border-radius: 22px 255px 22px 225px / 225px 22px 255px 22px;
    background: var(--surface-2);
    transform: rotate(0.35deg);
  }
  .art-card:nth-child(3n) { transform: rotate(-0.4deg); }
  .art-card:hover {
    transform: translate(-2px, -2px) rotate(-1deg);
    box-shadow: 5px 5px 0 rgba(31, 48, 24, 0.14);
  }
  .art-card:focus-visible {
    outline: 3px dashed var(--accent);
    outline-offset: 3px;
  }
  .art-card-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
  }
  .art-emoji {
    width: 40px;
    height: 40px;
    border-radius: 40% 60% 50% 50% / 55% 40% 60% 45%;
    display: grid;
    place-items: center;
    font-size: 20px;
    background: #fff;
    border: 2px solid var(--ink);
    box-shadow: 2px 2px 0 var(--ink);
  }
  .art-title {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 1.25rem;
    line-height: 1.2;
    color: var(--ink);
  }
  .art-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: auto;
  }
  .badge {
    display: inline-flex;
    align-items: center;
    font-size: 0.95rem;
    color: var(--ink);
    background: #fff;
    border: 2px solid var(--ink);
    border-radius: 999px;
    padding: 2px 10px;
    box-shadow: 1px 1px 0 var(--ink);
    white-space: nowrap;
  }
  .badge.accent {
    background: #e5f0e0;
  }

  .empty {
    text-align: center;
    padding: 44px 22px;
    border: 2.5px dashed var(--ink);
    border-radius: 28px 40px 24px 36px / 36px 24px 40px 28px;
    background: var(--bg-elevated);
    box-shadow: var(--shadow-sm);
  }
  .empty h2 { margin-bottom: 8px; transform: rotate(-1deg); }
  .empty p { margin: 0 auto 16px; max-width: 30ch; }
  .empty .mono {
    display: inline-block;
    padding: 8px 12px;
    border: 2px solid var(--ink);
    border-radius: 12px 18px 14px 16px / 16px 12px 18px 14px;
    background: #fff;
    box-shadow: 2px 2px 0 var(--ink);
    color: var(--fg-2);
    font-size: 1rem;
  }

  .err {
    color: var(--danger);
    background: var(--danger-soft);
    border: 2px solid color-mix(in srgb, var(--danger) 40%, var(--ink));
    font-size: 1rem;
    margin: 0 0 14px;
    padding: 10px 12px;
    border-radius: 14px 20px 12px 18px / 18px 12px 20px 14px;
  }
  .ok {
    color: var(--ok);
    background: var(--ok-soft);
    border: 2px solid color-mix(in srgb, var(--ok) 40%, var(--ink));
    font-size: 1rem;
    margin: 0 0 14px;
    padding: 10px 12px;
    border-radius: 14px 20px 12px 18px / 18px 12px 20px 14px;
  }
  input.code {
    font-family: var(--mono);
    font-size: 1.35rem;
    letter-spacing: 0.12em;
    padding: 12px 14px;
    width: 100%;
    border: 2.5px solid var(--ink);
    border-radius: 16px 22px 14px 20px / 20px 14px 22px 16px;
    background: #fff;
    color: var(--fg);
    text-align: center;
    text-transform: uppercase;
    box-shadow: 2px 2px 0 var(--ink);
  }
  input.code:focus, input.text:focus, textarea.text:focus {
    outline: none;
    box-shadow: 3px 3px 0 var(--ink);
  }
  input.text, textarea.text {
    font: inherit;
    font-size: 1.05rem;
    padding: 10px 12px;
    width: 100%;
    border: 2.5px solid var(--ink);
    border-radius: 12px 18px 14px 16px / 16px 12px 18px 14px;
    background: #fff;
    color: var(--fg);
    box-shadow: 2px 2px 0 rgba(31, 48, 24, 0.08);
  }
  textarea.text { min-height: 88px; resize: vertical; line-height: 1.4; }
  label.field {
    display: block;
    margin: 12px 0 0;
    font-size: 1rem;
    color: var(--muted);
  }
  label.field > input, label.field > textarea { margin-top: 6px; }

  label.share-opt {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    margin: 0;
    padding: 12px;
    border: 2.5px solid var(--ink);
    border-radius: 16px 24px 14px 22px / 22px 14px 24px 16px;
    cursor: pointer;
    background: #fff;
    box-shadow: 2px 2px 0 rgba(31, 48, 24, 0.08);
    transition: background var(--dur) ease, transform var(--dur) var(--ease-out);
  }
  label.share-opt + label.share-opt { margin-top: 8px; }
  label.share-opt:hover { background: #f7fbf4; transform: rotate(-0.3deg); }
  label.share-opt:has(input:checked) {
    background: #e5f0e0;
    box-shadow: 3px 3px 0 var(--ink);
  }
  label.share-opt:has(input:disabled) { opacity: 0.5; cursor: not-allowed; }
  label.share-opt input {
    margin-top: 4px;
    width: 16px;
    height: 16px;
    accent-color: var(--accent);
    flex-shrink: 0;
  }
  label.share-opt strong {
    display: block;
    color: var(--ink);
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 1.15rem;
  }
  label.share-opt .hint {
    display: block;
    font-size: 0.95rem;
    color: var(--muted);
    margin-top: 2px;
    line-height: 1.35;
  }

  .callout {
    padding: 14px;
    border: 2px dashed var(--ink);
    border-radius: 16px 24px 14px 22px / 22px 14px 24px 16px;
    background: #fff9e8;
  }
  .callout strong {
    color: var(--ink);
    font-family: var(--font-display);
    font-size: 1.15rem;
  }
  .callout p { margin: 6px 0 0; font-size: 1rem; max-width: none; }
  .section-label {
    display: block;
    font-family: var(--font-display);
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--muted);
    margin: 0 0 10px;
    transform: rotate(-0.5deg);
  }
  .link-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-family: var(--mono);
    font-size: 0.95rem;
    color: var(--fg-2);
    background: #fff;
    padding: 7px 10px;
    border: 2px solid var(--ink);
    border-radius: 10px 16px 12px 14px / 14px 10px 16px 12px;
    box-shadow: 2px 2px 0 rgba(31, 48, 24, 0.1);
    word-break: break-all;
    max-width: 100%;
    text-decoration: none !important;
  }
  .link-chip:hover { color: var(--accent); text-decoration: none; }
  .footer-note {
    margin-top: 22px;
    font-size: 1rem;
    color: var(--muted);
    transform: rotate(-0.3deg);
  }

  dialog.modal {
    border: 2.5px solid var(--ink);
    padding: 0;
    border-radius: 28px 40px 24px 36px / 36px 24px 40px 28px;
    background: var(--bg-elevated);
    color: var(--fg);
    box-shadow: 6px 8px 0 rgba(31, 48, 24, 0.16);
    width: min(420px, calc(100vw - 32px));
    max-height: min(88vh, 720px);
    overflow: auto;
  }
  dialog.modal::backdrop {
    background: rgba(31, 48, 24, 0.28);
  }
  .modal-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 16px 16px 0;
  }
  .modal-body { padding: 12px 16px 18px; }
  .modal-foot {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 0 16px 16px;
  }
  .copy-row {
    display: flex;
    gap: 8px;
    align-items: stretch;
    margin-bottom: 16px;
  }
  .copy-row input {
    flex: 1;
    min-width: 0;
    font-family: var(--mono);
    font-size: 0.95rem;
  }
  .divider {
    height: 0;
    border: 0;
    border-top: 2px dashed var(--ink-soft);
    margin: 18px 0;
  }

  @media (hover: none) {
    .btn:hover, .art-card:hover {
      transform: none;
      box-shadow: 2px 3px 0 var(--ink);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      transition-duration: 0.01ms !important;
      animation-duration: 0.01ms !important;
    }
    h1, .nav-brand, .kicker, .art-card, .footer-note { transform: none !important; }
  }
  @media (max-width: 560px) {
    .shell-main { padding: 24px 14px 48px; }
    .card { padding: 20px 16px; }
    .nav-meta { display: none; }
    .page-head { flex-direction: column; }
    body { font-size: 17px; }
  }
`;

const SHARE_SCRIPT = `
(function () {
  var dlg = document.getElementById('share-dialog');
  var openBtn = document.getElementById('share-open');
  var closeBtns = document.querySelectorAll('[data-close-share]');
  var copyBtn = document.getElementById('copy-link');
  var linkInput = document.getElementById('share-link');
  if (openBtn && dlg) {
    openBtn.addEventListener('click', function () {
      if (typeof dlg.showModal === 'function') dlg.showModal();
      else dlg.setAttribute('open', '');
    });
  }
  closeBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      if (dlg && typeof dlg.close === 'function') dlg.close();
      else if (dlg) dlg.removeAttribute('open');
    });
  });
  if (copyBtn && linkInput) {
    copyBtn.addEventListener('click', function () {
      var v = linkInput.value;
      function done() {
        var t = copyBtn.textContent;
        copyBtn.textContent = 'Copied';
        setTimeout(function () { copyBtn.textContent = t; }, 1200);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(v).then(done).catch(function () {
          linkInput.select();
          try { document.execCommand('copy'); done(); } catch (e) {}
        });
      } else {
        linkInput.select();
        try { document.execCommand('copy'); done(); } catch (e) {}
      }
    });
  }
  // Open dialog when redirected back with ?shared=1
  if (dlg && /[?&]shared=1\\b/.test(location.search)) {
    if (typeof dlg.showModal === 'function') dlg.showModal();
  }
})();
`;

export const Layout: FC<
  PropsWithChildren<{
    title: string;
    bare?: boolean;
    navRight?: unknown;
  }>
> = ({ title, children, bare }) => (
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta name="color-scheme" content="light dark" />
      <title>{title}</title>
      <link rel="icon" href="/logo.png" type="image/png" />
      <link rel="apple-touch-icon" href="/logo.png" />
      <style dangerouslySetInnerHTML={{ __html: STYLE }} />
    </head>
    <body class={bare ? undefined : "shell"}>{children}</body>
  </html>
);

function AppNav(props: { email?: string; right?: "gallery" | "none" }) {
  return (
    <header class="nav">
      <a class="nav-brand" href="/gallery">
        <img class="nav-mark" src={LOGO_DATA_URI} width={28} height={28} alt="lookmom" />
        lookmom
      </a>
      <div class="nav-actions">
        {props.email ? <span class="nav-meta mono">{props.email}</span> : null}
        {props.right === "gallery" ? (
          <a class="btn secondary sm" href="/gallery">
            Gallery
          </a>
        ) : null}
      </div>
    </header>
  );
}

export const LoginPrompt: FC<{
  title: string;
  loginUrl: string;
  githubLoginUrl?: string;
  teamShare?: boolean;
  message?: string;
}> = ({ title, loginUrl, githubLoginUrl, teamShare, message }) => (
  <Layout title="Sign in · lookmom">
    <AppNav />
    <main class="shell-main narrow">
      <div class="card">
        <p class="kicker">Private artifact</p>
        <h1>Sign in to view</h1>
        <p style="margin-top:8px">
          {message ??
            (teamShare
              ? `“${title}” is shared with a GitHub team. Sign in with GitHub to check membership.`
              : `“${title}” is private. Sign in so we can check whether you have access.`)}
        </p>
        <div class="row" style="margin-top:20px">
          {githubLoginUrl ? (
            <a class="btn" href={githubLoginUrl}>
              Continue with GitHub
            </a>
          ) : null}
          {!teamShare || !githubLoginUrl ? (
            <a class={githubLoginUrl ? "btn secondary" : "btn"} href={loginUrl}>
              Continue
            </a>
          ) : (
            <a class="btn secondary" href={loginUrl}>
              Other sign-in
            </a>
          )}
        </div>
      </div>
    </main>
  </Layout>
);

export const AccessDenied: FC<{
  email: string;
  switchUrl: string;
  message?: string;
}> = ({ email, switchUrl, message }) => (
  <Layout title="No access · lookmom">
    <AppNav email={email} />
    <main class="shell-main narrow">
      <div class="card">
        <p class="kicker">Access</p>
        <h1>You don’t have access</h1>
        <p style="margin-top:8px">
          {message ??
            `You’re signed in as ${email}, which isn’t on this artifact’s allowlist. Ask the owner to add you, or switch accounts.`}
        </p>
        <p style="margin-bottom:18px">
          Account: <span class="mono">{email}</span>
        </p>
        <a class="btn secondary" href={switchUrl}>
          Use a different account
        </a>
      </div>
    </main>
  </Layout>
);

export const GithubNotConfigured: FC = () => (
  <Layout title="GitHub not configured · lookmom">
    <AppNav />
    <main class="shell-main narrow">
      <div class="card">
        <p class="kicker">Configuration</p>
        <h1>GitHub share unavailable</h1>
        <p style="margin-top:8px">
          This artifact is shared with a GitHub organization, but this lookmom
          instance has no GitHub login configured. The operator needs WorkOS
          with GitHub OAuth (return tokens + <span class="mono">read:org</span>
          ), or <span class="mono">GITHUB_CLIENT_ID</span> /{" "}
          <span class="mono">GITHUB_CLIENT_SECRET</span>.
        </p>
      </div>
    </main>
  </Layout>
);

function shareModeLabel(mode: string): string {
  if (mode === "github_team") return "Org";
  if (mode === "allowlist") return "People";
  if (mode === "public") return "Public";
  return "Private";
}

/** Gate chrome: floating bar + optional share dialog + sandboxed iframe. */
export const ArtifactFrame: FC<{
  id: string;
  title: string;
  emoji: string;
  rawUrl: string;
  canShare: boolean;
  shareUrl: string;
  viewUrl: string;
  shareMode?: string;
  githubOrg?: string | null;
  githubTeam?: string | null;
  githubConnected?: boolean;
  githubAvailable?: boolean;
  connectUrl?: string;
}> = ({
  id,
  title,
  emoji,
  rawUrl,
  canShare,
  shareUrl,
  viewUrl,
  shareMode = "private",
  githubOrg,
  githubTeam,
  githubConnected,
  githubAvailable,
  connectUrl,
}) => (
  <Layout title={`${emoji} ${title}`} bare>
    <div class="viewer">
      <header class="viewer-bar">
        <div class="viewer-title">
          <span class="viewer-emoji" aria-hidden="true">
            {emoji || "📄"}
          </span>
          <span>{title}</span>
        </div>
        <div class="row">
          <a class="btn ghost sm" href="/gallery">
            Gallery
          </a>
          {canShare ? (
            <>
              <button type="button" class="btn secondary sm" id="share-open">
                Share
              </button>
              <a class="btn ghost sm" href={shareUrl}>
                Full page
              </a>
            </>
          ) : null}
        </div>
      </header>

      <iframe class="viewer-frame" src={rawUrl} sandbox="allow-scripts allow-popups allow-downloads" title={title} />

      {canShare ? (
        <dialog class="modal" id="share-dialog" aria-labelledby="share-dialog-title">
          <div class="modal-head">
            <div>
              <p class="kicker" style="margin:0">Share</p>
              <h2 id="share-dialog-title">{title}</h2>
            </div>
            <button type="button" class="icon-btn" data-close-share aria-label="Close">
              ✕
            </button>
          </div>
          <div class="modal-body">
            <div class="copy-row">
              <input class="text" id="share-link" readonly value={viewUrl} aria-label="Artifact link" />
              <button type="button" class="btn secondary sm" id="copy-link">
                Copy
              </button>
            </div>

            <form method="post" action={`/share/${id}/mode`}>
              <input type="hidden" name="return_to" value={`/a/${id}?shared=1`} />
              <span class="section-label">Who can view</span>

              <label class="share-opt">
                <input type="radio" name="mode" value="private" checked={shareMode === "private"} />
                <span>
                  <strong>Only me</strong>
                  <span class="hint">Private — just your account</span>
                </span>
              </label>
              <label class="share-opt">
                <input type="radio" name="mode" value="allowlist" checked={shareMode === "allowlist"} />
                <span>
                  <strong>Specific people</strong>
                  <span class="hint">Emails you add below</span>
                </span>
              </label>
              <label class="share-opt">
                <input type="radio" name="mode" value="public" checked={shareMode === "public"} />
                <span>
                  <strong>Anyone with the link</strong>
                  <span class="hint">Public — no sign-in to view</span>
                </span>
              </label>
              <label class="share-opt">
                <input
                  type="radio"
                  name="mode"
                  value="github_team"
                  checked={shareMode === "github_team"}
                  disabled={!githubAvailable}
                />
                <span>
                  <strong>GitHub organization</strong>
                  <span class="hint">Org or team members (GitHub sign-in)</span>
                </span>
              </label>

              {!githubAvailable ? (
                <p class="err" style="margin-top:12px">
                  GitHub org share isn’t configured on this instance.
                </p>
              ) : !githubConnected ? (
                <div class="callout" style="margin-top:12px">
                  <strong>Connect GitHub</strong>
                  <p>Needed once for org membership checks.</p>
                  {connectUrl ? (
                    <div class="row" style="margin-top:10px">
                      <a class="btn sm" href={connectUrl}>
                        Connect GitHub
                      </a>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div class="callout" style="margin-top:12px">
                  <strong>Organization</strong>
                  <label class="field">
                    Org slug
                    <input class="text" name="github_org" placeholder="acme" value={githubOrg ?? ""} autocomplete="off" />
                  </label>
                  <label class="field">
                    Team (optional)
                    <input class="text" name="github_team" placeholder="eng" value={githubTeam ?? ""} autocomplete="off" />
                  </label>
                </div>
              )}

              <div class="modal-foot" style="padding:16px 0 0">
                <button type="button" class="btn ghost" data-close-share>
                  Cancel
                </button>
                <button class="btn" type="submit">
                  Save
                </button>
              </div>
            </form>

            <hr class="divider" />

            <form method="post" action={`/share/${id}/allow`}>
              <input type="hidden" name="return_to" value={`/a/${id}?shared=1`} />
              <span class="section-label">Add emails</span>
              <textarea class="text" name="emails" placeholder="alice@example.com, bob@example.com" aria-label="Emails" />
              <div class="row" style="margin-top:10px;justify-content:flex-end">
                <button class="btn secondary sm" type="submit">
                  Add emails
                </button>
              </div>
            </form>
          </div>
        </dialog>
      ) : null}

      <script dangerouslySetInnerHTML={{ __html: SHARE_SCRIPT }} />
    </div>
  </Layout>
);

export const Gallery: FC<{
  email: string;
  artifacts: Artifact[];
  host: string;
  githubLogin?: string;
}> = ({ email, artifacts, host, githubLogin }) => (
  <Layout title="Your artifacts · lookmom">
    <AppNav email={email} />
    <main class="shell-main wide">
      <div class="page-head">
        <div>
          <p class="kicker">Library</p>
          <h1>Your artifacts</h1>
          <p class="lede">
            Signed in as <span class="mono">{email}</span>
            {githubLogin ? (
              <>
                {" "}
                · <span class="mono">@{githubLogin}</span>
              </>
            ) : null}
          </p>
        </div>
        <a class="btn secondary" href="/connect/github?return_to=/gallery">
          {githubLogin ? "GitHub" : "Connect GitHub"}
        </a>
      </div>

      {artifacts.length === 0 ? (
        <div class="empty">
          <h2>Nothing here yet</h2>
          <p>Publish from your agent or terminal, then it shows up here.</p>
          <span class="mono">lookmom publish ./artifact</span>
        </div>
      ) : (
        <div class="grid">
          {artifacts.map((a) => (
            <a class="art-card" href={`${host}/a/${a.id}`}>
              <div class="art-card-top">
                <span class="art-emoji" aria-hidden="true">
                  {a.emoji || "📄"}
                </span>
                <span class="badge">v{a.currentVersion}</span>
              </div>
              <div class="art-title">{a.title}</div>
              <div class="art-meta">
                <span class="badge accent">{shareModeLabel(a.shareMode)}</span>
                {a.shareMode === "github_team" && a.githubOrg ? (
                  <span class="badge">
                    {a.githubTeam ? `${a.githubOrg}/${a.githubTeam}` : a.githubOrg}
                  </span>
                ) : null}
              </div>
            </a>
          ))}
        </div>
      )}

      <p class="footer-note">
        Tip: open an artifact and use <strong style="color:var(--fg);font-weight:600">Share</strong> for a quick dialog —
        or visit the full share page when agents send you there.
      </p>
    </main>
  </Layout>
);

export const ConfirmAgent: FC<{
  email: string;
  prefill?: string;
  error?: string;
  success?: boolean;
}> = ({ email, prefill, error, success }) => (
  <Layout title="Authorize agent · lookmom">
    <AppNav email={email} right="gallery" />
    <main class="shell-main narrow">
      <div class="card">
        <p class="kicker">Device</p>
        <h1>Authorize publishing</h1>
        {success ? (
          <p class="ok" style="margin-top:14px">
            Authorized. You can return to your agent — it can publish now.
          </p>
        ) : (
          <>
            <p style="margin-top:8px">
              Signed in as <span class="mono">{email}</span>. Enter the code your agent
              showed you.
            </p>
            {error ? <p class="err">{error}</p> : null}
            <form method="post" action="/agent/confirm">
              <input
                class="code"
                name="user_code"
                placeholder="XXXX-XXXX"
                value={prefill ?? ""}
                autocomplete="off"
                maxlength={9}
                required
                aria-label="Authorization code"
              />
              <div class="row" style="margin-top:16px">
                <button class="btn" type="submit">
                  Authorize
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </main>
  </Layout>
);
