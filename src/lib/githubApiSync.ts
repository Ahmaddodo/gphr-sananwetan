import { getAllProjectFiles } from "./projectZipExporter";

export interface GitHubPushResult {
  success: boolean;
  message: string;
  commitSha?: string;
  commitUrl?: string;
  workflowTriggered?: boolean;
}

function extractGitHubErrorMessage(errData: any, defaultMsg: string): string {
  if (!errData) return defaultMsg;
  if (typeof errData === "string") return errData;
  
  if (errData.message) {
    let msg = errData.message;
    if (errData.errors && Array.isArray(errData.errors) && errData.errors.length > 0) {
      const details = errData.errors
        .map((e: any) => (typeof e === "string" ? e : e.message || JSON.stringify(e)))
        .join("; ");
      msg += ` (${details})`;
    }
    return msg;
  }
  return defaultMsg;
}

export async function pushProjectToGitHub(
  owner: string,
  repo: string,
  branch: string,
  token: string,
  commitMessage = "Update Form PE GHPR UPT Puskesmas Sananwetan"
): Promise<GitHubPushResult> {
  const cleanToken = token.trim();
  if (!cleanToken) {
    return {
      success: false,
      message: "Personal Access Token (PAT) GitHub wajib diisi untuk melakukan push otomatis."
    };
  }

  const headers = {
    Authorization: `Bearer ${cleanToken}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json"
  };

  try {
    // 1. Verifikasi Repositori
    const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
    if (!repoRes.ok) {
      if (repoRes.status === 401 || repoRes.status === 403) {
        throw new Error("Token GitHub tidak valid atau tidak memiliki izin akses (repo scope). Pastikan PAT memiliki izin 'repo' & 'workflow'.");
      }
      if (repoRes.status === 404) {
        throw new Error(`Repositori ${owner}/${repo} tidak ditemukan. Periksa kembali nama pemilik atau nama repo.`);
      }
      throw new Error(`Gagal menghubungi GitHub API (Status: ${repoRes.status}).`);
    }

    // 2. Ambil referensi branch utama
    let baseCommitSha: string | null = null;
    let baseTreeSha: string | null = null;

    const refRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${branch}`, { headers });
    if (refRes.ok) {
      const refData = await refRes.json();
      baseCommitSha = refData.object.sha;

      // Ambil tree SHA dari commit tersebut
      const commitRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/commits/${baseCommitSha}`, { headers });
      if (commitRes.ok) {
        const commitData = await commitRes.json();
        baseTreeSha = commitData.tree.sha;
      }
    }

    // 3. Siapkan semua file proyek (sudah dibersihkan dari secret / PAT)
    const projectFiles = getAllProjectFiles();
    if (projectFiles.length === 0) {
      throw new Error("Tidak ada file proyek yang dapat disinkronkan.");
    }

    // Buat batch tree
    const treeItems = projectFiles.map((file) => ({
      path: file.path,
      mode: "100644",
      type: "blob",
      content: file.content
    }));

    // 4. Buat Git Tree baru di GitHub (Clean Overwrite: tidak menggunakan base_tree agar seluruh isi repo tertimpa bersih dari awal sampai akhir)
    const treePayload: any = {
      tree: treeItems
    };

    const createTreeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees`, {
      method: "POST",
      headers,
      body: JSON.stringify(treePayload)
    });

    if (!createTreeRes.ok) {
      const errData = await createTreeRes.json().catch(() => ({}));
      throw new Error(extractGitHubErrorMessage(errData, `Gagal membuat tree di GitHub (${createTreeRes.status})`));
    }

    const treeData = await createTreeRes.json();
    const newTreeSha = treeData.sha;

    // 5. Buat Git Commit baru
    const commitPayload: any = {
      message: `${commitMessage} [${new Date().toLocaleString("id-ID")}]`,
      tree: newTreeSha
    };
    if (baseCommitSha) {
      commitPayload.parents = [baseCommitSha];
    }

    const createCommitRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/commits`, {
      method: "POST",
      headers,
      body: JSON.stringify(commitPayload)
    });

    if (!createCommitRes.ok) {
      const errData = await createCommitRes.json().catch(() => ({}));
      throw new Error(extractGitHubErrorMessage(errData, `Gagal membuat commit di GitHub (${createCommitRes.status})`));
    }

    const commitData = await createCommitRes.json();
    const newCommitSha = commitData.sha;

    // 6. Update reference branch (atau buat baru jika belum ada)
    if (baseCommitSha) {
      const updateRefRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          sha: newCommitSha,
          force: true
        })
      });

      if (!updateRefRes.ok) {
        const errData = await updateRefRes.json().catch(() => ({}));
        throw new Error(extractGitHubErrorMessage(errData, `Gagal memperbarui branch ${branch} (${updateRefRes.status})`));
      }
    } else {
      const createRefRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          ref: `refs/heads/${branch}`,
          sha: newCommitSha
        })
      });

      if (!createRefRes.ok) {
        const errData = await createRefRes.json().catch(() => ({}));
        throw new Error(extractGitHubErrorMessage(errData, `Gagal membuat branch ${branch} (${createRefRes.status})`));
      }
    }

    return {
      success: true,
      message: `Kode proyek dan pembaruan pengaturan berhasil di-push ke branch '${branch}' di repositori ${owner}/${repo}!`,
      commitSha: newCommitSha,
      commitUrl: `https://github.com/${owner}/${repo}/commit/${newCommitSha}`,
      workflowTriggered: true
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || "Terjadi kesalahan saat melakukan sinkronisasi ke GitHub."
    };
  }
}
