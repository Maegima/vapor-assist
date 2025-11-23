import * as vscode from 'vscode';
import { ChatPanel } from './chatpanel';
import { ChatViewProvider } from './chatview';

export function activate(context: vscode.ExtensionContext) {
    const viewProvider = new ChatViewProvider(context);

    context.subscriptions.push(vscode.window.registerWebviewViewProvider('chatView', viewProvider));

    context.subscriptions.push(
        vscode.commands.registerCommand('vaporAssist.openPanel', () => {
            ChatPanel.createOrShow(context.extensionUri);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vaporAssist.addSelectedCode', async () => {
            await vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');
            const editor = vscode.window.activeTextEditor;
            if (!editor) return vscode.window.showErrorMessage('No active editor.');
            viewProvider.addCodeSnipet(editor);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vaporAssist.clearHistory', () => {
            viewProvider.clearHistory();
            vscode.window.showInformationMessage('Vapor chat history cleared.');
            viewProvider.restoreHistoryToWebview();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vaporAssist.newSession', () => viewProvider.newSession())
    );
    context.subscriptions.push(
        vscode.commands.registerCommand('vaporAssist.pickSession', () => viewProvider.showSessionPicker())
    );
}

export function deactivate() {}

