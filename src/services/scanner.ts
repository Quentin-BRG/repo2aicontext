import * as vscode from "vscode";
import * as path from "path";
import { TreeNode } from "../types";
import {
    HEAVY_DIR_NAMES,
    MAX_FILES_SOFT,
    STAT_CONCURRENCY,
    BINARY_EXTS,
    NON_IMPORTANT_FILE_EXTS,
    NON_IMPORTANT_DIRS,
} from "../constants";
import { configManager } from "../config";
import { formatNumber } from "../utils/formatting";

export interface ScanNotice {
    level: "info" | "warning" | "error";
    message: string;
}

export type ScanProgressHandler = (current: number, rel?: string) => void;

interface FileScannerOptions {
    onNotice?: (notice: ScanNotice) => void;
    isCancelled?: () => boolean;
}

export class FileScanner {
    private readonly config = configManager.get();
    private readonly reported = new Set<string>();
    private warnedSoftCap = false;

    constructor(
        private readonly root: vscode.Uri,
        private readonly options: FileScannerOptions = {}
    ) {}

    public async countFiles(
        onProgress?: ScanProgressHandler
    ): Promise<number> {
        const {
            smartIgnore,
            dirEntrySkipThreshold,
            blacklistNames,
            blacklistExtensions,
        } = this.config;

        const nameBlacklist = new Set(
            blacklistNames.map((n) => n.toLowerCase()).filter(Boolean)
        );
        const extBlacklist = new Set(
            blacklistExtensions
                .map((e) => e.trim().toLowerCase())
                .filter(Boolean)
                .map((e) => (e.startsWith(".") ? e : `.${e}`))
        );

        let total = 0;
        const queue: { uri: vscode.Uri; rel: string }[] = [
            { uri: this.root, rel: "" },
        ];

        while (queue.length && !this.isCancelled()) {
            const { uri, rel } = queue.shift()!;
            let entries: [string, vscode.FileType][];

            try {
                entries = await vscode.workspace.fs.readDirectory(uri);
            } catch {
                continue;
            }

            if (
                smartIgnore &&
                rel &&
                entries.length > dirEntrySkipThreshold
            ) {
                this.emitNotice(
                    `skip-large:${rel}`,
                    "info",
                    `Skipping large folder: ${rel} (${entries.length} items)`
                );
                continue;
            }

            for (const [name, type] of entries) {
                if (name.startsWith(".")) continue;
                const childRel = rel ? `${rel}/${name}` : name;
                const childUri = vscode.Uri.joinPath(uri, name);
                const lname = name.toLowerCase();

                if (type & vscode.FileType.SymbolicLink) continue;

                if (type & vscode.FileType.Directory) {
                    if (smartIgnore && HEAVY_DIR_NAMES.has(name)) {
                        this.emitNotice(
                            `skip-heavy:${childRel}`,
                            "info",
                            `Skipping folder: ${childRel}`
                        );
                        continue;
                    }
                    if (nameBlacklist.has(lname)) {
                        this.emitNotice(
                            `skip-blacklist:${childRel}`,
                            "info",
                            `Skipping folder: ${childRel}`
                        );
                        continue;
                    }
                    queue.push({ uri: childUri, rel: childRel });
                    continue;
                }

                if (type & vscode.FileType.File) {
                    const ext = path.extname(name).toLowerCase();
                    if (nameBlacklist.has(lname) || extBlacklist.has(ext)) {
                        continue;
                    }

                    total++;
                    if (onProgress && (total === 1 || total % 500 === 0)) {
                        onProgress(total, childRel);
                    }

                    if (total >= MAX_FILES_SOFT && !this.warnedSoftCap) {
                        this.warnedSoftCap = true;
                        this.emitNotice(
                            "softcap-count",
                            "warning",
                            `Large workspace detected. Showing first ${formatNumber(
                                MAX_FILES_SOFT
                            )} files for performance.`
                        );
                        return total;
                    }
                }
            }
        }

        return total;
    }

