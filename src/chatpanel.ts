import * as vscode from 'vscode';

export class ChatPanel {
    public static currentPanel: ChatPanel | undefined;
    private readonly panel: vscode.WebviewPanel;
    private disposables: vscode.Disposable[] = [];

    private constructor(panel: vscode.WebviewPanel) {
        this.panel = panel;

        this.panel.webview.options = {
            enableScripts: true
        };

        this.panel.webview.html = this.getHtml();

        // Handle messages from the webview
        this.panel.webview.onDidReceiveMessage(message => {
            if (message.type === 'send') {
                this.panel.webview.postMessage({
                    type: 'reply',
                    text: `You said: ${message.text}`
                });
            }
        }, null, this.disposables);

        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    }

    public static createOrShow(extensionUri: vscode.Uri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // Show existing panel if it exists
        if (ChatPanel.currentPanel) {
            ChatPanel.currentPanel.panel.reveal(column);
            return;
        }

        // Otherwise, create a new panel
        const panel = vscode.window.createWebviewPanel(
            'chatPanel', // Identifies the panel type
            'Chat Panel', // Title
            column || vscode.ViewColumn.One,
            { enableScripts: true }
        );

        ChatPanel.currentPanel = new ChatPanel(panel);
    }

    public dispose() {
        ChatPanel.currentPanel = undefined;

        this.panel.dispose();

        while (this.disposables.length) {
            const d = this.disposables.pop();
            if (d) d.dispose();
        }
    }

    private getHtml(): string {
        return `
        <!DOCTYPE html>
        <html lang="en">
        <body style="padding:10px; font-family:sans-serif;">
            <h3>Floating Chat Panel</h3>
            <div id="messages" style="
                border:1px solid #ccc;
                padding:8px;
                height:200px;
                overflow-y:auto;
                margin-bottom:10px;">
            </div>

            <input id="input" type="text" placeholder="Type a message…" 
                style="width:100%; padding:6px;"/>
            <button id="send" style="margin-top:6px; width:100%;">Send</button>

            <script>
                const vscode = acquireVsCodeApi();

                document.getElementById('send').onclick = () => {
                    const text = document.getElementById('input').value;
                    vscode.postMessage({ type: 'send', text });
                };

                window.addEventListener('message', (event) => {
                    const msg = event.data;
                    if (msg.type === 'reply') {
                        const box = document.getElementById('messages');
                        box.innerHTML += '<div>' + msg.text + '</div>';
                    }
                });
            </script>
        </body>
        </html>
        `;
    }
}