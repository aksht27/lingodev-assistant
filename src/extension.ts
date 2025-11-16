import * as vscode from 'vscode';
import { StringDiagnosticProvider } from './diagnostics';
import { StringCodeActionProvider } from './codeActionProvider';
import { PreviewPanel } from './previewPanel';
import { LingoDotDevEngine } from 'lingo.dev/sdk';

export async function activate(context: vscode.ExtensionContext) {
  console.log('🔌 LingoDev Assistant activated');

  // Initialize Lingo.dev SDK engine
  const apiKey = process.env.LINGODOTDEV_API_KEY;
  if (!apiKey) {
    vscode.window.showWarningMessage('LingoDev SDK: API key not set (set LINGODOTDEV_API_KEY)');
  }
  const lingoSdk = new LingoDotDevEngine({
    apiKey: apiKey ?? '',
  });

  // Diagnostics provider — highlights hardcoded strings
  const diagProvider = new StringDiagnosticProvider();
  diagProvider.activate(context);

  // Code action provider — quick fix to extract strings
  const codeActionProvider = vscode.languages.registerCodeActionsProvider(
    ['javascript', 'typescript'],
    new StringCodeActionProvider(),
    {
      providedCodeActionKinds: StringCodeActionProvider.providedCodeActionKinds
    }
  );
  context.subscriptions.push(codeActionProvider);

  // Command: Extract string
  const extractCmd = vscode.commands.registerCommand(
    'lingodev-assistant.extractString',
    async (document: vscode.TextDocument, range: vscode.Range, literal: string) => {
      const key = await vscode.window.showInputBox({
        prompt: 'Enter translation key',
        value: literal.replace(/\s+/g, '_').slice(0, 30)
      });
      if (!key) {
        vscode.window.showWarningMessage('Extraction cancelled');
        return;
      }

      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) {
        vscode.window.showErrorMessage('No workspace folder');
        return;
      }
      const root = workspaceFolders[0].uri;

      // Insert into i18n/en.ts
      const i18nDir = vscode.Uri.joinPath(root, 'test‑workspace', 'i18n');
      const enUri = vscode.Uri.joinPath(i18nDir, 'en.ts');
      await vscode.workspace.fs.createDirectory(i18nDir);
      try {
        await vscode.workspace.fs.stat(enUri);
      } catch (e) {
        const skeleton = `export default {\n};\n`;
        await vscode.workspace.fs.writeFile(enUri, Buffer.from(skeleton, 'utf-8'));
      }
      const buf = await vscode.workspace.fs.readFile(enUri);
      let text = buf.toString();
      const insert = `  ${key}: ${JSON.stringify(literal)},\n`;
      const idx = text.lastIndexOf('}');
      if (idx === -1) {
        vscode.window.showErrorMessage('Could not insert key into en.ts');
        return;
      }
      text = text.slice(0, idx) + insert + text.slice(idx);
      await vscode.workspace.fs.writeFile(enUri, Buffer.from(text, 'utf-8'));

      vscode.window.showInformationMessage(`Extracted "${key}"`);

      // Open preview with SDK engine passed
      PreviewPanel.createOrShow(context.extensionUri, root, lingoSdk);
    }
  );
  context.subscriptions.push(extractCmd);

  // Command: Show preview panel
  const previewCmd = vscode.commands.registerCommand(
    'lingodev-assistant.showPreview',
    () => {
      const ws = vscode.workspace.workspaceFolders;
      if (!ws) {
        vscode.window.showErrorMessage('Open workspace');
        return;
      }
      PreviewPanel.createOrShow(context.extensionUri, ws[0].uri, lingoSdk);
    }
  );
  context.subscriptions.push(previewCmd);
}

export function deactivate() {
  console.log('🛑 LingoDev Assistant deactivated');
}
