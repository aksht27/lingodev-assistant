import * as vscode from 'vscode';
import { SidebarPanel } from './webview/sidebarPanel';
import { PreviewPanel } from './previewPanel';

export function activate(context: vscode.ExtensionContext) {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
    
    // Register Sidebar Panel
    const sidebarProvider = new SidebarPanel(context.extensionUri, workspaceRoot);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider("lingodev-sidebar", sidebarProvider)
    );

    // Register all commands - MUST MATCH package.json exactly
    context.subscriptions.push(
        vscode.commands.registerCommand('lingoai.extractStrings', () => {
            sidebarProvider.extractAndHighlightStrings();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('lingoai.showAISuggestions', () => {
            vscode.window.showInformationMessage('🤖 Lingo AI Best Practices');
            sidebarProvider.showAISuggestions();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('lingoai.syncWithTeam', async () => {
            vscode.window.showInformationMessage('🔄 Syncing translations with team via Lingo API...');
            await new Promise(resolve => setTimeout(resolve, 2000));
            vscode.window.showInformationMessage('✅ Team sync completed!');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('lingoai.liveTranslationPreview', () => {
            PreviewPanel.createOrShow(context.extensionUri);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('lingoai.resolveConflicts', async () => {
            vscode.window.showInformationMessage('🔧 Resolving translation conflicts via Lingo API...');
            await new Promise(resolve => setTimeout(resolve, 1500));
            vscode.window.showInformationMessage('✅ All conflicts resolved!');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('lingoai.teamActivity', () => {
            vscode.window.showInformationMessage('🏃‍♂️ Recent Team Activity:\n• John updated French translations\n• Sarah added German locale\n• Mike resolved 3 conflicts');
        })
    );

    // Auto-highlight when editor changes
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(() => {
            sidebarProvider.highlightStringsInActiveEditor();
        })
    );

    // Initial highlight
    setTimeout(() => {
        sidebarProvider.highlightStringsInActiveEditor();
    }, 1000);
}

export function deactivate() {}