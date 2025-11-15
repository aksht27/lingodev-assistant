import * as vscode from 'vscode';
import { promisify } from 'util';
import { exec } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { StringDiagnosticProvider } from './diagnostics';
import { StringCodeActionProvider } from './codeActionProvider';
import { SidebarPanel } from './webview/sidebarPanel';
import { InlineTranslationProvider } from './inlineTranslationProvider';
import { PreviewPanel } from './previewPanel';
import { AISuggestionProvider } from './aiSuggestionProvider';
import { TeamCollaboration } from './teamCollaboration';

const execAsync = promisify(exec);

let inlineTranslationProvider: InlineTranslationProvider | undefined;
let aiSuggestionProvider: AISuggestionProvider | undefined;
let teamCollaboration: TeamCollaboration | undefined;

async function runLingoAndUpdateSidebar(selectedText: string) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
    if (!workspaceFolder) {
        throw new Error('No workspace folder found');
    }

    console.log('🔄 Starting Lingo CLI...');
    const command = `npx lingo.dev@latest run`;
    
    try {
        const { stdout, stderr } = await execAsync(command, {
            cwd: workspaceFolder,
            maxBuffer: 1024 * 1024
        });

        console.log('✅ Lingo CLI stdout:', stdout);
        if (stderr) {
            console.warn('⚠️ Lingo CLI stderr:', stderr);
        }

        vscode.window.showInformationMessage('✅ Localization pipeline completed!');

        // Update all features with new translations
        await updateAllFeatures(workspaceFolder, selectedText);
        
    } catch (err: any) {
        console.error('❌ Error running Lingo CLI:', err);
        vscode.window.showErrorMessage(`Localization error: ${err.message}`);
        throw err;
    }
}

async function updateAllFeatures(workspaceFolder: string, selectedText: string) {
    try {
        // Read translation files
        const enFile = path.join(workspaceFolder, 'i18n', 'en.json');
        const esFile = path.join(workspaceFolder, 'i18n', 'es.json');
        
        const enContent = await fs.readFile(enFile, 'utf-8');
        const esContent = await fs.readFile(esFile, 'utf-8');
        
        const enTranslations: Record<string, string> = JSON.parse(enContent);
        const esTranslations: Record<string, string> = JSON.parse(esContent);

        // Create display strings for sidebar
        const displayStrings: string[] = [];
        for (const [key, enText] of Object.entries(enTranslations)) {
            const esText = esTranslations[key] || '[Not translated]';
            displayStrings.push(`EN: ${enText} → ES: ${esText}`);
        }

        // Update sidebar
        if (SidebarPanel.hasCurrentPanel()) {
            SidebarPanel.safePostMessage({
                command: 'addMultipleStrings',
                strings: displayStrings
            });
            vscode.window.showInformationMessage(`📊 Showing ${displayStrings.length} translations in sidebar`);
        }

        // Update inline translations
        const editor = vscode.window.activeTextEditor;
        if (editor && inlineTranslationProvider) {
            inlineTranslationProvider.updateInlineTranslations(editor);
        }

        // Show AI suggestions for the selected text
        if (aiSuggestionProvider && selectedText) {
            const suggestions = await aiSuggestionProvider.getAISuggestions(selectedText);
            vscode.window.showInformationMessage('🤖 AI Suggestions Available - Check output panel');
            console.log('🎯 Lingo AI Suggestions:', suggestions);
        }

    } catch (error) {
        console.error('Error updating features:', error);
    }
}

async function initializeLingo(workspaceFolder: string) {
    try {
        console.log('🔄 Initializing Lingo...');
        const { stdout, stderr } = await execAsync('npx lingo.dev@latest init -y', {
            cwd: workspaceFolder,
            maxBuffer: 1024 * 1024
        });
        
        console.log('✅ Lingo init stdout:', stdout);
        if (stderr) {
            console.warn('⚠️ Lingo init stderr:', stderr);
        }
        
        vscode.window.showInformationMessage('✅ Lingo initialized successfully!');
        
    } catch (err: any) {
        vscode.window.showErrorMessage(`❌ Failed to initialize Lingo: ${err.message}`);
        throw err;
    }
}

