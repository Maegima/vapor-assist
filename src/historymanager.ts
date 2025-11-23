import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export interface ChatEntry {
    sender: string;
    text: string;
}

export class SessionData {
    private _id: string = this.generateHash();
    public title: string = 'New Chat Session';
    public createdAt: number = Date.now();
    public updatedAt: number = this.createdAt;
    public constructor(title: string) {
        this.title = title;
    }
    public get id() { return this._id; }
    private generateHash(): string {
        return [...Array(32)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
    }
    public toJSON() { return { title: this.title, createdAt: this.createdAt, updatedAt: this.updatedAt } }
}

interface SessionDict {
    [key: string]: SessionData
}

export interface WorkspaceSessions {
    current: string;
    sessions: SessionDict;
}

export class HistoryManager {
    private sessionsDir: string;
    private sessionsIndexFile: string;
    private workspaceId: string;
    private sessionsIndex: Record<string, { current: string; sessions: SessionDict }> = {};
    private wsSessions!: WorkspaceSessions;
    private currentSessionFile!: string;

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

        this.loadIndex();
        this.loadOrCreateSession();
    }

    private loadIndex() {
        try {
            this.sessionsIndex = JSON.parse(fs.readFileSync(this.sessionsIndexFile, 'utf8'));
        } catch {
            this.sessionsIndex = {};
        }
    }

    private saveIndex() {
        fs.writeFileSync(this.sessionsIndexFile, JSON.stringify(this.sessionsIndex, null, 2), 'utf8');
    }

    private sessionPath(id: string) {
        return path.join(this.sessionsDir, `${id}.json`);
    }

    private createSessionInternal(title: string): SessionData {
        const session = new SessionData(title);
        const file = this.sessionPath(session.id);
        fs.writeFileSync(file, JSON.stringify([], null, 2), 'utf8');
        return session;
    }

    private loadOrCreateSession(title = 'New Chat Session') {
        this.wsSessions = this.sessionsIndex[this.workspaceId];
        if (!this.wsSessions) {
            const session = this.createSessionInternal('New Chat Session');
            const sessions: SessionDict = {};
            sessions[session.id] = session;
            this.wsSessions = { current: session.id, sessions };
            this.sessionsIndex[this.workspaceId] = this.wsSessions;
            this.saveIndex();
        }
        this.currentSessionFile = this.sessionPath(this.wsSessions.current);
        if (!fs.existsSync(this.currentSessionFile)) {
            fs.writeFileSync(this.currentSessionFile, JSON.stringify([], null, 2), 'utf8');
        }
    }

    public createSession(title = 'New Session'): SessionData {
        const session = this.createSessionInternal(title);
        this.wsSessions.sessions[session.id] = session;
        this.wsSessions.current = session.id;
        this.saveIndex();
        this.currentSessionFile = this.sessionPath(session.id);
        return session;
    }

    public switchSession(id: string) {
        if (this.wsSessions.sessions[id] === undefined)
            throw new Error('Session does not exist: ' + id);
        this.wsSessions.current = id;
        this.saveIndex();
        this.currentSessionFile = this.sessionPath(id);
    }

    public listSessions(): SessionDict {
        return this.wsSessions.sessions;
    }

    public getCurrentSessionId(): string {
        return this.wsSessions.current;
    }

    public getHistory(): ChatEntry[] {
        try {
            return JSON.parse(fs.readFileSync(this.currentSessionFile, 'utf8'));
        } catch {
            return [];
        }
    }

    public add(entry: ChatEntry) {
        const history = this.getHistory();
        history.push(entry);
        fs.writeFileSync(this.currentSessionFile, JSON.stringify(history, null, 2), 'utf8');
        const session = this.wsSessions.sessions[this.wsSessions.current];
        if (session) session.updatedAt = Date.now();
        this.saveIndex();
    }

    public clear() {
        fs.writeFileSync(this.currentSessionFile, JSON.stringify([], null, 2), 'utf8');
    }
}
