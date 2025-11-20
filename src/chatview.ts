import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

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
    private endpoint: string | undefined;
    private useOllama: boolean = false;
    private useOllamaChat: boolean = false;
    private configPath: string | undefined;
    private ollamaModel: string | undefined;
    private watcher: vscode.FileSystemWatcher | undefined;

    constructor(private readonly context: vscode.ExtensionContext) {
        this.loadConfig();
        this.watchConfig();
    }

    private loadConfig() {
        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) return;

            this.configPath = path.join(workspaceFolders[0].uri.fsPath, 'chat-config.yaml');
            if (!fs.existsSync(this.configPath)) return;

            const fileContents = fs.readFileSync(this.configPath, 'utf8');
            const config = yaml.load(fileContents) as { endpoint?: string; type?: string; model?: string };

            this.endpoint = config.endpoint;
            this.useOllama = config.type === 'ollama' || config.type === 'ollama-generate';
            this.useOllamaChat = config.type === 'ollama-chat';
            this.ollamaModel = config.model;

            console.log('Loaded config:', config);
        } catch (err) {
            console.error('Failed to load chat-config.yaml:', err);
        }
    }

    private watchConfig() {
        if (!this.configPath) return;

        this.watcher = vscode.workspace.createFileSystemWatcher(this.configPath);
        this.watcher.onDidChange(() => this.loadConfig());
        this.watcher.onDidCreate(() => this.loadConfig());
        this.watcher.onDidDelete(() => {
            this.endpoint = undefined;
            this.useOllama = false;
            console.warn('chat-config.yaml deleted, endpoint cleared.');
        });
    }

    resolveWebviewView(webviewView: vscode.WebviewView) {
        this._view = webviewView;

        webviewView.webview.options = { enableScripts: true };
        webviewView.webview.html = this.getHtml(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async (message) => {
            if (message.type === 'send') {
                const userMessage = message.text;
                let botReply = 'No endpoint configured.';

                if (this.endpoint) {
                    try {
                        if (this.useOllamaChat) {
                            botReply = await this.sendToOllamaChat(userMessage);
                        } else if (this.useOllama) {
                            botReply = await this.sendToOllamaGenerate(userMessage);
                        } else {
                            const response = await fetch(this.endpoint, {
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

                // Display messages
                webviewView.webview.postMessage({ type: 'reply', sender: 'user', text: userMessage });
                webviewView.webview.postMessage({ type: 'reply', sender: 'bot', text: botReply });
            }
        });
    }

    private async sendToOllamaGenerate(message: string): Promise<string> {
        if (!this.endpoint) return "No endpoint configured.";

        const payload: OllamaGenerateRequest = {
            model: this.ollamaModel ?? "example-model",
            prompt: message,
            stream: false
        };

        const response = await fetch(this.endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json() as OllamaGenerateResponse;

        return result.response ?? "No response returned by Ollama.";
    }

    private async sendToOllamaChat(message: string): Promise<string> {
        if (!this.endpoint) return "No endpoint configured.";

        const payload: OllamaChatRequest = {
            model: this.ollamaModel ?? "example-chat-model",
            messages: [
                { role: "user", content: message }
            ],
            stream: false
        };

        const response = await fetch(this.endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json() as OllamaChatResponse;

        return result.message?.content ?? "No message returned by Ollama Chat.";
    }

    private getHtml(webview: vscode.Webview) {
        const mediaPath = path.join(this.context.extensionPath, 'src/media');

        const htmlPath = vscode.Uri.file(path.join(mediaPath, 'chat.html'));
        const cssPath = vscode.Uri.file(path.join(mediaPath, 'chat.css'));
        const jsPath = vscode.Uri.file(path.join(mediaPath, 'chat.js'));

        const cssUri = webview.asWebviewUri(cssPath);
        const jsUri = webview.asWebviewUri(jsPath);

        const nonce = getNonce();
        let html = fs.readFileSync(htmlPath.fsPath, 'utf8');

        html = html
            .replace(/\$\{nonce\}/g, nonce)
            .replace(/\$\{cssUri\}/g, cssUri.toString())
            .replace(/\$\{jsUri\}/g, jsUri.toString())
            .replace(/\$\{webviewCspSource\}/g, webview.cspSource);

        return html;
    }
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) text += possible.charAt(Math.floor(Math.random() * possible.length));
    return text;
}