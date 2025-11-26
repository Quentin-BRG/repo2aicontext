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
import { logError, logInfo, logWarn } from "../logger";

export interface ScanNotice {
    level: "info" | "warning" | "error";
    message: string;
}

export type ScanProgressHandler = (current: number, rel?: string) => void;

interface FileScannerOptions {
    onNotice?: (notice: ScanNotice) => void;
    isCancelled?: () => boolean;
    label?: string;
}

export class FileScanner {
    private readonly config = configManager.get();
    private readonly reported = new Set<string>();
    private warnedSoftCap = false;
    private readonly label: string;

    constructor(
        private readonly root: vscode.Uri,
        private readonly options: FileScannerOptions = {}
    ) {
        this.label = options.label ?? "scan";
    }

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
        const visitedDirs = new Set<string>();
        let dirVisited = 0;
        let maxDepth = 0;
        const started = Date.now();

        logInfo(this.prefix(`countFiles start (root=${this.root.fsPath})`));

        while (queue.length && !this.isCancelled()) {
            const { uri, rel } = queue.shift()!;
            if (visitedDirs.has(rel)) continue;
            visitedDirs.add(rel);
            let entries: [string, vscode.FileType][];

            try {
                entries = await vscode.workspace.fs.readDirectory(uri);
            } catch {
                continue;
            }

            dirVisited++;
            maxDepth = Math.max(maxDepth, depthOf(rel));

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
                        logWarn(
                            this.prefix(
                                `Soft cap reached during count at ${total} files.`
                            )
                        );
                        return total;
                    }
                }
            }
        }

        if (this.isCancelled()) {
            logInfo(
                this.prefix(
                    `countFiles cancelled after ${total} files (dirs=${dirVisited}).`
                )
            );
            return total;
        }

        logInfo(
            this.prefix(
                `countFiles complete in ${Date.now() - started}ms (files=${total}, dirs=${dirVisited}, maxDepth=${maxDepth}).`
            )
        );
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
        const started = Date.now();
        let maxDepth = 0;
        let dirVisited = 0;
        logInfo(
            this.prefix(
                `buildTree start (root=${this.root.fsPath}, maxKB=${maxKB}, skipBin=${skipBin}, smartIgnore=${smartIgnore}, dirEntrySkipThreshold=${dirEntrySkipThreshold}, blacklistNames=${blacklistNames.length}, blacklistExts=${blacklistExtensions.length}).`
            )
        );

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
                const node: TreeNode = {
                    name: name ?? (rel ? rel.split("/").pop()! : ""),
                    type: "dir",
                    important: true,
                    path: rel,
                    children: [],
                };
                dirMap.set(rel, node);

                // Only attach to parent if this is not the root node.
                if (rel) {
                    const parentRel = parentRelOf(rel);
                    const parent = dirMap.get(parentRel);
                    if (parent) {
                        parent.children = parent.children ?? [];
                        // Avoid duplicate links if ensureDir is called repeatedly.
                        if (!parent.children.includes(node)) {
                            parent.children.push(node);
                        }
                    }
                }
            }
            return dirMap.get(rel)!;
        };
        ensureDir("");

        let processed = 0;
        const dirQueue: { uri: vscode.Uri; rel: string }[] = [
            { uri: this.root, rel: "" },
        ];
        const visitedDirs = new Set<string>();
        const active: Promise<void>[] = [];

        while (dirQueue.length && !this.isCancelled()) {
            const { uri, rel } = dirQueue.shift()!;
            if (visitedDirs.has(rel)) continue;
            visitedDirs.add(rel);
            let entries: [string, vscode.FileType][];
            try {
                entries = await vscode.workspace.fs.readDirectory(uri);
            } catch {
                continue;
            }

            ensureDir(rel);
            dirVisited++;
            maxDepth = Math.max(maxDepth, depthOf(rel));

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
                    maxDepth = Math.max(maxDepth, depthOf(childRel));
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

                    maxDepth = Math.max(maxDepth, depthOf(childRel));
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

                    if (processed >= MAX_FILES_SOFT) {
                        if (!this.warnedSoftCap) {
                            this.warnedSoftCap = true;
                            this.emitNotice(
                                "softcap-scan",
                                "warning",
                                `Stopped at ${formatNumber(
                                    MAX_FILES_SOFT
                                )} files for performance.`
                            );
                            logWarn(
                                this.prefix(
                                    `Soft cap reached during build at ${processed} files.`
                                )
                            );
                        }
                        await Promise.allSettled(active);
                        return finalizeTree(dirMap);
                    }
                }
            }
        }

        await Promise.allSettled(active);
        if (this.isCancelled()) {
            logInfo(
                this.prefix(
                    `buildTree cancelled after processing ${processed} files (dirs=${dirVisited}).`
                )
            );
            return [];
        }

        logInfo(
            this.prefix(
                `buildTree complete in ${Date.now() - started}ms (files=${processed}, dirs=${dirVisited}, maxDepth=${maxDepth}, softCap=${this.warnedSoftCap}).`
            )
        );
        return finalizeTree(dirMap);
    }

    private emitNotice(
        key: string,
        level: ScanNotice["level"],
        message: string
    ) {
        if (this.reported.has(key)) return;
        this.reported.add(key);
        const prefixed = this.prefix(message);
        if (level === "error") {
            logError(prefixed);
        } else if (level === "warning") {
            logWarn(prefixed);
        } else {
            logInfo(prefixed);
        }
        this.options.onNotice?.({ level, message });
    }

    private isCancelled(): boolean {
        return this.options.isCancelled?.() ?? false;
    }

    private prefix(message: string): string {
        return `[${this.label}] ${message}`;
    }
}

