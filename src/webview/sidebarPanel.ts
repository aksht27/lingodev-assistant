import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs/promises';

const execAsync = promisify(exec);

interface SidebarMessage {
  command: 'extractStrings' | 'copyString' | 'editString' | 'removeString' | 'showAISuggestions' | 'generateLocale';
  target?: string;
  bucket?: string;
  key?: string;
  newValue?: string;
  stringData?: any;
}

interface ExtractedString {
  id: string;
  key: string;
  value: string;
  line: number;
  range?: vscode.Range;
}

export class SidebarPanel implements vscode.WebviewViewProvider {
  public static readonly viewType = 'lingodev-sidebar';
  
  private _view?: vscode.WebviewView;
  private workspaceRoot: string;
  private _extractedStrings: ExtractedString[] = [];
  private _decorationType?: vscode.TextEditorDecorationType;

  constructor(private readonly _extensionUri: vscode.Uri, workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
    this._createHighlightDecoration();
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    webviewView.webview.html = this._getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (message: SidebarMessage) => {
      switch (message.command) {
        case 'extractStrings':
          await this.extractAndHighlightStrings();
          break;
        case 'copyString':
          if (message.stringData) {
            await this.copyString(message.stringData);
          }
          break;
        case 'editString':
          if (message.stringData && message.newValue) {
            await this.editString(message.stringData, message.newValue);
          }
          break;
        case 'removeString':
          if (message.stringData) {
            await this.removeString(message.stringData);
          }
          break;
        case 'showAISuggestions':
          await this.showAISuggestions();
          break;
        case 'generateLocale':
          if (message.target && message.bucket) {
            await this.generateLocaleFile(message.target, message.bucket);
          }
          break;
      }
    });
  }

  public async extractAndHighlightStrings() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('No active editor found');
      return;
    }

    const document = editor.document;
    const text = document.getText();
    
    // Extract strings using regex (simple approach)
    const stringRegex = /(['"`])(.*?)\1/g;
    const strings: ExtractedString[] = [];
    let match;

    while ((match = stringRegex.exec(text)) !== null) {
      const value = match[2];
      if (value.length > 2) { // Filter out very short strings
        const startPos = document.positionAt(match.index);
        const endPos = document.positionAt(match.index + match[0].length);
        const range = new vscode.Range(startPos, endPos);
        
        strings.push({
          id: `string_${strings.length}`,
          key: `key_${strings.length}`,
          value: value,
          line: startPos.line + 1,
          range: range
        });
      }
    }

    this._extractedStrings = strings;
    this._updateSidebar();
    this.highlightStringsInActiveEditor();
    
    vscode.window.showInformationMessage(`✅ Extracted ${strings.length} strings`);
  }

  public highlightStringsInActiveEditor() {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !this._decorationType) {
      return;
    }

    const ranges: vscode.Range[] = this._extractedStrings
      .filter(str => str.range)
      .map(str => str.range!);

    editor.setDecorations(this._decorationType, ranges);
  }

  public async copyString(stringData: any) {
    await vscode.env.clipboard.writeText(stringData.value);
    vscode.window.showInformationMessage(`📋 Copied: "${stringData.value}"`);
  }

  public async editString(stringData: any, newValue: string) {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !stringData.range) {
      return;
    }

    // Update in document
    await editor.edit(editBuilder => {
      editBuilder.replace(stringData.range, `'${newValue}'`);
    });

    // Update in our list
    const stringIndex = this._extractedStrings.findIndex(s => s.id === stringData.id);
    if (stringIndex !== -1) {
      this._extractedStrings[stringIndex].value = newValue;
      this._updateSidebar();
    }

    vscode.window.showInformationMessage('✅ String updated');
  }

  public async removeString(stringData: any) {
    const editor = vscode.window.activeTextEditor;
    if (editor && stringData.range) {
      // Remove from document
      await editor.edit(editBuilder => {
        editBuilder.replace(stringData.range, "''");
      });
    }

    // Remove from our list
    this._extractedStrings = this._extractedStrings.filter(s => s.id !== stringData.id);
    this._updateSidebar();
    this.highlightStringsInActiveEditor();
    
    vscode.window.showInformationMessage('🗑️ String removed');
  }

  public async showAISuggestions() {
    vscode.commands.executeCommand('lingoai.showAISuggestions');
    
    // Send AI suggestions to sidebar
    this._view?.webview.postMessage({
      command: 'showAISuggestions',
      suggestions: [
        "🤖 Use consistent terminology across all translations",
        "🌍 Consider cultural context for localized strings",
        "📏 Check string length for UI layout compatibility",
        "🔤 Add comments for ambiguous terms",
        "🔄 Keep translation keys organized by feature"
      ]
    });
  }

  private _createHighlightDecoration() {
    this._decorationType = vscode.window.createTextEditorDecorationType({
      backgroundColor: 'rgba(255,255,0,0.3)',
      border: '1px solid yellow',
      borderRadius: '2px',
      overviewRulerColor: 'yellow',
      overviewRulerLane: vscode.OverviewRulerLane.Right
    });
  }

  private _updateSidebar() {
    this._view?.webview.postMessage({
      command: 'setStrings',
      strings: this._extractedStrings
    });
  }

  // Keep your existing locale generation methods
  private async generateLocaleFile(target: string, bucket: string) {
    const localeArg = `--target-locale ${target}`;
    const bucketArg = `--bucket ${bucket}`;
    const cmd = `npx lingo.dev@latest run ${localeArg} ${bucketArg}`;
    
    vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: `Generating ${target}.${bucket}…`,
      cancellable: false
    }, async () => {
      try {
        const { stdout, stderr } = await execAsync(cmd, { cwd: this.workspaceRoot });
        console.log('Lingo CLI stdout:', stdout);
        if (stderr) console.warn('Lingo CLI stderr:', stderr);
        vscode.window.showInformationMessage(`✅ Generated ${target}.${bucket}`);
      } catch (err: any) {
        vscode.window.showErrorMessage(`Error generating locale: ${err.message}`);
        console.error(err);
      }
    });
  }

  private _getHtml(webview: vscode.Webview): string {
    const nonce = this._getNonce();
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Lingo AI</title>
  <style>
    body { 
      padding: 10px; 
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background);
    }
    .header { 
      margin-bottom: 15px; 
      border-bottom: 1px solid var(--vscode-panel-border);
      padding-bottom: 10px;
    }
    h3 { margin: 0 0 10px 0; color: var(--vscode-textLink-foreground); }
    button { 
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 8px 12px;
      margin: 2px;
      cursor: pointer;
      border-radius: 3px;
    }
    button:hover { background: var(--vscode-button-hoverBackground); }
    .string-item { 
      margin: 8px 0; 
      padding: 8px;
      background: var(--vscode-input-background);
      border-radius: 4px;
      border-left: 3px solid var(--vscode-textLink-foreground);
    }
    .string-key { font-weight: bold; font-size: 0.9em; color: var(--vscode-textLink-foreground); }
    .string-value { margin: 4px 0; word-break: break-word; }
    .string-line { font-size: 0.8em; color: var(--vscode-descriptionForeground); }
    .actions { margin-top: 5px; }
    .actions button { font-size: 0.8em; padding: 4px 8px; }
    .ai-panel { 
      margin-top: 15px; 
      padding: 10px;
      background: var(--vscode-textCodeBlock-background);
      border-radius: 4px;
      display: none;
    }
    .ai-panel.visible { display: block; }
    .suggestion { margin: 5px 0; padding: 5px; font-size: 0.9em; }
  </style>
