import * as vscode from "vscode";
import { ExtensionConfig } from "./types";

const CONFIG_SECTION = "repo2aicontext";

export class ConfigManager {
    public get(): ExtensionConfig {
        const cfg = vscode.workspace.getConfiguration(CONFIG_SECTION);
        return {
            ignores: cfg.get<string[]>("ignoreGlobs") ?? [],
            maxKB: cfg.get<number>("maxFileSizeKB") ?? 1024,
            skipBin: cfg.get<boolean>("skipBinaries") ?? true,
            smartIgnore: cfg.get<boolean>("smartIgnore") ?? true,
            dirEntrySkipThreshold:
                cfg.get<number>("dirEntrySkipThreshold") ?? 2000,
            blacklistNames: cfg.get<string[]>("blacklistNames") ?? [],
            blacklistExtensions: cfg.get<string[]>("blacklistExtensions") ?? [],
        };
    }

    public async updateBlacklist(
        type: "blacklistNames" | "blacklistExtensions",
        add?: string,
        remove?: string
    ) {
        const cfg = vscode.workspace.getConfiguration(CONFIG_SECTION);
        let list = cfg.get<string[]>(type) ?? [];

        if (remove) {
            list = list.filter((x) => x.toLowerCase() !== remove.toLowerCase());
        }
        if (add) {
            if (!list.some((x) => x.toLowerCase() === add.toLowerCase())) {
                list.push(add);
            }
        }
        await cfg.update(type, list, vscode.ConfigurationTarget.Workspace);
    }
}

export const configManager = new ConfigManager();
