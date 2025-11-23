import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { HistoryManager } from './historymanager';
import { ConfigManager } from './configmanager';
import { OllamaClient } from './ollamaclient';

export class ChatViewProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private history: HistoryManager;
    private config: ConfigManager;
    private ollama: OllamaClient;

    constructor(private readonly context: vscode.ExtensionContext) {
        this.config = new ConfigManager(context);
        this.history = new HistoryManager();
        this.ollama = new OllamaClient(this.config);
    }

    private addToHistory(sender: string, text: string) {
        try {
            this.history.add({ sender, text });
        } catch (err) {
            console.error("Failed to write session history:", err);
        }
    }

    public clearHistory() {
        try {
            this.history.clear();
        } catch (err) {
            console.error("Failed to clear session history:", err);
        }
    }

    public newSession() {
        this.history.createSession('Chat ' + new Date().toLocaleString());
        this.restoreHistoryToWebview();
    }

    public switchSession(id: string) {
        try {
            this.history.switchSession(id);
            this.restoreHistoryToWebview();
        } catch (err) {
            vscode.window.showErrorMessage('Failed to switch session: ' + err);
        }
    }

    public async showSessionPicker() {
        const sessions = this.history.listSessions();
        const items: vscode.QuickPickItem[] = Object.entries(sessions).map(([key, val]) => ({
            label: val.title ?? key.slice(0, 8),
            description: new Date(val.updatedAt).toLocaleString(),
            detail: key
        }));
        const pick = await vscode.window.showQuickPick(items, {
            title: 'Select Chat Session',
            placeHolder: 'Choose a chat session'
        });
        if (pick) {
            this.switchSession(pick.detail!);
        }
    }

    public restoreHistoryToWebview() {
        if (!this._view) return;
        this._view.webview.postMessage({ type: 'restore-history', history: this.history.getHistory() });
    }

    private async defaultRequest(userMessage: any) {
        if (!this.config.endpoint) return 'No endpoint configured.';
        try {
            const response = await fetch(this.config.endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: userMessage })
            });
            const result = response.json() as any;
            return result.reply ?? 'No reply in response';
        } catch (err) {
            return 'Error contacting endpoint: ' + err;
        }
    }

    public showSessionsInWebview() {
        if (!this._view) return;
        this._view.webview.postMessage({
            type: 'show-sessions',
            sessions: this.history.listSessions(),
            currentSessionId: this.history.getCurrentSessionId()
        });
    }

    resolveWebviewView(webviewView: vscode.WebviewView) {
        this._view = webviewView;

        webviewView.webview.options = { enableScripts: true };
        webviewView.webview.html = this.getHtml(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async (message) => {
            if (message.type === 'send') {
                const userMessage = message.text;
                this.addToHistory('user', userMessage);
                let botReply;
                if (this.config.useOllamaChat) {
                    botReply = await this.ollama.chat(userMessage);
                } else if (this.config.useOllama) {
                    botReply = await this.ollama.generate(userMessage);
                } else {
                    botReply = await this.defaultRequest(userMessage);
                }
                this.addToHistory('bot', botReply);
                webviewView.webview.postMessage({ type: 'reply', sender: 'bot', text: botReply });
            } else if (message.type === 'ready') {
                this.restoreHistoryToWebview();
            } else if (message.type === 'switch-session') {
                this.switchSession(message.id);
                this.restoreHistoryToWebview();
                this._view?.webview.postMessage({ type: 'session-changed' });
            } else if (message.type === 'new-session') {
                this.history.createSession('Session ' + new Date().toLocaleString());
                this.restoreHistoryToWebview();
                this.showSessionsInWebview();
            } else if (message.type === 'request-session-list') {
                this.showSessionsInWebview();
            } else if (message.type === 'rename-session') {
                this.history.renameSession(message.id, message.title);
                this.showSessionsInWebview();
            } else if (message.type === 'delete-session') {
                this.history.deleteSession(message.id);
                this.restoreHistoryToWebview();
                this.showSessionsInWebview();
            }
        });
    }

    private getHtml(webview: vscode.Webview) {
        const mediaPath = path.join(this.context.extensionPath, 'dist/media');

        const htmlPath = vscode.Uri.file(path.join(mediaPath, 'chat.html'));
        const cssPath = vscode.Uri.file(path.join(mediaPath, 'chat.css'));
        const jsPath = vscode.Uri.file(path.join(mediaPath, 'chat.js'));
        const hljsCssPath = vscode.Uri.file(path.join(mediaPath, 'highlight.min.css'));
        const hljsJsPath = vscode.Uri.file(path.join(mediaPath, 'highlight.min.js'));

        const cssUri = webview.asWebviewUri(cssPath);
        const jsUri = webview.asWebviewUri(jsPath);
        const hljsCssUri = webview.asWebviewUri(hljsCssPath);
        const hljsJsUri = webview.asWebviewUri(hljsJsPath);

        const nonce = getNonce();
        let html = fs.readFileSync(htmlPath.fsPath, 'utf8');

        return html
            .replace(/\$\{nonce\}/g, nonce)
            .replace(/\$\{cssUri\}/g, cssUri.toString())
            .replace(/\$\{jsUri\}/g, jsUri.toString())
            .replace(/\$\{hljsCssUri\}/g, hljsCssUri.toString())
            .replace(/\$\{hljsJsUri\}/g, hljsJsUri.toString())
            .replace(/\$\{webviewCspSource\}/g, webview.cspSource);
    }

    addCodeSnipet(editor: vscode.TextEditor) {
        const selection = editor.document.getText(editor.selection);
        if (!selection.trim()) {
            return vscode.window.showWarningMessage('No code selected.');
        }
        if (this._view) {
            this._view.webview.postMessage({ type: 'insert-snippet', code: selection });
        }
    }
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) text += possible.charAt(Math.floor(Math.random() * possible.length));
    return text;
}