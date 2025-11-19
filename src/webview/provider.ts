import * as vscode from "vscode";
import { FileScanner, ScanNotice } from "../services/scanner";
import { configManager } from "../config";
import { getWebviewContent } from "./template";
import { PROGRESS_THROTTLE_MS } from "../constants";

export class Repo2AIContextViewProvider implements vscode.WebviewViewProvider {
    private view?: vscode.WebviewView;
    private scanId = 0;
    private lastProgressSent = 0;
    private webviewReady = false;
    private pendingRefresh = false;

    constructor(private readonly _extensionUri: vscode.Uri) {}

    resolveWebviewView(view: vscode.WebviewView) {
        this.view = view;
        this.webviewReady = false;
        this.pendingRefresh = true;

        view.webview.options = { enableScripts: true };
        view.webview.html = getWebviewContent();

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
                        this.refresh();
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
                        this.refresh();
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
                        this.refresh();
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
                        this.refresh();
                    }
                    break;
                }
                case "webview-ready":
                    this.webviewReady = true;
                    if (this.pendingRefresh) this.refresh();
                    break;
                case "request-config":
                    this.postConfig();
                    break;
                default:
                    break;
            }
        });
    }

    public async refresh() {
        if (!this.view) return;
        if (!this.webviewReady) {
            this.pendingRefresh = true;
            return;
        }
        this.pendingRefresh = false;

        const workspace = vscode.workspace.workspaceFolders?.[0];
        const currentScan = ++this.scanId;
        this.lastProgressSent = 0;

        this.view.webview.postMessage({ type: "loading", value: true });
        this.postConfig();
        this.view.webview.postMessage({
            type: "progress",
            phase: "count",
            current: 0,
            total: 0,
        });

        if (!workspace) {
            if (currentScan !== this.scanId) return;
            this.view.webview.postMessage({ type: "refresh", tree: [] });
            this.view.webview.postMessage({ type: "loading", value: false });
            return;
        }

        const scanner = new FileScanner(workspace.uri, {
            isCancelled: () => currentScan !== this.scanId,
            onNotice: (notice) => this.postNotice(notice),
        });

        const total = await scanner.countFiles((count, rel) => {
            this.view?.webview.postMessage({
                type: "progress",
                phase: "count",
                current: count,
                total: 0,
                rel,
            });
        });

        if (currentScan !== this.scanId) return;

        this.view.webview.postMessage({
            type: "progress",
            phase: "scan",
            current: 0,
            total,
        });

        const tree = await scanner.buildTree((processed, rel) => {
            const now = Date.now();
            if (
                now - this.lastProgressSent > PROGRESS_THROTTLE_MS ||
                processed % 25 === 0 ||
                processed === total
            ) {
                this.lastProgressSent = now;
                this.view?.webview.postMessage({
                    type: "progress",
                    phase: "scan",
                    current: processed,
                    total,
                    rel,
                });
            }
        });

        if (currentScan !== this.scanId) return;

        this.view.webview.postMessage({ type: "refresh", tree });
        this.view.webview.postMessage({ type: "loading", value: false });
    }

    private postConfig() {
        const { blacklistNames, blacklistExtensions } = configManager.get();
        this.view?.webview.postMessage({
            type: "config",
            blacklistNames,
            blacklistExtensions,
        });
    }

    private postNotice(notice: ScanNotice) {
        this.view?.webview.postMessage({
            type: "notice",
            level: notice.level,
            message: notice.message,
        });
    }
}
