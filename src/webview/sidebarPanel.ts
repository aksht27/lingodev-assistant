import * as vscode from 'vscode';
import { LingoClient } from '../lingoClient'; // Corrected path

interface SidebarMessage {
  command:
    | 'addStringToUI'
    | 'updateStringUI'
    | 'removeStringUI'
    | 'alert'
    | 'copy'
    | 'edit'
    | 'remove'
    | 'addMultipleStrings'
    | 'testConnection';
  text?: string;
  strings?: string[];
  id?: string;
  oldText?: string;
}

export class SidebarPanel implements vscode.WebviewViewProvider {
  public static readonly viewType = 'lingodev-sidebar';
  public static currentPanel: SidebarPanel | undefined;

  private _view?: vscode.WebviewView;
  private lingoClient: LingoClient;

  constructor(private readonly _extensionUri: vscode.Uri, apiKey: string) {
    this.lingoClient = new LingoClient(apiKey);
  }

  // Static method to check if panel exists
  public static hasCurrentPanel(): boolean {
    return !!SidebarPanel.currentPanel;
  }

  // Static method to post message safely
  public static safePostMessage(message: any): boolean {
    if (SidebarPanel.currentPanel && SidebarPanel.currentPanel.postMessage) {
      SidebarPanel.currentPanel.postMessage(message);
      return true;
    }
    return false;
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;
    SidebarPanel.currentPanel = this;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((message: SidebarMessage) => {
      this._handleMessage(message);
    });
  }