function parentRelOf(rel: string): string {
    const idx = rel.lastIndexOf("/");
    return idx === -1 ? "" : rel.slice(0, idx);
}

function depthOf(rel: string): number {
    if (!rel) return 0;
    return rel.split("/").length;
}

function finalizeTree(dirMap: Map<string, TreeNode>): TreeNode[] {
    const root = dirMap.get("");
    if (!root) return [];

    type Frame = { node: TreeNode; exit: boolean };
    const visiting = new Set<TreeNode>();
    const stack: Frame[] = [{ node: root, exit: false }];

    while (stack.length) {
        const { node, exit } = stack.pop()!;

        if (node.type === "file") {
            node.aggChars = node.chars || 0;
            node.aggTokens = node.tokens || 0;
            node.aggFiles = 1;
            node.aggSkipped = node.skipped ? 1 : 0;
            node.aggTruncated = node.truncated ? 1 : 0;
            continue;
        }

        if (exit) {
            let aggChars = 0;
            let aggTokens = 0;
            let aggFiles = 0;
            let aggSkipped = 0;
            let aggTruncated = 0;

            (node.children ?? []).forEach((child) => {
                aggChars += child.aggChars || 0;
                aggTokens += child.aggTokens || 0;
                aggFiles += child.aggFiles || 0;
                aggSkipped += child.aggSkipped || 0;
                aggTruncated += child.aggTruncated || 0;
            });

            node.aggChars = aggChars;
            node.aggTokens = aggTokens;
            node.aggFiles = aggFiles;
            node.aggSkipped = aggSkipped;
            node.aggTruncated = aggTruncated;

            const hasImportantChild = (node.children ?? []).some(
                (child) => child.important
            );
            node.important =
                !NON_IMPORTANT_DIRS.has(node.name) && hasImportantChild;
            visiting.delete(node);
            continue;
        }

        if (visiting.has(node)) continue;
        visiting.add(node);

        const seenChildren = new Set<string>();
        node.children = (node.children ?? []).filter((child) => {
            if (!child) return false;
            if (child === node) return false;
            if (visiting.has(child)) return false;
            const key = `${child.type}:${child.path}`;
            if (seenChildren.has(key)) return false;
            seenChildren.add(key);
            return true;
        });

        stack.push({ node, exit: true });
        for (let i = (node.children?.length ?? 0) - 1; i >= 0; i--) {
            stack.push({ node: node.children![i], exit: false });
        }
    }

    return sortTree(root.children ?? []);
}

function sortTree(nodes: TreeNode[]): TreeNode[] {
    const compare = (a: TreeNode, b: TreeNode) => {
        if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
        return a.name.localeCompare(b.name);
    };

    const queue: TreeNode[][] = [nodes];
    const visited = new Set<TreeNode>();

    while (queue.length) {
        const arr = queue.pop()!;
        arr.sort(compare);
        arr.forEach((node) => {
            if (visited.has(node)) return;
            visited.add(node);
            if (node.children && node.children.length) {
                queue.push(node.children);
            }
        });
    }
    return nodes;
}