</head>
<body>
  <div class="header">
    <h3>🌍 Lingo AI</h3>
    <button id="extract-btn">Extract Strings</button>
    <button id="ai-suggestions">AI Suggestions</button>
  </div>

  <div id="strings-container">
    <div id="strings-list"></div>
  </div>

  <div id="ai-panel" class="ai-panel">
    <h4>🤖 AI Best Practices</h4>
    <div id="suggestions-list"></div>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    let currentStrings = [];

    // Extract Strings
    document.getElementById('extract-btn').addEventListener('click', () => {
      vscode.postMessage({ command: 'extractStrings' });
    });

    // AI Suggestions
    document.getElementById('ai-suggestions').addEventListener('click', () => {
      vscode.postMessage({ command: 'showAISuggestions' });
    });

    // Handle messages from extension
    window.addEventListener('message', event => {
      const message = event.data;
      
      if (message.command === 'setStrings') {
        currentStrings = message.strings || [];
        updateStringsList();
      }
      
      if (message.command === 'showAISuggestions') {
        showAISuggestions(message.suggestions);
      }
    });

    function updateStringsList() {
      const list = document.getElementById('strings-list');
      list.innerHTML = '';

      if (currentStrings.length === 0) {
        list.innerHTML = '<p>No strings extracted. Click "Extract Strings" to begin.</p>';
        return;
      }

      currentStrings.forEach(string => {
        const item = document.createElement('div');
        item.className = 'string-item';
        item.innerHTML = \`
          <div class="string-key">Line \${string.line}</div>
          <div class="string-value">"\${string.value}"</div>
          <div class="actions">
            <button onclick="copyString('\${string.id}')">Copy</button>
            <button onclick="editString('\${string.id}')">Edit</button>
            <button onclick="removeString('\${string.id}')">Remove</button>
          </div>
        \`;
        list.appendChild(item);
      });
    }

    function copyString(stringId) {
      const string = currentStrings.find(s => s.id === stringId);
      if (string) {
        vscode.postMessage({ 
          command: 'copyString', 
          stringData: string 
        });
      }
    }

    function editString(stringId) {
      const string = currentStrings.find(s => s.id === stringId);
      if (string) {
        const newValue = prompt('Edit string value:', string.value);
        if (newValue !== null) {
          vscode.postMessage({ 
            command: 'editString', 
            stringData: string,
            newValue: newValue
          });
        }
      }
    }

    function removeString(stringId) {
      const string = currentStrings.find(s => s.id === stringId);
      if (string && confirm('Remove this string from the code?')) {
        vscode.postMessage({ 
          command: 'removeString', 
          stringData: string 
        });
      }
    }

    function showAISuggestions(suggestions) {
      const panel = document.getElementById('ai-panel');
      const list = document.getElementById('suggestions-list');
      
      list.innerHTML = '';
      suggestions.forEach(suggestion => {
        const div = document.createElement('div');
        div.className = 'suggestion';
        div.textContent = suggestion;
        list.appendChild(div);
      });
      
      panel.classList.add('visible');
    }

    // Initial load
    updateStringsList();
  </script>
</body>
</html>`;
  }

  private _getNonce(): string {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({ length: 32 }, () =>
      possible.charAt(Math.floor(Math.random() * possible.length))
    ).join('');
  }
}