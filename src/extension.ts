import * as vscode from "vscode";
import { Repo2AIContextViewProvider } from "./webview/provider";
import { captureWorkspace } from "./services/capturer";

export function activate(context: vscode.ExtensionContext) {
    const provider = new Repo2AIContextViewProvider(context.extensionUri);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            "repo2aicontextView",
            provider
        ),
        vscode.commands.registerCommand(
            "repo2aicontext.capture",
            (selection: string[] = []) => captureWorkspace(selection)
        )
    );

    const cfg = () => vscode.workspace.getConfiguration("repo2aicontext");
    const shouldAuto = () => cfg().get<boolean>("autoRefresh", true);
    const debouncedRefresh = debounce(() => {
        if (shouldAuto()) provider.refresh();
    }, 400);

    const watcher = vscode.workspace.createFileSystemWatcher(
        "**/*",
        false,
        false,
        false
    );

    context.subscriptions.push(
        watcher,
        watcher.onDidCreate(debouncedRefresh),
        watcher.onDidDelete(debouncedRefresh),
        watcher.onDidChange(debouncedRefresh),
        vscode.workspace.onDidChangeConfiguration((event) => {
            if (event.affectsConfiguration("repo2aicontext")) {
                provider.refresh();
            }
        }),
        vscode.workspace.onDidChangeWorkspaceFolders(() => provider.refresh())
    );
}

export function deactivate() {}

function debounce(fn: () => void, wait: number) {
    let handle: NodeJS.Timeout | undefined;
    return () => {
        clearTimeout(handle);
        handle = setTimeout(() => fn(), wait);
    };
}
