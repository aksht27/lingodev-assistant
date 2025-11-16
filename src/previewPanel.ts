import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';

export class PreviewPanel {
  public static currentPanel: PreviewPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  private workspaceFolder: string;

  public static createOrShow(extensionUri: vscode.Uri, workspaceFolder: string): PreviewPanel {
    const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;

    if (PreviewPanel.currentPanel) {
      PreviewPanel.currentPanel._panel.reveal(column);
      return PreviewPanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      'lingodev-preview',
      '🌍 Translation Preview',
      column,
      {
        enableScripts: true,
        localResourceRoots: [extensionUri],
        retainContextWhenHidden: true,  // Keep state when hidden
      }
    );

    PreviewPanel.currentPanel = new PreviewPanel(panel, workspaceFolder);
    return PreviewPanel.currentPanel;
  }

  private constructor(panel: vscode.WebviewPanel, workspaceFolder: string) {
    this._panel = panel;
    this.workspaceFolder = workspaceFolder;

    // When panel is disposed
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // When view state changes (visible / hidden)
    this._panel.onDidChangeViewState(
      e => {
        if (e.webviewPanel.visible) {
          this.updatePreview();
        }
      },
      null,
      this._disposables
    );

    // Initially set content
    this.updatePreview();
  }

  private async _getHtmlForWebview(): Promise<string> {
    const translations = await this.getTranslations();
    const enTranslations = translations['en'] || {};

    // Build HTML content
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Translation Preview</title>
  <style>
    body { font-family: sans-serif; padding: 20px; background: #1e1e1e; color: #ddd; }
    .container { max-width: 800px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 20px; }
    .translation-group { display: flex; gap: 20px; }
    .lang-section { flex: 1; }
    .lang-section h2 { margin-bottom: 10px; }
    .item { margin-bottom: 12px; padding: 8px; background: #252526; border-radius: 4px; cursor: pointer; }
    .item:hover { background: #333; }
    .translation { margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🌍 Live Translation Preview</h1>
      <p>Click on a source string to view translation</p>
    </div>

    <div class="translation-group">
      <div class="lang-section" id="source">
        <h2>Source (en)</h2>
        ${Object.entries(enTranslations)
          .map(([key, value]) => `<div class="item" data-key="${key}">${key}: ${value}</div>`)
          .join('')}
      </div>

      <div class="lang-section">
        <h2>Target</h2>
        <div class="translation" id="translated">Select a language and a key</div>
        <select id="target-language">
          <option value="">Select language</option>
          ${Object.keys(translations)
            .filter(lang => lang !== 'en')
            .map(lang => `<option value="${lang}">${lang}</option>`)
            .join('')}
        </select>
      </div>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const translations = ${JSON.stringify(translations)};
    let selectedKey = '';

    document.querySelectorAll('.item').forEach(el => {
      el.addEventListener('click', () => {
        selectedKey = el.getAttribute('data-key') || '';
        updateTranslation();
      });
    });

    document.getElementById('target-language')?.addEventListener('change', () => {
      updateTranslation();
    });

    function updateTranslation() {
      const lang = document.getElementById('target-language').value;
      const container = document.getElementById('translated');
      if (!lang || !selectedKey) {
        container.textContent = 'Select a language and key';
        return;
      }
      const translation = translations[lang][selectedKey];
      container.textContent = translation !== undefined ? translation : 'No translation available';
    }
  </script>
</body>
</html>`;
  }

  private async getTranslations(): Promise<Record<string, Record<string, string>>> {
    const i18nDir = path.join(this.workspaceFolder, 'i18n');
    const result: Record<string, Record<string, string>> = {};

    try {
      const files = await fs.readdir(i18nDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const lang = path.basename(file, '.json');
          const content = await fs.readFile(path.join(i18nDir, file), 'utf-8');
          result[lang] = JSON.parse(content);
        }
      }
    } catch (err) {
      console.error('Error reading translations:', err);
    }

    return result;
  }

  public async updatePreview() {
    const html = await this._getHtmlForWebview();
    this._panel.webview.html = html;
  }

  public dispose() {
    PreviewPanel.currentPanel = undefined;
    this._panel.dispose();
    this._disposables.forEach(d => d.dispose());
    this._disposables = [];
  }
}
