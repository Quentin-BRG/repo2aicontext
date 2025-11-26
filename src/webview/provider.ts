import * as vscode from "vscode";
import { FileScanner, ScanNotice } from "../services/scanner";
import { configManager } from "../config";
import { getWebviewContent } from "./template";
import { PROGRESS_THROTTLE_MS } from "../constants";
import { logDebug, logError, logInfo, logWarn } from "../logger";

export class Repo2AIContextViewProvider implements vscode.WebviewViewProvider {
    private view?: vscode.WebviewView;
    private scanId = 0;
    private lastProgressSent = 0;
    private webviewReady = false;
    private refreshPending = false;
    private refreshInProgress = false;
    private readyFallback?: NodeJS.Timeout;
    private cachedTree: any[] | undefined;

    constructor(private readonly _extensionUri: vscode.Uri) {}

    resolveWebviewView(view: vscode.WebviewView) {
        this.view = view;
        this.webviewReady = false;
        this.refreshPending = true;
        this.refreshInProgress = false;
        if (this.readyFallback) {
            clearTimeout(this.readyFallback);
        }
        logInfo(
            "Webview resolved; initial refresh queued until webview-ready."
        );
        logDebug("Webview state reset (ready=false, refreshPending=true).");

        const options: vscode.WebviewOptions & {
            retainContextWhenHidden?: boolean;
        } = {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this._extensionUri, "media"),
                vscode.Uri.joinPath(this._extensionUri, "out"),
            ],
        };
        view.webview.options = options;
        view.webview.html = getWebviewContent();

        // Safety net: track late webview-ready without forcing refresh loops.
        this.readyFallback = setTimeout(() => {
            if (!this.webviewReady) {
                logWarn(
                    "Webview-ready not received within 1s; marking refresh as pending."
                );
                this.refreshPending = true;
            }
        }, 1000);

        view.onDidChangeVisibility(() => {
            if (view.visible && this.refreshPending) {
                logDebug(
                    "Webview became visible with pending refresh; triggering refresh."
                );
                this.scheduleRefresh("visible-with-pending");
            }
        });

        view.onDidDispose(() => {
            if (this.readyFallback) {
                clearTimeout(this.readyFallback);
                this.readyFallback = undefined;
            }
            this.view = undefined;
            this.webviewReady = false;
        });

        view.webview.onDidReceiveMessage(async (message) => {
            switch (message?.command) {
                case "capture":
                    vscode.commands.executeCommand(
                        "repo2aicontext.capture",
                        message.selected ?? []
                    );
                    break;
                case "cancel-scan":
                    this.scanId++;
                    this.view?.webview.postMessage({
                        type: "loading",
                        value: false,
                    });
                    break;
                case "config-add-name": {
                    const value = String(message.value ?? "").trim();
                    if (value) {
                        await configManager.updateBlacklist(
                            "blacklistNames",
                            value
                        );
                        this.refresh("config-add-name");
                    }
                    break;
                }
                case "config-remove-name": {
                    const value = String(message.value ?? "").trim();
                    if (value) {
                        await configManager.updateBlacklist(
                            "blacklistNames",
                            undefined,
                            value
                        );
                        this.refresh("config-remove-name");
                    }
                    break;
                }
                case "config-add-ext": {
                    const value = String(message.value ?? "").trim();
                    if (value) {
                        await configManager.updateBlacklist(
                            "blacklistExtensions",
                            value
                        );
                        this.refresh("config-add-ext");
                    }
                    break;
                }
                case "config-remove-ext": {
                    const value = String(message.value ?? "").trim();
                    if (value) {
                        await configManager.updateBlacklist(
                            "blacklistExtensions",
                            undefined,
                            value
                        );
                        this.refresh("config-remove-ext");
                    }
                    break;
                }
                case "webview-ready":
                    if (this.readyFallback) {
                        clearTimeout(this.readyFallback);
                        this.readyFallback = undefined;
                    }
                    this.webviewReady = true;
                    logDebug("Webview marked ready by webview message.");

                    // Si on a un arbre en cache, on le renvoie immédiatement
                    if (this.cachedTree) {
                        logDebug("Restoring cached tree to webview.");
                        // On enlève le loading
                        this.view?.webview.postMessage({
                            type: "loading",
                            value: false,
                        });
                        // On renvoie l'arbre
                        this.view?.webview.postMessage({
                            type: "refresh",
                            tree: this.cachedTree,
                        });
                    }

                    if (this.refreshPending) {
                        logDebug(
                            "Pending refresh detected; triggering refresh now."
                        );
                        this.scheduleRefresh("pending-on-ready");
                    }
                    break;
                case "client-log": {
                    const value = String(message.value ?? "").trim();
                    if (value) logDebug(`[client] ${value}`);
                    break;
                }
                case "request-config":
                    this.postConfig();
                    break;
                default:
                    break;
            }
        });
    }

    public refresh(reason = "manual") {
        this.scheduleRefresh(reason);
    }

    private scheduleRefresh(reason: string) {
        if (!this.webviewReady) {
            this.refreshPending = true;
            logDebug(`[refresh] queued (${reason}) because webview not ready.`);
            return;
        }

        if (this.refreshInProgress) {
            this.refreshPending = true;
            logDebug(`[refresh] scan already running, queueing (${reason}).`);
            return;
        }

        void this.runRefresh(reason);
    }

    private async runRefresh(reason: string) {
        const view = this.view;
        if (!view) {
            logDebug(`[refresh] skipped (${reason}) because view is missing.`);
            return;
        }

        this.refreshInProgress = true;
        this.refreshPending = false;

        const currentScan = ++this.scanId;
        logInfo(`[scan ${currentScan}] Starting refresh (reason: ${reason}).`);
        const postLoading = (value: boolean, force = false) => {
            if (force || currentScan === this.scanId) {
                view.webview.postMessage({ type: "loading", value });
                logDebug(
                    `[scan ${currentScan}] Loading -> ${value ? "on" : "off"}`
                );
            }
        };

        this.lastProgressSent = 0;

        logDebug(`[scan ${currentScan}] Posting initial loading on.`);
        postLoading(true);
        logDebug(`[scan ${currentScan}] Posting config and zero progress.`);
        this.postConfig();
        view.webview.postMessage({
            type: "progress",
            phase: "count",
            current: 0,
            total: 0,
        });
        logDebug(`[scan ${currentScan}] Zero progress posted.`);

        try {
            const workspace = vscode.workspace.workspaceFolders?.[0];
            if (!workspace) {
                logInfo(
                    `[scan ${currentScan}] No workspace folder detected; sending empty tree.`
                );
                if (currentScan === this.scanId) {
                    this.cachedTree = [];
                    view.webview.postMessage({ type: "refresh", tree: [] });
                }
                return;
            }

            const scanner = new FileScanner(workspace.uri, {
                isCancelled: () => currentScan !== this.scanId,
                onNotice: (notice) => this.postNotice(notice, currentScan),
                label: `scan:${currentScan}`,
            });

            logDebug(`[scan ${currentScan}] Invoking countFiles.`);
            let countProgressLogged = false;
            const total = await scanner.countFiles((count, rel) => {
                if (!countProgressLogged) {
                    countProgressLogged = true;
                    logDebug(
                        `[scan ${currentScan}] count progress first tick: count=${count}, rel=${
                            rel ?? ""
                        }`
                    );
                }
                view.webview.postMessage({
                    type: "progress",
                    phase: "count",
                    current: count,
                    total: 0,
                    rel,
                });
            });

            logInfo(
                `[scan ${currentScan}] Count completed: ${total} files (may include soft cap).`
            );

            if (currentScan !== this.scanId) return;

            view.webview.postMessage({
                type: "progress",
                phase: "scan",
                current: 0,
                total,
            });

            logDebug(`[scan ${currentScan}] Invoking buildTree.`);
            let scanProgressLogged = false;
            const tree = await scanner.buildTree((processed, rel) => {
                if (!scanProgressLogged) {
                    scanProgressLogged = true;
                    logDebug(
                        `[scan ${currentScan}] scan progress first tick: processed=${processed}, rel=${
                            rel ?? ""
                        }`
                    );
                }
                const now = Date.now();
                if (
                    now - this.lastProgressSent > PROGRESS_THROTTLE_MS ||
                    processed % 25 === 0 ||
                    processed === total
                ) {
                    this.lastProgressSent = now;
                    view.webview.postMessage({
                        type: "progress",
                        phase: "scan",
                        current: processed,
                        total,
                        rel,
                    });
                }
            });

            logInfo(
                `[scan ${currentScan}] Tree build completed; sending ${tree.length} top-level nodes to webview.`
            );

            if (currentScan !== this.scanId) return;

            // On sauvegarde dans le cache
            this.cachedTree = tree;

            view.webview.postMessage({ type: "refresh", tree });
        } catch (error) {
            if (currentScan !== this.scanId) return;
            const message =
                error instanceof Error ? error.message : String(error);
            logError(`[scan ${currentScan}] Scan failed`, error);
            this.postNotice(
                {
                    level: "error",
                    message: `Scan failed: ${message}`,
                },
                currentScan
            );
            vscode.window.showErrorMessage(
                `Repo2AIContext scan failed: ${message}`
            );
        } finally {
            logDebug(`[scan ${currentScan}] Refresh finished.`);
            postLoading(false, true);
            this.refreshInProgress = false;
            if (this.refreshPending) {
                this.refreshPending = false;
                this.scheduleRefresh("pending-after-scan");
            }
        }
    }

    private postConfig() {
        const { blacklistNames, blacklistExtensions } = configManager.get();
        this.view?.webview.postMessage({
            type: "config",
            blacklistNames,
            blacklistExtensions,
        });
    }

    private postNotice(notice: ScanNotice, scanRef?: number) {
        const prefix = scanRef !== undefined ? `[scan ${scanRef}] ` : "";
        logDebug(`${prefix}Notice (${notice.level}): ${notice.message}`);
        this.view?.webview.postMessage({
            type: "notice",
            level: notice.level,
            message: notice.message,
        });
    }
}
