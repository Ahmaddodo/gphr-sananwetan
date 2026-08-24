import JSZip from "jszip";
import { saveAs } from "file-saver";
import {
  DEFAULT_SPREADSHEET_ID,
  DEFAULT_SPREADSHEET_URL,
  DEFAULT_SPREADSHEET_TITLE,
  DEFAULT_WEB_APP_URL,
  getSavedSheetConfig,
  getLocalSubmissionHistory
} from "./googleSheets";
import {
  getOfficerProfiles,
  getAllPatients
} from "./patientMonitoring";
import { getSavedGitHubConfig } from "../components/GitHubSyncManager";

export interface ProjectFileEntry {
  path: string;
  content: string;
}

export function getAllProjectFiles(): ProjectFileEntry[] {
  const files: ProjectFileEntry[] = [];

  try {
    // Ambil seluruh file di src secara mendalam
    const srcModules = import.meta.glob(
      [
        "/src/**/*.{ts,tsx,css,json,svg}",
        "../**/*.{ts,tsx,css,json,svg}",
        "./**/*.{ts,tsx,css,json,svg}"
      ],
      { query: "?raw", import: "default", eager: true }
    );

    for (const [key, val] of Object.entries(srcModules || {})) {
      if (typeof val === "string") {
        let p = key.replace(/\\/g, "/");
        if (p.startsWith("/src/")) {
          p = p.substring(1);
        } else if (p.startsWith("../")) {
          p = "src/" + p.substring(3);
        } else if (p.startsWith("./")) {
          p = "src/lib/" + p.substring(2);
        }
        p = p.replace(/\/\.\//g, "/").replace(/\/+/g, "/");
        if (!p.startsWith("src/") && !p.startsWith(".") && !p.includes("/")) {
          p = "src/" + p;
        }

        // Hindari path duplikat
        if (!files.some(f => f.path === p)) {
          files.push({
            path: p,
            content: val
          });
        }
      }
    }
  } catch (e) {
    console.warn("Gagal mengekstrak file proyek via glob:", e);
  }

  // Fallback jaminan jika src/main.tsx belum ada di list
  if (!files.some(f => f.path === "src/main.tsx")) {
    files.push({
      path: "src/main.tsx",
      content: `import { StrictMode } from 'react';\nimport { createRoot } from 'react-dom/client';\nimport App from './App.tsx';\nimport './index.css';\n\ncreateRoot(document.getElementById('root')!).render(\n  <StrictMode>\n    <App />\n  </StrictMode>,\n);\n`
    });
  }

  // Fallback jaminan jika src/lib/projectZipExporter.ts tidak terbaca karena eager self-reference di Vite
  const selfExporterIndex = files.findIndex(f => f.path === "src/lib/projectZipExporter.ts");
  const fallbackProjectZipExporterContent = `import JSZip from "jszip";
import { saveAs } from "file-saver";
import {
  DEFAULT_SPREADSHEET_ID,
  DEFAULT_SPREADSHEET_URL,
  DEFAULT_SPREADSHEET_TITLE,
  DEFAULT_WEB_APP_URL,
  getSavedSheetConfig,
  getLocalSubmissionHistory
} from "./googleSheets";
import {
  getOfficerProfiles,
  getAllPatients
} from "./patientMonitoring";
import { getSavedGitHubConfig } from "../components/GitHubSyncManager";

export interface ProjectFileEntry {
  path: string;
  content: string;
}

export function getAllProjectFiles(): ProjectFileEntry[] {
  const files: ProjectFileEntry[] = [];
  try {
    const srcModules = import.meta.glob(
      [
        "/src/**/*.{ts,tsx,css,json,svg}",
        "../**/*.{ts,tsx,css,json,svg}",
        "./**/*.{ts,tsx,css,json,svg}"
      ],
      { query: "?raw", import: "default", eager: true }
    );
    for (const [key, val] of Object.entries(srcModules || {})) {
      if (typeof val === "string") {
        let p = key.replace(/\\\\/g, "/");
        if (p.startsWith("/src/")) p = p.substring(1);
        else if (p.startsWith("../")) p = "src/" + p.substring(3);
        else if (p.startsWith("./")) p = "src/lib/" + p.substring(2);
        p = p.replace(/\\/\\.\\//g, "/").replace(/\\/+/g, "/");
        if (!files.some(f => f.path === p)) {
          files.push({ path: p, content: val });
        }
      }
    }
  } catch (e) {
    console.warn("Gagal mengekstrak file via glob:", e);
  }
  return files;
}

export async function exportProjectAsZip(filename = "form-pe-ghpr-sananwetan-source.zip"): Promise<void> {
  const zip = new JSZip();
  const files = getAllProjectFiles();
  for (const file of files) {
    zip.file(file.path, file.content);
  }
  const blob = await zip.generateAsync({ type: "blob" });
  saveAs(blob, filename);
}
`;

  if (selfExporterIndex >= 0) {
    if (!files[selfExporterIndex].content || files[selfExporterIndex].content.length < 50) {
      files[selfExporterIndex].content = fallbackProjectZipExporterContent;
    }
  } else {
    files.push({
      path: "src/lib/projectZipExporter.ts",
      content: fallbackProjectZipExporterContent
    });
  }

  // =========================================================================
  // 0. PASTIKAN SELURUH FILE ROOT UTAMA (PACKAGE.JSON, INDEX.HTML, VITE.CONFIG.TS, DSB) SELALU ADA & LENGKAP
  // =========================================================================
  const standardViteConfig = `import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  const base = process.env.BASE_URL || '/ghpr-sananwetan/';
  return {
    base,
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [
          'favicon.ico',
          'favicon.svg',
          'favicon.png',
          'apple-touch-icon.png',
          'pwa-192x192.png',
          'pwa-512x512.png',
          'icon-192.png',
          'icon-512.png',
          'maskable-icon-512.png'
        ],
        manifest: {
          name: 'GHPR UPT Puskesmas Sananwetan',
          short_name: 'GHPR Sananwetan',
          description: 'pe ghpr upt puskesmas sananwetan',
          theme_color: '#16a34a',
          background_color: '#ffffff',
          display: 'standalone',
          scope: base,
          start_url: base,
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ]
        },
        workbox: {
          maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          navigateFallback: 'index.html',
          runtimeCaching: [
            {
              urlPattern: /^https:\\/\\/script\\.google\\.com\\/macros\\/s\\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'google-sheets-api-cache',
                networkTimeoutSeconds: 4,
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 24 * 60 * 60
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            {
              urlPattern: /^https:\\/\\/fonts\\.(googleapis|gstatic)\\.com\\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 30,
                  maxAgeSeconds: 365 * 24 * 60 * 60
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            }
          ]
        }
      })
    ],
    build: {
      chunkSizeWarningLimit: 3000,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            icons: ['lucide-react'],
            pdf: ['jspdf', 'html2canvas']
          }
        }
      }
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
`;

  const standardPackageJson = JSON.stringify(
    {
      name: "form-ghpr-sananwetan",
      private: true,
      version: "1.0.0",
      type: "module",
      scripts: {
        dev: "vite --port=3000 --host=0.0.0.0",
        build: "vite build",
        preview: "vite preview",
        lint: "tsc --noEmit"
      },
      dependencies: {
        "@google/genai": "^2.4.0",
        "@tailwindcss/vite": "^4.1.14",
        "@vitejs/plugin-react": "^5.0.4",
        "dotenv": "^17.2.3",
        "express": "^4.21.2",
        "file-saver": "^2.0.5",
        "html2canvas": "^1.4.1",
        "html2canvas-pro": "^2.3.9",
        "html2pdf.js": "^0.14.0",
        "jspdf": "^4.2.1",
        "jszip": "^3.10.1",
        "lucide-react": "^0.546.0",
        "motion": "^12.23.24",
        "react": "^19.0.1",
        "react-dom": "^19.0.1",
        "vite": "^6.2.3",
        "vite-plugin-pwa": "^1.3.0"
      },
      devDependencies: {
        "@types/express": "^4.17.21",
        "@types/file-saver": "^2.0.7",
        "@types/node": "^22.14.0",
        "@types/react": "^19.2.18",
        "@types/react-dom": "^19.2.4",
        "autoprefixer": "^10.4.21",
        "esbuild": "^0.25.0",
        "tailwindcss": "^4.1.14",
        "tsx": "^4.21.0",
        "typescript": "~5.8.2",
        "vite": "^6.2.3"
      }
    },
    null,
    2
  );

  const standardIndexHtml = `<!doctype html>
<html lang="id">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
    <title>Form GHPR Sananwetan - UPT Puskesmas Sananwetan</title>
    <meta name="description" content="Form Penyelidikan Epidemiologi & Pemantauan Kasus Gigitan Hewan Penular Rabies UPT Puskesmas Sananwetan Kota Blitar" />
    <meta name="theme-color" content="#16a34a" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="GHPR Sananwetan" />
    <meta name="application-name" content="GHPR Sananwetan" />
    <meta name="msapplication-TileColor" content="#16a34a" />
    <meta name="msapplication-navbutton-color" content="#16a34a" />
    <meta name="format-detection" content="telephone=no" />
    <link rel="manifest" href="/ghpr-sananwetan/manifest.webmanifest" />
    <link rel="icon" type="image/svg+xml" href="/ghpr-sananwetan/favicon.svg" />
    <link rel="icon" type="image/png" sizes="192x192" href="/ghpr-sananwetan/pwa-192x192.png" />
    <link rel="apple-touch-icon" href="/ghpr-sananwetan/pwa-192x192.png" />
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&family=Dancing+Script:wght@600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
    <script src="https://accounts.google.com/gsi/client" async defer></script>
  </head>
  <body class="bg-slate-50 text-slate-900 selection:bg-sky-500 selection:text-white">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;

  const standardTsConfig = JSON.stringify(
    {
      compilerOptions: {
        target: "ES2022",
        experimentalDecorators: true,
        useDefineForClassFields: false,
        module: "ESNext",
        lib: ["ES2022", "DOM", "DOM.Iterable"],
        skipLibCheck: true,
        moduleResolution: "bundler",
        isolatedModules: true,
        moduleDetection: "force",
        allowJs: true,
        jsx: "react-jsx",
        paths: {
          "@/*": ["./*"]
        },
        allowImportingTsExtensions: true,
        noEmit: true
      }
    },
    null,
    2
  );

  const standardGitignore = `node_modules
dist
dist-ssr
*.local
.env
.env.*
.DS_Store
`;

  const standardReadme = `# Form Penyelidikan Epidemiologi GHPR - UPT Puskesmas Sananwetan

Aplikasi Penyelidikan Epidemiologi Kasus Gigitan Hewan Penular Rabies (GHPR) dan Pemantauan Pasien 14 Hari di Wilayah Kerja UPT Puskesmas Sananwetan Kota Blitar.

## Fitur Utama
- Formulir PE GHPR Standar Kemenkes RI (Multi-step & Auto-save)
- Dashboard Pemantauan Harian Pasien Rabies (14 Hari)
- Manajemen Akun Petugas Wilayah & Koordinator
- Sinkronisasi Cloud Google Sheets & GitHub Pages Otomatis
- Ekspor PDF Legal & Form Cetak Langsung
`;

  // Set / Replace Root Files
  const setOrAddFile = (path: string, content: string) => {
    const idx = files.findIndex(f => f.path === path);
    if (idx >= 0) {
      files[idx].content = content;
    } else {
      files.push({ path, content });
    }
  };

  const standardManifestJson = JSON.stringify(
    {
      id: "ghpr-sananwetan-app",
      name: "Form GHPR Sananwetan",
      short_name: "GHPR",
      description: "Sistem Informasi Penyelidikan Epidemiologi & Pemantauan Kasus Gigitan Hewan Penular Rabies UPT Puskesmas Sananwetan Kota Blitar",
      start_url: "./",
      scope: "./",
      display: "standalone",
      display_override: [
        "standalone",
        "window-controls-overlay",
        "minimal-ui",
        "browser"
      ],
      background_color: "#ffffff",
      theme_color: "#0284c7",
      orientation: "portrait",
      lang: "id",
      dir: "ltr",
      categories: ["medical", "health", "productivity"],
      icons: [
        {
          src: "icon-192.png",
          sizes: "192x192",
          type: "image/png",
          purpose: "any"
        },
        {
          src: "logo.png",
          sizes: "192x192",
          type: "image/png",
          purpose: "any"
        },
        {
          src: "icon-512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "any"
        },
        {
          src: "logo.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "any"
        },
        {
          src: "maskable-icon-512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable"
        },
        {
          src: "icon-512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable"
        },
        {
          src: "logo.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable"
        }
      ]
    },
    null,
    2
  );

  setOrAddFile("package.json", standardPackageJson);
  setOrAddFile("index.html", standardIndexHtml);
  setOrAddFile("tsconfig.json", standardTsConfig);
  setOrAddFile("vite.config.ts", standardViteConfig);
  setOrAddFile(".gitignore", standardGitignore);
  setOrAddFile("README.md", standardReadme);

  // =========================================================================
  // 1. INJEKSI PENGATURAN TERBARU KE src/lib/googleSheets.ts
  // =========================================================================
  try {
    const currentSheetConfig = getSavedSheetConfig();
    let currentWebAppUrl = DEFAULT_WEB_APP_URL;
    if (typeof window !== "undefined") {
      try {
        const savedUrl = localStorage.getItem("ghpr_google_sheets_url_v1") || localStorage.getItem("ghpr_gas_url_v2");
        if (savedUrl && savedUrl.trim() && savedUrl.startsWith("http")) {
          currentWebAppUrl = savedUrl.trim();
        }
      } catch (e) {}
    }

    const gsIndex = files.findIndex((f) => f.path === "src/lib/googleSheets.ts" || f.path.endsWith("googleSheets.ts"));
    if (gsIndex >= 0) {
      let gsContent = files[gsIndex].content;

      // Update DEFAULT_WEB_APP_URL
      gsContent = gsContent.replace(
        /export const DEFAULT_WEB_APP_URL\s*=\s*["'][^"']+["'];/g,
        `export const DEFAULT_WEB_APP_URL =\n  "${currentWebAppUrl}";`
      );

      // Update DEFAULT_SPREADSHEET_ID
      if (currentSheetConfig?.spreadsheetId) {
        gsContent = gsContent.replace(
          /export const DEFAULT_SPREADSHEET_ID\s*=\s*["'][^"']+["'];/g,
          `export const DEFAULT_SPREADSHEET_ID = "${currentSheetConfig.spreadsheetId}";`
        );
      }

      // Update DEFAULT_SPREADSHEET_URL
      if (currentSheetConfig?.spreadsheetUrl) {
        gsContent = gsContent.replace(
          /export const DEFAULT_SPREADSHEET_URL\s*=\s*`[^`]+`;/g,
          `export const DEFAULT_SPREADSHEET_URL = "${currentSheetConfig.spreadsheetUrl}";`
        );
      }

      // Update DEFAULT_SPREADSHEET_TITLE
      if (currentSheetConfig?.spreadsheetTitle) {
        gsContent = gsContent.replace(
          /export const DEFAULT_SPREADSHEET_TITLE\s*=\s*["'][^"']+["'];/g,
          `export const DEFAULT_SPREADSHEET_TITLE = "${currentSheetConfig.spreadsheetTitle}";`
        );
      }

      files[gsIndex].content = gsContent;
    }
  } catch (err) {
    console.warn("Gagal menyuntikkan update googleSheets.ts:", err);
  }

  // =========================================================================
  // 2. INJEKSI AKUN PETUGAS & DATA PASIEN TERBARU KE src/lib/patientMonitoring.ts
  // =========================================================================
  try {
    const latestOfficers = getOfficerProfiles();
    const latestPatients = getAllPatients();

    const pmIndex = files.findIndex((f) => f.path === "src/lib/patientMonitoring.ts" || f.path.endsWith("patientMonitoring.ts"));
    if (pmIndex >= 0) {
      let pmContent = files[pmIndex].content;

      // Update PREDEFINED_USER_PROFILES
      if (latestOfficers && latestOfficers.length > 0) {
        const officersJson = JSON.stringify(latestOfficers, null, 2);
        pmContent = pmContent.replace(
          /export const PREDEFINED_USER_PROFILES:\s*UserAccessProfile\[\]\s*=\s*\[[\s\S]*?\];/m,
          `export const PREDEFINED_USER_PROFILES: UserAccessProfile[] = ${officersJson};`
        );
      }

      // Update INITIAL_SEED_PATIENTS
      if (latestPatients && latestPatients.length > 0) {
        const patientsJson = JSON.stringify(latestPatients, null, 2);
        pmContent = pmContent.replace(
          /const INITIAL_SEED_PATIENTS:\s*PatientMonitoringItem\[\]\s*=\s*\[[\s\S]*?\];/m,
          `const INITIAL_SEED_PATIENTS: PatientMonitoringItem[] = ${patientsJson};`
        );
      }

      files[pmIndex].content = pmContent;
    }
  } catch (err) {
    console.warn("Gagal menyuntikkan update patientMonitoring.ts:", err);
  }

  // =========================================================================
  // 3. INJEKSI KONFIGURASI GITHUB TERBARU KE src/components/GitHubSyncManager.tsx
  // =========================================================================
  try {
    const latestGithub = getSavedGitHubConfig();
    const ghIndex = files.findIndex((f) => f.path === "src/components/GitHubSyncManager.tsx" || f.path.endsWith("GitHubSyncManager.tsx"));
    if (ghIndex >= 0) {
      let ghContent = files[ghIndex].content;
      if (latestGithub) {
        const ghJson = JSON.stringify({ ...latestGithub, personalAccessToken: "" }, null, 2);
        ghContent = ghContent.replace(
          /const DEFAULT_GITHUB_CONFIG:\s*GitHubSyncConfig\s*=\s*\{[\s\S]*?\};/m,
          `const DEFAULT_GITHUB_CONFIG: GitHubSyncConfig = ${ghJson};`
        );
      }
      files[ghIndex].content = ghContent;
    }
  } catch (err) {
    console.warn("Gagal menyuntikkan update GitHubSyncManager.tsx:", err);
  }

  // =========================================================================
  // 4. LAMPIRKAN SNAPSHOT BACKUP JSON TERBARU (DENGAN SANITASI TOKEN RAHASIA)
  // =========================================================================
  try {
    const rawGithub = getSavedGitHubConfig();
    const safeGithubConfig = {
      ...rawGithub,
      personalAccessToken: "" // WAJIB DIKOSONGKAN agar tidak memicu GitHub Secret Scanning / Push Protection
    };

    const snapshotData = {
      exportedAt: new Date().toISOString(),
      timestampHuman: new Date().toLocaleString("id-ID"),
      version: "2.5.0",
      appTitle: "Form PE GHPR UPT Puskesmas Sananwetan",
      sheetConfig: getSavedSheetConfig(),
      officerProfiles: getOfficerProfiles(),
      patientsMonitoring: getAllPatients(),
      submissionHistory: getLocalSubmissionHistory(),
      githubConfig: safeGithubConfig
    };

    const snapshotJson = JSON.stringify(snapshotData, null, 2);
    const existingSnapshot = files.findIndex((f) => f.path === "public/ghpr_data_snapshot.json");
    if (existingSnapshot >= 0) {
      files[existingSnapshot].content = snapshotJson;
    } else {
      files.push({
        path: "public/ghpr_data_snapshot.json",
        content: snapshotJson
      });
    }
  } catch (err) {
    console.warn("Gagal membuat snapshot backup JSON:", err);
  }

  // =========================================================================
  // 5. PASTIKAN vite.config.ts KOMPATIBEL DENGAN GITHUB PAGES
  // =========================================================================
  const viteConfigIndex = files.findIndex(f => f.path === "vite.config.ts");
  if (viteConfigIndex >= 0) {
    files[viteConfigIndex].content = standardViteConfig;
  } else {
    files.push({
      path: "vite.config.ts",
      content: standardViteConfig
    });
  }

  // =========================================================================
  // 6. PASTIKAN WORKFLOW GITHUB ACTIONS (.github/workflows/deploy.yml) SELALU ADA & TERBARU
  // =========================================================================
  const robustDeployWorkflow = `name: Deploy PE GHPR App to GitHub Pages

on:
  push:
    branches: [ "main", "master" ]
  workflow_dispatch:

permissions:
  contents: write
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install Dependencies
        run: npm install --legacy-peer-deps

      - name: Build Application
        run: npm run build

      - name: Deploy to gh-pages branch (Branch Fallback)
        uses: peaceiris/actions-gh-pages@v4
        if: github.ref == 'refs/heads/main' || github.ref == 'refs/heads/master'
        with:
          github_token: \${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
          keep_files: false

      - name: Setup Pages (Actions Method)
        uses: actions/configure-pages@v5
        continue-on-error: true

      - name: Upload Pages Artifact
        uses: actions/upload-pages-artifact@v3
        continue-on-error: true
        with:
          path: './dist'

  deploy:
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    continue-on-error: true
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
        continue-on-error: true
`;

  const deployYmlIndex = files.findIndex((f) => f.path.includes("deploy.yml"));
  if (deployYmlIndex >= 0) {
    files[deployYmlIndex].content = robustDeployWorkflow;
  } else {
    files.push({
      path: ".github/workflows/deploy.yml",
      content: robustDeployWorkflow
    });
  }

  // =========================================================================
  // 7. PEMBERSIHAN / SANITASI KONTEN DARI TOKEN & SECRET SEBELUM DI-PUSH/DIUNDUH
  // =========================================================================
  // Pastikan tidak ada file .env rahasia dan tidak ada string PAT GitHub
  const sanitizedFiles = files
    .filter((f) => {
      // Kecualikan file sensitif lokal jika ada
      const lower = f.path.toLowerCase();
      if (lower === ".env" || lower === ".env.local" || lower === ".env.production") {
        return false;
      }
      return true;
    })
    .map((f) => {
      let content = f.content;
      if (typeof content === "string") {
        // Hapus pola token GitHub PAT (ghp_, github_pat_, gho_, ghu_, ghs_, ghr_)
        content = content.replace(/ghp_[A-Za-z0-9_]{30,}/g, "");
        content = content.replace(/github_pat_[A-Za-z0-9_]{50,}/g, "");
        content = content.replace(/gho_[A-Za-z0-9_]{30,}/g, "");
        content = content.replace(/ghu_[A-Za-z0-9_]{30,}/g, "");
        content = content.replace(/ghs_[A-Za-z0-9_]{30,}/g, "");
        content = content.replace(/ghr_[A-Za-z0-9_]{30,}/g, "");
      }
      return {
        ...f,
        content
      };
    });

  return sanitizedFiles;
}

export async function exportProjectAsZip(filename = "form-pe-ghpr-sananwetan-source.zip"): Promise<void> {
  const zip = new JSZip();
  const files = getAllProjectFiles();

  for (const file of files) {
    zip.file(file.path, file.content);
  }

  const blob = await zip.generateAsync({ type: "blob" });
  saveAs(blob, filename);
}