    public async buildTree(
        onProgress: ScanProgressHandler
    ): Promise<TreeNode[]> {
        const {
            maxKB,
            skipBin,
            smartIgnore,
            dirEntrySkipThreshold,
            blacklistNames,
            blacklistExtensions,
        } = this.config;
        const maxBytes = Math.max(1, maxKB) * 1024;

        const nameBlacklist = new Set(
            blacklistNames.map((n) => n.toLowerCase()).filter(Boolean)
        );
        const extBlacklist = new Set(
            blacklistExtensions
                .map((e) => e.trim().toLowerCase())
                .filter(Boolean)
                .map((e) => (e.startsWith(".") ? e : `.${e}`))
        );

        const dirMap = new Map<string, TreeNode>();
        const ensureDir = (rel: string, name?: string) => {
            if (!dirMap.has(rel)) {
                dirMap.set(rel, {
                    name: name ?? (rel ? rel.split("/").pop()! : ""),
                    type: "dir",
                    important: true,
                    path: rel,
                    children: [],
                });

                const parentRel = parentRelOf(rel);
                const parent = dirMap.get(parentRel);
                if (parent) {
                    parent.children = parent.children ?? [];
                    parent.children.push(dirMap.get(rel)!);
                }
            }
            return dirMap.get(rel)!;
        };
        ensureDir("");

        let processed = 0;
        const dirQueue: { uri: vscode.Uri; rel: string }[] = [
            { uri: this.root, rel: "" },
        ];
        const active: Promise<void>[] = [];

        while (dirQueue.length && !this.isCancelled()) {
            const { uri, rel } = dirQueue.shift()!;
            let entries: [string, vscode.FileType][];
            try {
                entries = await vscode.workspace.fs.readDirectory(uri);
            } catch {
                continue;
            }

            ensureDir(rel);

            if (
                smartIgnore &&
                rel &&
                entries.length > dirEntrySkipThreshold
            ) {
                this.emitNotice(
                    `skip-large:${rel}`,
                    "info",
                    `Skipping large folder: ${rel} (${entries.length} items)`
                );
                continue;
            }

            entries.sort(([aName, aType], [bName, bType]) => {
                const aIsDir = !!(aType & vscode.FileType.Directory);
                const bIsDir = !!(bType & vscode.FileType.Directory);
                if (aIsDir !== bIsDir) return aIsDir ? -1 : 1;
                return aName.localeCompare(bName);
            });

            for (const [name, type] of entries) {
                if (this.isCancelled()) break;
                if (name.startsWith(".")) continue;
                const childRel = rel ? `${rel}/${name}` : name;
                const childUri = vscode.Uri.joinPath(uri, name);
                const lname = name.toLowerCase();

                if (type & vscode.FileType.SymbolicLink) continue;

                if (type & vscode.FileType.Directory) {
                    if (smartIgnore && HEAVY_DIR_NAMES.has(name)) {
                        this.emitNotice(
                            `skip-heavy:${childRel}`,
                            "info",
                            `Skipping folder: ${childRel}`
                        );
                        continue;
                    }
                    if (nameBlacklist.has(lname)) {
                        this.emitNotice(
                            `skip-blacklist:${childRel}`,
                            "info",
                            `Skipping blacklisted folder: ${childRel}`
                        );
                        continue;
                    }
                    ensureDir(childRel, name);
                    dirQueue.push({ uri: childUri, rel: childRel });
                    continue;
                }

                if (type & vscode.FileType.File) {
                    const ext = path.extname(name).toLowerCase();
                    if (nameBlacklist.has(lname) || extBlacklist.has(ext)) {
                        continue;
                    }

                    const job = (async () => {
                        try {
                            const isBinary = skipBin && BINARY_EXTS.has(ext);
                            let chars = 0;
                            let tokens = 0;
                            let truncated = false;
                            let skipped = false;

                            if (isBinary) {
                                skipped = true;
                            } else {
                                const stat = await vscode.workspace.fs.stat(
                                    childUri
                                );
                                const size = stat.size;
                                const used = Math.min(size, maxBytes);
                                chars = used;
                                tokens = Math.ceil(chars / 4);
                                truncated = size > maxBytes;
                            }

                            const parent = ensureDir(parentRelOf(childRel));
                            parent.children = parent.children ?? [];
                            parent.children.push({
                                name,
                                type: "file",
                                important: !NON_IMPORTANT_FILE_EXTS.has(ext),
                                path: childRel,
                                chars,
                                tokens,
                                truncated,
                                skipped,
                            });
                        } catch {
                            const parent = ensureDir(parentRelOf(childRel));
                            parent.children = parent.children ?? [];
                            parent.children.push({
                                name,
                                type: "file",
                                important: true,
                                path: childRel,
                                chars: 0,
                                tokens: 0,
                                truncated: false,
                                skipped: false,
                            });
                        } finally {
                            processed++;
                            onProgress(processed, childRel);
                        }
                    })();

                    active.push(job);
                    job.finally(() => {
                        const idx = active.indexOf(job);
                        if (idx >= 0) active.splice(idx, 1);
                    });
                    if (active.length >= STAT_CONCURRENCY) {
                        await Promise.race(active);
                    }

                    if (processed >= MAX_FILES_SOFT && !this.warnedSoftCap) {
                        this.warnedSoftCap = true;
                        this.emitNotice(
                            "softcap-scan",
                            "warning",
                            `Stopped at ${formatNumber(
                                MAX_FILES_SOFT
                            )} files for performance.`
                        );
                        await Promise.allSettled(active);
                        return finalizeTree(dirMap);
                    }
                }
            }
        }

        await Promise.allSettled(active);
        if (this.isCancelled()) return [];
        return finalizeTree(dirMap);
    }

