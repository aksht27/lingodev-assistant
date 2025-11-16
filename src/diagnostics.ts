import * as vscode from 'vscode';

export class StringDiagnosticProvider {
  private diagnosticCollection: vscode.DiagnosticCollection;
  private fileStringsMap = new Map<string, string[]>();

  constructor() {
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection(
      'lingoHardcodedStrings'
    );
  }

  public activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(this.diagnosticCollection);

    context.subscriptions.push(
      vscode.workspace.onDidChangeTextDocument((e) =>
        this.refreshDiagnostics(e.document)
      )
    );
    context.subscriptions.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor) this.refreshDiagnostics(editor.document);
      })
    );

    // Refresh diagnostics for currently open editor (if any)
    if (vscode.window.activeTextEditor) {
      this.refreshDiagnostics(vscode.window.activeTextEditor.document);
    }
  }

  private refreshDiagnostics(document: vscode.TextDocument) {
    if (
      document.languageId !== 'typescript' &&
      document.languageId !== 'javascript'
    ) {
      this.diagnosticCollection.delete(document.uri);
      return;
    }

    const diagnostics: vscode.Diagnostic[] = [];
    const stringsInDoc: string[] = [];

    const text = document.getText();
    const stringRegex = /(["'`])((?:(?=(\\?))\3.)*?)\1/g;
    let match: RegExpExecArray | null;

    while ((match = stringRegex.exec(text)) !== null) {
      const literal = match[2];
      stringsInDoc.push(literal);

      const startPos = document.positionAt(match.index);
      const endPos = document.positionAt(match.index + match[0].length);
      const range = new vscode.Range(startPos, endPos);

      const diag = new vscode.Diagnostic(
        range,
        'Hardcoded string detected. Consider extracting for localization.',
        vscode.DiagnosticSeverity.Warning
      );
      diag.code = 'lingo.extract'; // custom code
      diagnostics.push(diag);
    }

    this.diagnosticCollection.set(document.uri, diagnostics);
    this.fileStringsMap.set(document.uri.toString(), stringsInDoc);

    console.log(
      `StringDiagnosticProvider: ${diagnostics.length} diagnostics in ${document.fileName}`
    );
  }

  // Useful method for other parts (like a "show preview" command) to get all strings
  public getStringsForDocument(
    doc: vscode.TextDocument
  ): string[] | undefined {
    return this.fileStringsMap.get(doc.uri.toString());
  }
}
