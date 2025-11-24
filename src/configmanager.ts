import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import * as yaml from 'js-yaml';

export interface VaporConfig {
    endpoint?: string;
    type?: string;
    model?: string;
    workspace?: {
        sessions?: number;
        entries?: number;
        retention?: string;
    };
}

export class ConfigManager {
    public endpoint?: string;
    public useOllama: boolean = false;
    public useOllamaChat: boolean = false;
    public model?: string;
    public sessions: number = 20;
    public entries: number = 300;
    public retention: number = 30 * 24 * 60 * 60 * 1000;

    private configPath?: string;
    private watcher?: vscode.FileSystemWatcher;

    constructor(private readonly context: vscode.ExtensionContext) {
        this.configPath = this.findOrCreateConfig();
        this.load();
        this.startWatcher();
    }

    private findOrCreateConfig(): string | undefined {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders) {
            const wsConfig = path.join(workspaceFolders[0].uri.fsPath, 'vapor-config.yaml');
            if (fs.existsSync(wsConfig)) {
                return wsConfig;
            }
        }
        const homeDir = process.env.HOME || process.env.USERPROFILE;
        if (homeDir) {
            const vaporDir = path.join(homeDir, '.vapor');
            const userConfig = path.join(vaporDir, 'config.yaml');
            if (!fs.existsSync(vaporDir)) {
                fs.mkdirSync(vaporDir, { recursive: true });
            }
            if (!fs.existsSync(userConfig)) {
                const defaultConfig = path.join(this.context.extensionPath, 'config.yaml');
                if (fs.existsSync(defaultConfig)) {
                    fs.copyFileSync(defaultConfig, userConfig);
                }
            }
            return userConfig;
        }
        return undefined;
    }

    private load() {
        try {
            if (!this.configPath) return;

            const file = fs.readFileSync(this.configPath, 'utf8');
            const config = yaml.load(file) as VaporConfig;
            this.endpoint = config.endpoint;
            this.model = config.model;
            this.useOllama = config.type === 'ollama' || config.type === 'ollama-generate';
            this.useOllamaChat = config.type === 'ollama-chat';
            if (config.workspace) {
                this.sessions = config.workspace.sessions ?? this.sessions;
                this.entries = config.workspace.entries ?? this.entries;
                this.retention = this.parseDuration(config.workspace.retention, this.retention);
            }
            console.log('Vapor config loaded:', this.configPath, config);
        } catch (err) {
            console.error('Failed to load Vapor config:', err);
        }
    }

    private startWatcher() {
        if (!this.configPath) return;

        this.watcher = vscode.workspace.createFileSystemWatcher(this.configPath);
        this.watcher.onDidChange(() => this.load());
        this.watcher.onDidCreate(() => this.load());
        this.watcher.onDidDelete(() => {
            this.endpoint = undefined;
            this.useOllama = false;
            this.useOllamaChat = false;
            this.model = undefined;
            console.warn('Vapor config deleted, settings reset.');
        });
    }

    private parseDuration(value: string | undefined, fallbackMs: number): number {
        if (!value) return fallbackMs;
        const v = value.trim().toLowerCase();
        const match = /^(\d+)\s*(h|d|w|m|y)$/i.exec(v);
        if (!match) return fallbackMs;
        const amount = Number(match[1]);
        const unit = match[2];
        const H = 1000 * 60 * 60;
        const D = H * 24;
        const W = D * 7;
        const M = D * 30;
        const Y = D * 365;
        switch (unit) {
            case 'h': return amount * H;
            case 'd': return amount * D;
            case 'w': return amount * W;
            case 'm': return amount * M;
            case 'y': return amount * Y;
            default: return fallbackMs;
        }
    }
}
