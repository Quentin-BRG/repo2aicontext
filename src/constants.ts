export const BINARY_EXTS = new Set([
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".bmp",
    ".tiff",
    ".ico",
    ".zip",
    ".rar",
    ".7z",
    ".tar",
    ".gz",
    ".pdf",
    ".exe",
    ".dll",
]);

export const NON_IMPORTANT_DIRS = new Set([
    "node_modules",
    ".git",
    ".yarn",
    ".pnpm",
    ".cache",
    ".next",
    "dist",
    "build",
    "bin",
    "obj",
    "coverage",
]);

export const HEAVY_DIR_NAMES = new Set([
    "node_modules",
    ".git",
    ".hg",
    ".svn",
    "dist",
    "build",
    "out",
    "coverage",
    "target",
    "bin",
    "obj",
    ".next",
    ".nuxt",
    ".svelte-kit",
    ".cache",
    ".gradle",
    "Pods",
    "Carthage",
    "DerivedData",
    "Library",
    "Packages",
    ".venv",
    "venv",
    "env",
    "__pycache__",
    ".mypy_cache",
    ".pytest_cache",
    ".dart_tool",
    ".idea",
    ".vscode",
    ".yarn",
    ".pnpm",
]);

export const NON_IMPORTANT_FILE_EXTS = new Set<string>([
    ...BINARY_EXTS,
    ".log",
    ".lock",
    ".tmp",
    ".class",
]);

export const MAX_FILES_SOFT = 50_000;
export const STAT_CONCURRENCY = 64;
export const PROGRESS_THROTTLE_MS = 50;
