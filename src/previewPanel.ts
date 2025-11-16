import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { LingoDotDevEngine } from 'lingo.dev/sdk';

export class PreviewPanel {
  public static currentPanel: PreviewPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  private workspaceFolder: vscode.Uri;
  private sdk: LingoDotDevEngine;

  public static createOrShow(
    extensionUri: vscode.Uri,
    workspaceFolder: vscode.Uri,
    sdk: LingoDotDevEngine
  ): PreviewPanel {
    const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;

    if (PreviewPanel.currentPanel) {
      PreviewPanel.currentPanel._panel.reveal(column);
      return PreviewPanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      'lingodev-preview',
      '🌍 Translation Preview',
      column,
      { enableScripts: true, localResourceRoots: [extensionUri, workspaceFolder] }
    );

    PreviewPanel.currentPanel = new PreviewPanel(panel, workspaceFolder, sdk);
    return PreviewPanel.currentPanel;
  }

  private constructor(panel: vscode.WebviewPanel, workspaceFolder: vscode.Uri, sdk: LingoDotDevEngine) {
    this._panel = panel;
    this.workspaceFolder = workspaceFolder;
    this.sdk = sdk;

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._panel.onDidChangeViewState(e => {
      if (e.webviewPanel.visible) this.updatePreview();
    }, null, this._disposables);

    this.updatePreview();
  }

  private async getStaticTranslations(): Promise<Record<string, Record<string, string>>> {
    const tr: Record<string, Record<string, string>> = {};
    try {
      const i18nDir = vscode.Uri.joinPath(this.workspaceFolder, 'test‑workspace', 'i18n');
      const files = await fs.readdir(i18nDir.fsPath);
      for (const f of files) {
        const p = path.join(i18nDir.fsPath, f);
        if (f.endsWith('.ts')) {
          const raw = await fs.readFile(p, 'utf-8');
          const m = raw.match(/export\s+default\s+({[\s\S]*});/);
          if (m && m[1]) tr[path.basename(f, '.ts')] = JSON.parse(m[1]);
        } else if (f.endsWith('.json')) {
          const raw = await fs.readFile(p, 'utf-8');
          tr[path.basename(f, '.json')] = JSON.parse(raw);
        }
      }
    } catch (e) {
      console.error('Error reading static translations', e);
    }
    return tr;
  }

  private async _getHtmlForWebview(): Promise<string> {
    const staticTrans = await this.getStaticTranslations();
    const source = staticTrans['en'] || {};
    const targetLangs = Object.keys(staticTrans).filter(l => l !== 'en');

    // Generate page HTML
    const sourceHtml = Object.entries(source)
      .map(([k, v]) => `<div class="item" data-key="${k}">${k}: ${v}</div>`)
      .join('');
    const targetOptions = targetLangs.map(l => `<option value="${l}">${l}</option>`).join('');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${this._getNonce()}'; style-src 'unsafe-inline';" />
  <style>
    body { background: #1e1e1e; color: #ddd; font-family: sans-serif; padding: 20px; }
    .item { margin: 8px 0; padding: 6px; background: #252526; border-radius: 3px; cursor: pointer; }
    .item:hover { background: #333; }
    select { margin-top: 12px; padding: 4px; }
    .translation { margin-top: 16px; white-space: pre-wrap; }
  </style>
</head>
<body>
  <h2>Source Strings</h2>
  ${sourceHtml || '<em>No source strings</em>'}
  <h2>Translate</h2>
  <select id="lang">${targetOptions}</select>
  <div class="translation" id="translated">Select a key and a language</div>

  <script nonce="${this._getNonce()}">
    const vscode = acquireVsCodeApi();
    const translations = ${JSON.stringify(staticTrans)};
    let selectedKey = '';

    document.querySelectorAll('.item').forEach(el => {
      el.addEventListener('click', () => {
        selectedKey = el.getAttribute('data-key');
        updateText();
        document.querySelectorAll('.item').forEach(i => i.style.background = '#252526');
        el.style.background = '#333';
      });
    });

    document.getElementById('lang').addEventListener('change', () => updateText());

    async function updateText() {
      const lang = document.getElementById('lang').value;
      const container = document.getElementById('translated');
      if (!selectedKey) {
        container.textContent = 'Click a source string first.';
        return;
      }
      if (!lang) {
        container.textContent = 'Pick a language first.';
        return;
      }
      vscode.postMessage({ command: 'translate', key: selectedKey, lang });
    }

    window.addEventListener('message', event => {
      const msg = event.data;
      if (msg.command === 'translated') {
        document.getElementById('translated').textContent = msg.text;
      }
    });
  </script>
</body>
</html>`;
  }

  public async updatePreview() {
    this._panel.webview.html = await this._getHtmlForWebview();

    // Listen for translate messages
    this._panel.webview.onDidReceiveMessage(async msg => {
      if (msg.command === 'translate') {
        const { key, lang } = msg;
        const staticTrans = await this.getStaticTranslations();
        const base = staticTrans['en'][key];
        try {
          const result = await this.sdk.localizeText(base, { sourceLocale: 'en', targetLocale: lang });
          this._panel.webview.postMessage({ command: 'translated', text: result });
        } catch (e) {
          console.error('SDK translation error', e);
          this._panel.webview.postMessage({ command: 'translated', text: 'Error translating via SDK' });
        }
      }
    });
  }

  public dispose() {
    PreviewPanel.currentPanel = undefined;
    this._panel.dispose();
    this._disposables.forEach(d => d.dispose());
    this._disposables = [];
  }

  private _getNonce(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({ length: 32 }).map(_ => chars[Math.floor(Math.random()*chars.length)]).join('');
  }
}