    private emitNotice(
        key: string,
        level: ScanNotice["level"],
        message: string
    ) {
        if (this.reported.has(key)) return;
        this.reported.add(key);
        this.options.onNotice?.({ level, message });
    }

    private isCancelled(): boolean {
        return this.options.isCancelled?.() ?? false;
    }
}

function parentRelOf(rel: string): string {
    const idx = rel.lastIndexOf("/");
    return idx === -1 ? "" : rel.slice(0, idx);
}

function finalizeTree(dirMap: Map<string, TreeNode>): TreeNode[] {
    const root = dirMap.get("");
    if (!root) return [];

    const walk = (node: TreeNode): TreeNode => {
        if (node.type === "file") {
            node.aggChars = node.chars || 0;
            node.aggTokens = node.tokens || 0;
            node.aggFiles = 1;
            node.aggSkipped = node.skipped ? 1 : 0;
            node.aggTruncated = node.truncated ? 1 : 0;
            return node;
        }

        let aggChars = 0;
        let aggTokens = 0;
        let aggFiles = 0;
        let aggSkipped = 0;
        let aggTruncated = 0;

        (node.children ?? []).forEach((child) => {
            const walked = walk(child);
            aggChars += walked.aggChars || 0;
            aggTokens += walked.aggTokens || 0;
            aggFiles += walked.aggFiles || 0;
            aggSkipped += walked.aggSkipped || 0;
            aggTruncated += walked.aggTruncated || 0;
        });

        node.aggChars = aggChars;
        node.aggTokens = aggTokens;
        node.aggFiles = aggFiles;
        node.aggSkipped = aggSkipped;
        node.aggTruncated = aggTruncated;

        const hasImportantChild = (node.children ?? []).some(
            (child) => child.important
        );
        node.important = !NON_IMPORTANT_DIRS.has(node.name) && hasImportantChild;
        return node;
    };

    walk(root);
    return sortTree(root.children ?? []);
}

function sortTree(nodes: TreeNode[]): TreeNode[] {
    nodes.sort((a, b) => {
        if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
        return a.name.localeCompare(b.name);
    });
    nodes.forEach((node) => {
        if (node.children) sortTree(node.children);
    });
    return nodes;
}
