# Repo2AIContext

<div align="center">
  <img src="media/logo.png" alt="Repo2AIContext Logo" width="120" />
</div>

<br />

**Instantly copy your workspace structure and file contents to the clipboard, formatted perfectly for LLM context.**

Repo2AIContext provides a performant sidebar view to scan large repositories, estimate token counts, and select exactly what you need to share with your AI coding assistant.

---

## ✨ Features

-   **📸 One-Click Capture**: Generates a text bundle containing your directory tree and file contents, ready to paste into ChatGPT, Claude, or local LLMs.
-   **⚡ Live Sidebar**: Browse your file tree with tri-state checkboxes.
-   **🧮 Token & Char Counters**: Real-time estimates (`~1 token ≈ 4 chars`) per file and folder to help you stay within context windows.
-   **VX Smart Filtering**: Automatically respects `.gitignore`, skips binary files, and ignores heavy directories (`node_modules`, `.git`, `dist`) to keep the UI snappy.
-   **🔒 Privacy Focused**: Operations happen entirely in memory. Nothing is written to disk; data goes straight to your clipboard.
-   **⚙️ Inline Blacklisting**: Quickly exclude specific file names or extensions directly from the sidebar settings.

## 🚀 Usage

1.  Open the **Repo2AIContext** view in the Activity Bar (📸 icon).
2.  Select the files or folders you want to include. Watch the token counters update in real-time.
3.  Click **Capture**.
4.  Paste the result into your LLM chat.

## 📝 Output Format

The copied text is structured to be easily parsed by AI models:

```text
your-project/
├── src/
│   └── main.ts
├── package.json
└── README.md

────────────────── src/main.ts ──────────────────
import { ... } from "module";
// ... full file content ...

────────────────── README.md ──────────────────
<truncated to 1024 KB>
# Documentation
... partial content ...

────────────────── assets/logo.png ──────────────────
<binary skipped>
```

## ⚙️ Configuration

You can configure these settings in your VS Code `settings.json`:

| Setting                              | Description                                                   | Default                       |
| :----------------------------------- | :------------------------------------------------------------ | :---------------------------- |
| `repo2aicontext.ignoreGlobs`         | Additional glob patterns to exclude (on top of `.gitignore`). | `["**/node_modules/**", ...]` |
| `repo2aicontext.maxFileSizeKB`       | Max text file size before truncation.                         | `1024`                        |
| `repo2aicontext.skipBinaries`        | Replace binary files with a placeholder.                      | `true`                        |
| `repo2aicontext.blacklistNames`      | Exclude specific file/folder names (e.g., `.env`).            | `[]`                          |
| `repo2aicontext.blacklistExtensions` | Exclude specific extensions (e.g., `.log`).                   | `[]`                          |

## 🛠️ Local Development

1.  Install dependencies:
    ```bash
    npm install
    ```
2.  Package the extension:
    ```bash
    npm run package
    ```
3.  Install the generated `.vsix` file manually or press `F5` to debug.

---

**License**
[MIT](LICENSE.md) © 2025 Quentin Berger
