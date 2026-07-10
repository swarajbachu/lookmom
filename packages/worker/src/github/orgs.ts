/** List GitHub orgs/teams with a user's access token (from WorkOS return tokens). */

const GITHUB_API = "https://api.github.com";

function ghHeaders(accessToken: string): HeadersInit {
  return {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${accessToken}`,
    "user-agent": "lookmom",
    "x-github-api-version": "2022-11-28",
  };
}

export async function listUserOrgs(
  accessToken: string,
): Promise<Array<{ login: string; description: string }>> {
  const out: Array<{ login: string; description: string }> = [];
  let page = 1;
  for (;;) {
    const res = await fetch(`${GITHUB_API}/user/orgs?per_page=100&page=${page}`, {
      headers: ghHeaders(accessToken),
    });
    if (!res.ok) {
      throw new Error(`GitHub /user/orgs failed (${res.status})`);
    }
    const batch = (await res.json()) as Array<{ login: string; description?: string | null }>;
    for (const o of batch) {
      out.push({ login: o.login, description: (o.description ?? "").trim() });
    }
    if (batch.length < 100) break;
    page++;
    if (page > 20) break;
  }
  return out;
}

export async function listOrgTeams(
  accessToken: string,
  org: string,
): Promise<Array<{ slug: string; name: string; description: string }>> {
  const out: Array<{ slug: string; name: string; description: string }> = [];
  let page = 1;
  for (;;) {
    const res = await fetch(
      `${GITHUB_API}/orgs/${encodeURIComponent(org)}/teams?per_page=100&page=${page}`,
      { headers: ghHeaders(accessToken) },
    );
    if (res.status === 404) throw new Error("org_not_found");
    if (!res.ok) throw new Error(`GitHub teams failed (${res.status})`);
    const batch = (await res.json()) as Array<{
      slug: string;
      name: string;
      description?: string | null;
    }>;
    for (const t of batch) {
      out.push({
        slug: t.slug,
        name: t.name,
        description: (t.description ?? "").trim(),
      });
    }
    if (batch.length < 100) break;
    page++;
    if (page > 20) break;
  }
  return out;
}
