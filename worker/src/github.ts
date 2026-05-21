// One atomic commit with multiple files via the GitHub Git Data API.
//
// Steps:
//   1. GET refs/heads/<branch>            → current branch SHA
//   2. GET commits/<sha>                  → parent commit + base tree SHA
//   3. POST blobs (one per file)          → blob SHAs
//   4. POST trees (base + new entries)    → new tree SHA
//   5. POST commits                       → new commit SHA
//   6. PATCH refs/heads/<branch>          → fast-forward branch
//
// All requests authenticate with a fine-grained PAT (contents:write).

import type { Env, CommitFile } from './types';

const GH = 'https://api.github.com';

export interface CommitResult {
  commitSha: string;
  commitUrl: string;  // https://github.com/owner/repo/commit/<sha>
}

export async function commitFiles(
  env: Env,
  files: CommitFile[],
  message: string,
): Promise<CommitResult> {
  const repo = env.GITHUB_REPO;
  const branch = env.GITHUB_BRANCH;

  // 1. Current branch ref
  const refData = await gh(env, `/repos/${repo}/git/refs/heads/${branch}`);
  const parentCommitSha = refData.object.sha as string;

  // 2. Parent commit (for base tree SHA)
  const parentCommit = await gh(env, `/repos/${repo}/git/commits/${parentCommitSha}`);
  const baseTreeSha = parentCommit.tree.sha as string;

  // 3. Create blobs for each file in parallel
  const blobShas = await Promise.all(
    files.map(async (f) => {
      const body = f.encoding === 'base64'
        ? { content: bytesToBase64(f.content as Uint8Array), encoding: 'base64' }
        : { content: f.content as string, encoding: 'utf-8' };
      const blob = await gh(env, `/repos/${repo}/git/blobs`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      return { path: f.path, sha: blob.sha as string };
    }),
  );

  // 4. New tree with all the blobs, layered over the parent tree
  const treeBody = {
    base_tree: baseTreeSha,
    tree: blobShas.map(({ path, sha }) => ({
      path,
      mode: '100644',
      type: 'blob',
      sha,
    })),
  };
  const tree = await gh(env, `/repos/${repo}/git/trees`, {
    method: 'POST',
    body: JSON.stringify(treeBody),
  });
  const newTreeSha = tree.sha as string;

  // 5. New commit
  const commit = await gh(env, `/repos/${repo}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({
      message,
      tree: newTreeSha,
      parents: [parentCommitSha],
    }),
  });
  const newCommitSha = commit.sha as string;

  // 6. Fast-forward the branch
  await gh(env, `/repos/${repo}/git/refs/heads/${branch}`, {
    method: 'PATCH',
    body: JSON.stringify({ sha: newCommitSha, force: false }),
  });

  return {
    commitSha: newCommitSha,
    commitUrl: `https://github.com/${repo}/commit/${newCommitSha}`,
  };
}

async function gh(env: Env, path: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(GH + path, {
    ...init,
    headers: {
      'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': 'erli-publish-worker',
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub ${init.method ?? 'GET'} ${path} -> ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

/** Encode Uint8Array → base64 without exceeding stack on large files. */
function bytesToBase64(bytes: Uint8Array): string {
  // btoa(String.fromCharCode(...bytes)) overflows the stack for >~100KB inputs.
  // Chunk through it.
  const CHUNK = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK) as unknown as number[]);
  }
  return btoa(binary);
}
