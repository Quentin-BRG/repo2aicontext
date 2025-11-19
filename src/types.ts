export interface TreeNode {
    name: string;
    type: "dir" | "file";
    important: boolean;
    path: string;
    children?: TreeNode[];
    // File-level stats
    chars?: number;
    tokens?: number;
    truncated?: boolean;
    skipped?: boolean;
    // Aggregated stats for directories
    aggChars?: number;
    aggTokens?: number;
    aggFiles?: number;
    aggSkipped?: number;
    aggTruncated?: number;
}

export interface ExtensionConfig {
    ignores: string[];
    maxKB: number;
    skipBin: boolean;
    smartIgnore: boolean;
    dirEntrySkipThreshold: number;
    blacklistNames: string[];
    blacklistExtensions: string[];
}

export interface ScanProgress {
    processed: number;
    total: number;
    currentRelPath: string;
}
