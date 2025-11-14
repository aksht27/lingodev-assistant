import * as vscode from 'vscode';

export class StringCodeActionProvider implements vscode.CodeActionProvider {
    public static readonly providedCodeActionKinds = [
        vscode.CodeActionKind.QuickFix
    ];

    provideCodeActions(
        document: vscode.TextDocument,
        range: vscode.Range,
        context: vscode.CodeActionContext,
        token: vscode.CancellationToken
    ): vscode.CodeAction[] | undefined {

        const actions: vscode.CodeAction[] = [];

        for (const diagnostic of context.diagnostics) {
            if (diagnostic.message.includes('Hardcoded string detected')) {
                const action = new vscode.CodeAction(
                    'Extract string to Lingo CLI',
                    vscode.CodeActionKind.QuickFix
                );
                action.diagnostics = [diagnostic];
                action.command = {
                    command: 'lingodev-assistant.extractString',
                    title: 'Extract string',
                    arguments: [document, diagnostic.range]
                };
                actions.push(action);
            }
        }

        return actions;
    }
}
