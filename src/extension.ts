import * as vscode from 'vscode';
import { StringDiagnosticProvider } from './diagnostics';
import { StringCodeActionProvider } from './codeActionProvider';
import { SidebarPanel } from './webview/sidebarPanel';
import { exec } from 'child_process';

// This method is called when your extension is activated
export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "lingodev-assistant" is now active!');

    // --- Test Activation Command ---
    const testActivation = vscode.commands.registerCommand('lingodev-assistant.testActivation', () => {
        vscode.window.showInformationMessage('LingoDev Assistant Test Working!');
    });
    context.subscriptions.push(testActivation);

    // --- Show Sidebar Panel Command ---
    const showSidebar = vscode.commands.registerCommand('lingodev-assistant.showSidebar', () => {
        SidebarPanel.createOrShow(context.extensionUri);
    });
    context.subscriptions.push(showSidebar);

    // --- Activate Hardcoded String Diagnostics ---
    const stringDiagnostics = new StringDiagnosticProvider();
    stringDiagnostics.activate(context);

    // --- Register Quick Fix / Code Action Provider ---
    const codeActionProvider = vscode.languages.registerCodeActionsProvider(
        ['javascript', 'typescript'],
        new StringCodeActionProvider(),
        {
            providedCodeActionKinds: StringCodeActionProvider.providedCodeActionKinds
        }
    );
    context.subscriptions.push(codeActionProvider);

    // --- Register Extract Command (Runs Lingo CLI) ---
    const extractCommand = vscode.commands.registerCommand(
        'lingodev-assistant.extractString',
        () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active editor found!');
                return;
            }

            const selection = editor.selection;
            const text = editor.document.getText(selection);

            if (!text) {
                vscode.window.showWarningMessage('No text selected!');
                return;
            }

            exec(`lingo extract "${text}"`, (error, stdout, stderr) => {
                if (error) {
                    vscode.window.showErrorMessage(`Lingo Extract Failed: ${error.message}`);
                    return;
                }
                if (stderr) {
                    vscode.window.showErrorMessage(`Lingo Extract Error: ${stderr}`);
                    return;
                }

                vscode.window.showInformationMessage(`String extracted to Lingo: ${text}`);

                // Send extracted string to the sidebar if it's open
                if (SidebarPanel.currentPanel) {
                    SidebarPanel.currentPanel.postMessage({
                        command: 'addStringToUI', // <-- updated command
                        text
                    });
                }
            });
        }
    );
    context.subscriptions.push(extractCommand);

    // --- Listen to messages from the Sidebar Webview ---
    vscode.window.registerWebviewPanelSerializer('lingodev-sidebar', {
        async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel, state: any) {
            SidebarPanel.revive(webviewPanel, context.extensionUri);
        }
    });
}

// This method is called when your extension is deactivated
export function deactivate() {}