export function activate(context: vscode.ExtensionContext) {
    console.log('🚀 LingoDev Assistant extension is now active!');

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('❌ Please open a workspace folder first.');
        return;
    }

    // Initialize providers
    inlineTranslationProvider = new InlineTranslationProvider(workspaceFolder);
    aiSuggestionProvider = new AISuggestionProvider(workspaceFolder);
    teamCollaboration = new TeamCollaboration(workspaceFolder);

    // Register Sidebar Panel Provider
    const sidebarProvider = new SidebarPanel(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(SidebarPanel.viewType, sidebarProvider)
    );

    // Register commands
    const commands = [
        // Existing commands
        vscode.commands.registerCommand('lingodev-assistant.testActivation', () => {
            vscode.window.showInformationMessage('🎉 LingoDev Assistant Test Working!');
        }),

        vscode.commands.registerCommand('lingodev-assistant.showSidebar', () => {
            SidebarPanel.createOrShow(context.extensionUri);
        }),

        vscode.commands.registerCommand('lingodev-assistant.extractString', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('❌ No active editor found!');
                return;
            }

            const selection = editor.selection;
            const text = editor.document.getText(selection);
            if (!text) {
                vscode.window.showWarningMessage('⚠️ No text selected!');
                return;
            }

            console.log('🔍 Extracting string:', text);

            const lingoConfigPath = path.join(workspaceFolder, 'i18n.json');
            try {
                await fs.access(lingoConfigPath);
                console.log('✅ Lingo config found');
            } catch {
                const choice = await vscode.window.showWarningMessage(
                    'Lingo not initialized. Would you like to initialize it?',
                    'Yes', 'No'
                );
                
                if (choice === 'Yes') {
                    await initializeLingo(workspaceFolder);
                } else {
                    return;
                }
            }

            try {
                await runLingoAndUpdateSidebar(text);
            } catch (err: any) {
                console.error('❌ Error in extract command:', err);
            }
        }),

        // NEW: Live Preview Command
        vscode.commands.registerCommand('lingodev-assistant.showPreview', () => {
            PreviewPanel.createOrShow(context.extensionUri, workspaceFolder);
        }),

        // NEW: AI Suggestions Command
        vscode.commands.registerCommand('lingodev-assistant.showAISuggestions', async () => {
            if (aiSuggestionProvider) {
                const patterns = await aiSuggestionProvider.provideI18nPatterns();
                vscode.window.showInformationMessage('🤖 Lingo AI Best Practices:');
                patterns.forEach(pattern => {
                    console.log(`   ${pattern}`);
                });
            }
        }),

        // NEW: Team Sync Command
        vscode.commands.registerCommand('lingodev-assistant.syncTeam', async () => {
            if (teamCollaboration) {
                await teamCollaboration.syncWithTeam();
                // Refresh all features after sync
                const editor = vscode.window.activeTextEditor;
                if (editor) {
                    const selection = editor.selection;
                    const text = editor.document.getText(selection);
                    await updateAllFeatures(workspaceFolder, text || '');
                }
            }
        }),

        // NEW: Resolve Conflicts Command
        vscode.commands.registerCommand('lingodev-assistant.resolveConflicts', async () => {
            if (teamCollaboration) {
                await teamCollaboration.resolveConflicts();
            }
        }),

        // NEW: Show Team Activity Command
        vscode.commands.registerCommand('lingodev-assistant.showTeamActivity', async () => {
            if (teamCollaboration) {
                await teamCollaboration.showTeamActivity();
            }
        })
    ];

    commands.forEach(command => context.subscriptions.push(command));

    // Activate Hardcoded String Diagnostics
    const stringDiagnostics = new StringDiagnosticProvider();
    stringDiagnostics.activate(context);

    // Register Quick Fix / Code Action Provider
    const codeActionProvider = vscode.languages.registerCodeActionsProvider(
        ['javascript', 'typescript'],
        new StringCodeActionProvider(),
        { providedCodeActionKinds: StringCodeActionProvider.providedCodeActionKinds }
    );
    context.subscriptions.push(codeActionProvider);

    // Update inline translations when active editor changes
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor && inlineTranslationProvider) {
                inlineTranslationProvider.updateInlineTranslations(editor);
            }
        })
    );

    // Initial update
    const editor = vscode.window.activeTextEditor;
    if (editor && inlineTranslationProvider) {
        inlineTranslationProvider.updateInlineTranslations(editor);
    }
}

export function deactivate() {
    if (inlineTranslationProvider) {
        inlineTranslationProvider.dispose();
    }
    console.log('🔴 LingoDev Assistant extension deactivated');
}