  private async _handleMessage(message: SidebarMessage) {
    switch (message.command) {
      case 'alert':
        vscode.window.showInformationMessage(message.text || '');
        break;

      case 'testConnection': {
        const result = await this.lingoClient.testConnection();
        this._view?.webview.postMessage({
          command: 'alert',
          text: result.ok
            ? '✅ Lingo connection successful!'
            : `❌ Lingo connection failed: ${String(result.error)}`
        });
        break;
      }

      case 'copy':
        vscode.env.clipboard.writeText(message.text || '');
        vscode.window.showInformationMessage('Copied to clipboard!');
        break;

      case 'edit':
        this._view?.webview.postMessage({
          command: 'updateStringUI',
          id: message.id,
          text: message.text
        });
        if (message.oldText && message.text) {
          const editor = vscode.window.activeTextEditor;
          if (editor) {
            const doc = editor.document;
            const text = doc.getText();
            const index = text.indexOf(message.oldText);
            if (index !== -1) {
              const start = doc.positionAt(index);
              const end = doc.positionAt(index + message.oldText.length);
              editor.edit(editBuilder =>
                editBuilder.replace(new vscode.Range(start, end), message.text!)
              );
            }
          }
        }
        break;

      case 'remove':
        this._view?.webview.postMessage({
          command: 'removeStringUI',
          id: message.id
        });
        break;

      case 'addStringToUI':
        this._view?.webview.postMessage({
          command: 'addStringToUI',
          text: message.text
        });
        break;

      case 'addMultipleStrings':
        if (message.strings && message.strings.length > 0) {
          this._view?.webview.postMessage({
            command: 'addMultipleStrings',
            strings: message.strings
          });
        }
        break;

      default:
        console.warn('Unknown sidebar command:', message);
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const nonce = this._getNonce();
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>LingoDev Assistant</title>
  <style>
    body { font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); color: var(--vscode-foreground); background-color: var(--vscode-sideBar-background); padding: 10px; margin: 0; }
    .container { max-width: 100%; }
    .header { margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid var(--vscode-panel-border); }
    h1 { font-size: 1.2em; margin: 0 0 10px 0; color: var(--vscode-titleBar-activeForeground); }
    h2 { font-size: 1em; margin: 15px 0 10px 0; color: var(--vscode-descriptionForeground); }
    .test-button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 8px 12px; border-radius: 2px; cursor: pointer; margin-bottom: 15px; }
    .test-button:hover { background: var(--vscode-button-hoverBackground); }
    .status { margin-bottom: 10px; font-style: italic; }
    .strings-list { list-style: none; padding: 0; margin: 0; }
    .string-item { padding: 8px 12px; margin: 5px 0; background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border); border-radius: 3px; word-break: break-word; }
    .empty-state { text-align: center; padding: 20px; color: var(--vscode-descriptionForeground); font-style: italic; }
    .button-group { display: flex; gap: 5px; margin-top: 8px; }
    .button-group button { flex: 1; padding: 4px 8px; border: 1px solid var(--vscode-button-border); background: var(--vscode-button-background); color: var(--vscode-button-foreground); border-radius: 2px; cursor: pointer; font-size: 0.9em; }
    .button-group button:hover { background: var(--vscode-button-hoverBackground); }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🌍 LingoDev Assistant</h1>
      <p>Extracted & Translated Strings</p>
    </div>

    <button class="test-button" id="test-connection">Test Connection</button>
    <div class="status" id="status"></div>

    <h2>Translations:</h2>
    <div id="strings-container">
      <div class="empty-state" id="empty-state">No strings yet. Select text in your code and use "Extract Selected String" to see translations here.</div>
      <ul class="strings-list" id="strings-list" style="display: none;"></ul>
    </div>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    document.getElementById("test-connection").addEventListener("click", () => {
      vscode.postMessage({ command: "testConnection" });
    });

    window.addEventListener("message", event => {
      const message = event.data;
      if (message.command === "alert") {
        const statusEl = document.getElementById("status");
        statusEl.textContent = message.text;
      } else if (message.command === "addStringToUI") {
        addString(message.text);
      } else if (message.command === "updateStringUI") {
        updateString(message.id, message.text);
      } else if (message.command === "removeStringUI") {
        removeString(message.id);
      } else if (message.command === "addMultipleStrings") {
        addMultiple(message.strings);
      }
    });

    function generateId() {
      return 'string-' + Math.random().toString(36).substr(2, 9);
    }

    function addString(text) {
      const emptyState = document.getElementById("empty-state");
      const list = document.getElementById("strings-list");
      if (emptyState) emptyState.style.display = 'none';
      if (list) list.style.display = 'block';

      const id = generateId();
      const li = document.createElement("li");
      li.className = "string-item";
      li.id = id;

      const span = document.createElement("span");
      span.textContent = text;

      const btnGroup = document.createElement("div");
      btnGroup.className = "button-group";

      const copyBtn = document.createElement("button");
      copyBtn.textContent = "Copy";
      copyBtn.onclick = () => vscode.postMessage({ command: "copy", text });

      const editBtn = document.createElement("button");
      editBtn.textContent = "Edit";
      editBtn.onclick = () => {
        const newText = prompt("Edit translation:", text);
        if (newText !== null) {
          vscode.postMessage({ command: "edit", id, text: newText, oldText: text });
        }
      };

      const removeBtn = document.createElement("button");
      removeBtn.textContent = "Remove";
      removeBtn.onclick = () => {
        if (confirm("Remove this translation?")) {
          li.remove();
          vscode.postMessage({ command: "remove", id });
          if (list.children.length === 0) {
            emptyState.style.display = 'block';
            list.style.display = 'none';
          }
        }
      };

      btnGroup.appendChild(copyBtn);
      btnGroup.appendChild(editBtn);
      btnGroup.appendChild(removeBtn);

      li.appendChild(span);
      li.appendChild(btnGroup);
      list.appendChild(li);
    }

    function updateString(id, text) {
      const li = document.getElementById(id);
      if (li) {
        const span = li.querySelector("span");
        if (span) span.textContent = text;
      }
    }

    function removeString(id) {
      const li = document.getElementById(id);
      if (li) li.remove();
      const list = document.getElementById("strings-list");
      const emptyState = document.getElementById("empty-state");
      if (list && list.children.length === 0 && emptyState) {
        emptyState.style.display = 'block';
        list.style.display = 'none';
      }
    }

    function addMultiple(strings) {
      const emptyState = document.getElementById("empty-state");
      const list = document.getElementById("strings-list");
      list.innerHTML = '';
      if (emptyState) emptyState.style.display = 'none';
      if (list) list.style.display = 'block';

      strings.forEach(text => {
        const id = generateId();
        const li = document.createElement("li");
        li.className = "string-item";
        li.id = id;

        const span = document.createElement("span");
        span.textContent = text;

        const btnGroup = document.createElement("div");
        btnGroup.className = "button-group";

        const copyBtn = document.createElement("button");
        copyBtn.textContent = "Copy";
        copyBtn.onclick = () => vscode.postMessage({ command: "copy", text });

        const editBtn = document.createElement("button");
        editBtn.textContent = "Edit";
        editBtn.onclick = () => {
          const newText = prompt("Edit translation:", text);
          if (newText !== null) {
            vscode.postMessage({ command: "edit", id, text: newText, oldText: text });
          }
        };

        const removeBtn = document.createElement("button");
        removeBtn.textContent = "Remove";
        removeBtn.onclick = () => {
          if (confirm("Remove this translation?")) {
            li.remove();
            vscode.postMessage({ command: "remove", id });
            if (list.children.length === 0) {
              emptyState.style.display = 'block';
              list.style.display = 'none';
            }
          }
        };

        btnGroup.appendChild(copyBtn);
        btnGroup.appendChild(editBtn);
        btnGroup.appendChild(removeBtn);

        li.appendChild(span);
        li.appendChild(btnGroup);
        list.appendChild(li);
      });
    }

    // Notify extension that sidebar is ready
    vscode.postMessage({ command: 'alert', text: 'Sidebar ready!' });
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

  public postMessage(message: any) {
    if (this._view) {
      this._view.webview.postMessage(message);
    }
  }
}
