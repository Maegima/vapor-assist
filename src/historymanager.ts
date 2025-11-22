import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

export interface ChatEntry {
    sender: string;
    text: string;
}

export class HistoryManager {
    private sessionsDir: string;
    private sessionsIndexFile: string;

    private sessionFile: string | undefined;
    private sessionId: string | undefined;
    private workspaceId: string;

    constructor() {
        const home = process.env.HOME || process.env.USERPROFILE;
        this.sessionsDir = path.join(home!, '.vapor', 'sessions');
        const workspaceFolders = vscode.workspace.workspaceFolders;
        this.workspaceId = workspaceFolders?.[0]?.uri.fsPath ?? 'no-workspace';

        if (!fs.existsSync(this.sessionsDir))
            fs.mkdirSync(this.sessionsDir, { recursive: true });

        this.sessionsIndexFile = path.join(this.sessionsDir, 'sessions.json');
        if (!fs.existsSync(this.sessionsIndexFile)) {
            fs.writeFileSync(this.sessionsIndexFile, JSON.stringify({}), 'utf8');
        }

        this.loadOrCreateSession();
    }

    private loadOrCreateSession() {
        const index = JSON.parse(fs.readFileSync(this.sessionsIndexFile, 'utf8'));
        if (index[this.workspaceId]) {
            this.sessionId = index[this.workspaceId];
        } else {
            this.sessionId = this.generateHash();
            index[this.workspaceId] = this.sessionId;
            fs.writeFileSync(this.sessionsIndexFile, JSON.stringify(index, null, 2), 'utf8');
        }
        this.sessionFile = path.join(this.sessionsDir, `${this.sessionId}.json`);
        if (!fs.existsSync(this.sessionFile)) {
            fs.writeFileSync(this.sessionFile, JSON.stringify([]), 'utf8');
        }
    }

    private generateHash(): string {
        return [...Array(32)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
    }

    public getHistory(): ChatEntry[] {
        if (!this.sessionFile) return [];
        try {
            const raw = fs.readFileSync(this.sessionFile, 'utf8');
            return JSON.parse(raw);
        } catch {
            return [];
        }
    }

    public add(entry: ChatEntry) {
        if (!this.sessionFile) return;
        const history = this.getHistory();
        history.push(entry);
        fs.writeFileSync(this.sessionFile, JSON.stringify(history, null, 2), 'utf8');
    }

    public clear() {
        if (!this.sessionFile) return;
        fs.writeFileSync(this.sessionFile, JSON.stringify([], null, 2), 'utf8');
    }
}
