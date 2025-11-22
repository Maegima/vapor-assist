import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { HistoryManager } from './historymanager';
import { ConfigManager } from './configmanager';

// ---------------
// Chat API types
// ---------------
export interface OllamaChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export interface OllamaChatRequest {
    model: string;
    messages: OllamaChatMessage[];
    stream?: boolean;
}

export interface OllamaChatResponse {
    model: string;
    created_at: string;
    message: OllamaChatMessage;
    done: boolean;
    done_reason: string;

    total_duration: number;
    load_duration: number;

    prompt_eval_count: number;
    prompt_eval_duration: number;

    eval_count: number;
    eval_duration: number;
}


// -----------------------------
// Ollama Request Payload
// -----------------------------
export interface OllamaGenerateRequest {
    model: string;     // Name of the model to run
    prompt: string;    // User message
    stream?: boolean;  // false for non-streaming responses
}

// -----------------------------
// Ollama Response Format
// -----------------------------
export interface OllamaGenerateResponse {
    model: string;
    created_at: string;
    response: string; // The generated text
    done: boolean;
    done_reason: string;
    total_duration: number;
    load_duration: number;
    prompt_eval_count: number;
    prompt_eval_duration: number;
    eval_count: number;
    eval_duration: number;
}

export class ChatViewProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private history: HistoryManager;
    private config: ConfigManager;


    constructor(private readonly context: vscode.ExtensionContext) {
        this.config = new ConfigManager(context);
        this.history = new HistoryManager();
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

    public restoreHistoryToWebview() {
        if (!this._view) return;
        this._view.webview.postMessage({ type: 'restore-history', history: this.history.getHistory() });
    }

    resolveWebviewView(webviewView: vscode.WebviewView) {
        this._view = webviewView;

        webviewView.webview.options = { enableScripts: true };
        webviewView.webview.html = this.getHtml(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async (message) => {
            if (message.type === 'send') {
                const userMessage = message.text;
                this.addToHistory('user', userMessage);
                let botReply = 'No endpoint configured.';
                if (this.config.endpoint) {
                    try {
                        if (this.config.useOllamaChat) {
                            botReply = await this.sendToOllamaChat(userMessage);
                        } else if (this.config.useOllama) {
                            botReply = await this.sendToOllamaGenerate(userMessage);
                        } else {
                            const response = await fetch(this.config.endpoint, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ message: userMessage })
                            });
                            const data = await response.json() as any;
                            botReply = data.reply ?? 'No reply in response';
                        }
                    } catch (err) {
                        botReply = 'Error contacting endpoint: ' + err;
                    }
                }
                this.addToHistory('bot', botReply);
                webviewView.webview.postMessage({ type: 'reply', sender: 'bot', text: botReply });
            } else if (message.type === 'ready') {
                this.restoreHistoryToWebview();
            }
        });
    }

    private async sendToOllamaGenerate(message: string): Promise<string> {
        if (!this.config.endpoint) return "No endpoint configured.";

        const payload: OllamaGenerateRequest = {
            model: this.config.model ?? "example-model",
            prompt: message,
            stream: false
        };

        const response = await fetch(this.config.endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json() as OllamaGenerateResponse;

        return result.response ?? "No response returned by Ollama.";
    }

    private async sendToOllamaChat(message: string): Promise<string> {
        if (!this.config.endpoint) return "No endpoint configured.";

        const payload: OllamaChatRequest = {
            model: this.config.model ?? "example-chat-model",
            messages: [
                { role: "user", content: message }
            ],
            stream: false
        };

        const response = await fetch(this.config.endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json() as OllamaChatResponse;

        return result.message?.content ?? "No message returned by Ollama Chat.";
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

        html = html
            .replace(/\$\{nonce\}/g, nonce)
            .replace(/\$\{cssUri\}/g, cssUri.toString())
            .replace(/\$\{jsUri\}/g, jsUri.toString())
            .replace(/\$\{hljsCssUri\}/g, hljsCssUri.toString())
            .replace(/\$\{hljsJsUri\}/g, hljsJsUri.toString())
            .replace(/\$\{webviewCspSource\}/g, webview.cspSource);

        return html;
    }

    addCodeSnipet(editor: vscode.TextEditor) {
        const selection = editor.document.getText(editor.selection);
        if (!selection.trim()) {
            return vscode.window.showWarningMessage('No code selected.');
        }
        if (this._view) {
            this._view.webview.postMessage({
                type: 'insert-snippet',
                code: selection
            });
        }
    }
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) text += possible.charAt(Math.floor(Math.random() * possible.length));
    return text;
}