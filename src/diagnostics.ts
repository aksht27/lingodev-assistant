import * as vscode from 'vscode';
import { SidebarPanel } from './webview/sidebarPanel';

export class StringDiagnosticProvider {
    private diagnosticCollection: vscode.DiagnosticCollection;
    private fileStringsMap: Map<string, string[]> = new Map();

    constructor() {
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('lingoHardcodedStrings');
        console.log("StringDiagnosticProvider initialized");
    }

    public activate(context: vscode.ExtensionContext) {
        console.log("StringDiagnosticProvider activated");

        if (vscode.window.activeTextEditor) {
            this.refreshDiagnostics(vscode.window.activeTextEditor.document);
        }

        context.subscriptions.push(
            vscode.workspace.onDidChangeTextDocument(event => this.refreshDiagnostics(event.document)),
            vscode.window.onDidChangeActiveTextEditor(editor => {
                if (editor) this.refreshDiagnostics(editor.document);
            })
        );
    }

    private refreshDiagnostics(document: vscode.TextDocument) {
        if (!document || (document.languageId !== 'javascript' && document.languageId !== 'typescript')) {
            return;
        }

        const diagnostics: vscode.Diagnostic[] = [];
        const stringsInDoc: string[] = [];
        const text = document.getText();

        const stringRegex = /(["'`])((?:(?=(\\?))\3.)*?)\1/g;
        let match;

        while ((match = stringRegex.exec(text)) !== null) {
            const startPos = document.positionAt(match.index);
            const endPos = document.positionAt(match.index + match[0].length);

            const strValue = match[2]; // matched string without quotes
            stringsInDoc.push(strValue);

            const diagnostic = new vscode.Diagnostic(
                new vscode.Range(startPos, endPos),
                "Hardcoded string detected. Consider extracting for localization.",
                vscode.DiagnosticSeverity.Warning
            );
            diagnostics.push(diagnostic);
        }

        this.diagnosticCollection.set(document.uri, diagnostics);
        this.fileStringsMap.set(document.uri.toString(), stringsInDoc);

        console.log(`Diagnostics updated for: ${document.fileName}, count: ${diagnostics.length}`);

        // --- Send all strings to the sidebar automatically ---
        if (SidebarPanel.currentPanel) {
            SidebarPanel.currentPanel.postMessage({
                command: 'addMultipleStrings',
                strings: stringsInDoc
            });
        }
    }
}
