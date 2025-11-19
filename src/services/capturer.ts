import * as vscode from "vscode";
import * as path from "path";
import { configManager } from "../config";
import { BINARY_EXTS } from "../constants";

type DirNode = { children: Map<string, DirNode>; files: string[] };

export async function captureWorkspace(selected: string[] = []) {
    const workspace = vscode.workspace.workspaceFolders?.[0];
    if (!workspace) {
        vscode.window.showErrorMessage("Open a workspace folder first.");
        return;
    }

    const config = configManager.get();
    const gitIgnores = await getGitIgnores(workspace.uri);
    const ignoreGlobs = [...gitIgnores, ...config.ignores];
    const allUris = await collectWorkspaceUris(ignoreGlobs);

    const nameBlacklist = new Set(
        config.blacklistNames.map((n) => n.toLowerCase()).filter(Boolean)
    );
    const extBlacklist = new Set(
        config.blacklistExtensions
            .map((ext) => ext.trim().toLowerCase())
            .filter(Boolean)
            .map((ext) => (ext.startsWith(".") ? ext : `.${ext}`))
    );

    let relPaths = allUris
        .map((uri) =>
            path.relative(workspace.uri.fsPath, uri.fsPath).replace(/\\/g, "/")
        )
        .sort();

    if (selected.length) {
        relPaths = relPaths.filter((rel) =>
            selected.some((sel) => rel === sel || rel.startsWith(`${sel}/`))
        );
    }

    relPaths = relPaths.filter((rel) => {
        const parts = rel.split("/");
        const base = parts[parts.length - 1] ?? rel;
        const lower = base.toLowerCase();
        if (nameBlacklist.has(lower)) return false;
        const ext = path.extname(base).toLowerCase();
        if (ext && extBlacklist.has(ext)) return false;

        // Skip entries containing a blacklisted folder name
        for (let i = 0; i < parts.length - 1; i++) {
            if (nameBlacklist.has(parts[i].toLowerCase())) return false;
        }
        return true;
    });

    const dirTree = buildDirTree(relPaths);
    const treeLines = [workspace.name + "/", ...printTree(dirTree), ""];
    const output: string[] = [...treeLines];

    const relSet = new Set(relPaths);
    const relToUri = new Map<string, vscode.Uri>();
    for (const uri of allUris) {
        const rel = path
            .relative(workspace.uri.fsPath, uri.fsPath)
            .replace(/\\/g, "/");
        if (relSet.has(rel)) relToUri.set(rel, uri);
    }

    const totalFiles = relPaths.length;
    const maxKB =
        totalFiles > 2000 && config.maxKB === 1024 ? 256 : config.maxKB;

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Window,
            title: "Capturing...",
            cancellable: false,
        },
        async (progress) => {
            let processed = 0;
            for (const rel of relPaths) {
                const uri = relToUri.get(rel);
                if (!uri) continue;

                processed++;
                progress.report({ message: `(${processed}/${totalFiles})` });

                output.push(divider(rel));
                const ext = path.extname(rel).toLowerCase();

                if (config.skipBin && BINARY_EXTS.has(ext)) {
                    output.push("<binary skipped>");
                    continue;
                }

                let data: Uint8Array;
                try {
                    data = await vscode.workspace.fs.readFile(uri);
                } catch {
                    output.push("<read error>");
                    continue;
                }

                if (data.length > maxKB * 1024) {
                    output.push(`<truncated to ${maxKB} KB>`);
                    data = data.slice(0, maxKB * 1024);
                }
                output.push(Buffer.from(data).toString("utf8"));
            }
        }
    );

    await vscode.env.clipboard.writeText(output.join("\n"));
    vscode.window.showInformationMessage(
        `Snapshot copied (${totalFiles} files).`
    );
}

async function getGitIgnores(root: vscode.Uri): Promise<string[]> {
    try {
        const uri = vscode.Uri.joinPath(root, ".gitignore");
        const data = await vscode.workspace.fs.readFile(uri);
        return Buffer.from(data)
            .toString("utf8")
            .split(/\r?\n/)
            .filter((line) => line && !line.startsWith("#"))
            .map((entry) => (entry.endsWith("/") ? `${entry}**` : entry));
    } catch {
        return [];
    }
}

async function collectWorkspaceUris(
    ignoreGlobs: string[]
): Promise<vscode.Uri[]> {
    const pattern =
        ignoreGlobs.length > 0 ? `{${ignoreGlobs.join(",")}}` : undefined;
    return vscode.workspace.findFiles("**/*", pattern);
}

function buildDirTree(relPaths: string[]): DirNode {
    const root: DirNode = { children: new Map(), files: [] };
    for (const rel of relPaths) {
        const parts = rel.split("/");
        let node = root;
        parts.forEach((part, idx) => {
            const isFile = idx === parts.length - 1;
            if (isFile) {
                node.files.push(part);
                return;
            }

            if (!node.children.has(part)) {
                node.children.set(part, { children: new Map(), files: [] });
            }
            node = node.children.get(part)!;
        });
    }
    return root;
}

function printTree(node: DirNode, prefix = "", out: string[] = []): string[] {
    const dirs = [...node.children.keys()].sort();
    dirs.forEach((dir, idx) => {
        const isLastDir = idx === dirs.length - 1 && node.files.length === 0;
        out.push(`${prefix}${isLastDir ? "`-- " : "|-- "}${dir}/`);
        const nextPrefix = prefix + (isLastDir ? "    " : "|   ");
        printTree(node.children.get(dir)!, nextPrefix, out);
    });

    node.files.sort().forEach((file, idx) => {
        const isLastFile = idx === node.files.length - 1;
        out.push(`${prefix}${isLastFile ? "`-- " : "|-- "}${file}`);
    });
    return out;
}

function divider(relPath: string): string {
    const bar = "-".repeat(Math.max(8, relPath.length + 4));
    return `\n${bar} ${relPath} ${bar}`;
}
