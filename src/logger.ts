import * as vscode from "vscode";

type Level = "INFO" | "WARN" | "ERROR" | "DEBUG";

const channel = vscode.window.createOutputChannel("Repo2AIContext");

function log(level: Level, message: string) {
    const ts = new Date().toISOString();
    channel.appendLine(`[${ts}] [${level}] ${message}`);
}

export function logInfo(message: string) {
    log("INFO", message);
}

export function logWarn(message: string) {
    log("WARN", message);
}

export function logDebug(message: string) {
    log("DEBUG", message);
}

export function logError(message: string, error?: unknown) {
    log("ERROR", message);
    if (error instanceof Error) {
        const stack = error.stack ?? error.message;
        log("ERROR", stack);
    } else if (error) {
        log("ERROR", String(error));
    }
}
