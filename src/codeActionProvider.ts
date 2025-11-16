import * as vscode from 'vscode';

export class StringCodeActionProvider implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [
    vscode.CodeActionKind.QuickFix
  ];

  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range,
    context: vscode.CodeActionContext
  ): vscode.CodeAction[] | undefined {
    const actions: vscode.CodeAction[] = [];

    for (const diagnostic of context.diagnostics) {
      if (
        diagnostic.code === 'lingo.extract' ||
        diagnostic.message.includes('Hardcoded string detected')
      ) {
        const action = new vscode.CodeAction(
          'Extract string to Lingo',
          vscode.CodeActionKind.QuickFix
        );
        action.diagnostics = [diagnostic];
        action.command = {
          title: 'Extract string',
          command: 'lingodev-assistant.extractString',
          arguments: [document, range, document.getText(range)]
        };
        actions.push(action);
      }
    }

    return actions;
  }
}
