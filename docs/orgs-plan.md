# First-class GitHub Orgs in lookmom

> Product plan — org library, member roster, identity-only viewers.

## Goal

1. **Orgs** area lists every connected org.
2. Click an org → **members** (and artifacts).
3. **Share / publish into an org**.
4. Artifacts **live in an org** so any member can view after connecting **personal GitHub only** (no per-person org OAuth/SAML). One linker already connected the org with `read:org`.

## Why not today

- Share is only per-artifact `github_team` + live membership with the **viewer’s** token → every member may need app/SAML approval.
- No org home, no member list, gallery is “mine” only.

## Model

| Piece | Meaning |
| --- | --- |
| **Identity connect** | Any user: GitHub proves `@login` (no `read:org`) |
| **Org link** | One linker: `read:org`, stores token, syncs roster |
| **Org roster** | Snapshot of logins (+ public emails when available) |
| **Org artifact** | `artifacts.org_slug` set → appears in org library |

### Access (viewer)

1. Public / owner / email allowlist  
2. Email or `@login` on **org roster**  
3. Fallback: live membership via **linker token** (not each viewer)  
4. Else deny (clear “ask someone to re-sync the org”)

### UX

```
Nav: Gallery · Orgs · [email] · Log out

/orgs                 list orgs I can see
/orgs/:slug           artifacts + members + sync (linker)
/share · dialog       pick linked org (not free text)
/gallery              mine (+ badges for org)
```

## Phases

| Phase | Deliverable |
| --- | --- |
| **1** | Schema: `github_org_links`, `github_org_members`; sync; gate uses roster + linker fallback |
| **2** | `/orgs` UI, org home, share → linked orgs |
| **3** | Identity-only connect; auto-show orgs from roster intersection |
| **4** | Teams polish, CLI, encrypt tokens, webhooks later |

## Defaults

- Member list visible to anyone who can open the org library  
- Identity scopes: `read:user user:email` (no `read:org`)  
- One primary linker per org (others can re-link)  
- Optional team as hard filter on share  

## Non-goals (v1)

GitHub App install, billing, auto-invite, deep team ACLs.

## Related

- PR #8: OAuth errors, logout, org dropdown, early roster ideas → **evolve to org-level roster**
- Migrate `github_team` + `github_org` → `org_slug` / share mode `org`
