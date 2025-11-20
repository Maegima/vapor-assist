import * as vscode from 'vscode';
import { ChatPanel } from './chatpanel';
import { ChatViewProvider } from './chatview';

export function activate(context: vscode.ExtensionContext) {
    const viewProvider = new ChatViewProvider(context);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            'chatView',
            viewProvider
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('chatView.openPanel', () => {
            ChatPanel.createOrShow(context.extensionUri);
        })
    );
}

export function deactivate() {}

