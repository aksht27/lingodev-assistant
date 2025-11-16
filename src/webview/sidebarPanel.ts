import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs/promises';

const execAsync = promisify(exec);

interface SidebarMessage {
  command: 'generateLocale' | 'copy' | 'edit' | 'remove';
  target?: string;
  bucket?: string;
  key?: string;
  newValue?: string;
}

export class SidebarPanel implements vscode.WebviewViewProvider {
  public static readonly viewType = 'lingodev-sidebar';
  public static currentPanel: SidebarPanel | undefined;

  private _view?: vscode.WebviewView;
  private workspaceRoot: string;

  constructor(private readonly _extensionUri: vscode.Uri, workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
  }

  public static createOrShow(extensionUri: vscode.Uri, workspaceRoot: string) {
    vscode.commands.executeCommand('lingodev-sidebar.focus');
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;
    SidebarPanel.currentPanel = this;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    webviewView.webview.html = this._getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (message: SidebarMessage) => {
      switch (message.command) {
        case 'generateLocale':
          if (!message.target || !message.bucket) {
            vscode.window.showErrorMessage('Select both target language and bucket type');
            return;
          }
          await this.generateLocaleFile(message.target, message.bucket);
          break;
        case 'copy':
          if (message.newValue) {
            await vscode.env.clipboard.writeText(message.newValue);
            vscode.window.showInformationMessage('Copied to clipboard!');
          }
          break;
        case 'edit':
          if (message.key && message.newValue && message.target && message.bucket) {
            await this.updateTranslation(message.target, message.key, message.newValue, message.bucket);
          }
          break;
        case 'remove':
          if (message.key && message.target && message.bucket) {
            await this.removeTranslation(message.target, message.key, message.bucket);
          }
          break;
      }
    });
  }

  public postMessage(message: any): Thenable<boolean> | undefined {
    if (this._view) {
      return this._view.webview.postMessage(message);
    }
    return undefined;
  }

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
        await this.loadAndSendStrings(target, bucket);
        vscode.window.showInformationMessage(`✅ Generated ${target}.${bucket}`);
      } catch (err: any) {
        vscode.window.showErrorMessage(`Error generating locale: ${err.message}`);
        console.error(err);
      }
    });
  }

  private async loadAndSendStrings(target: string, bucket: string) {
    const ext = bucket === 'typescript' ? 'ts' : 'json';
    const localeFile = path.join(this.workspaceRoot, 'i18n', `${target}.${ext}`);
    try {
      const bytes = await fs.readFile(localeFile, 'utf-8');
      let obj: Record<string, any>;
      if (ext === 'ts') {
        const mod = await import(/* webpackIgnore */ localeFile);
        obj = mod.default;
      } else {
        obj = JSON.parse(bytes);
      }

      const list = Object.entries(obj).map(([key, value]) => ({
        key,
        value: String(value)
      }));
      this._view?.webview.postMessage({ command: 'setStrings', target, list });
    } catch (err) {
      console.error('Failed to load locale file:', err);
      vscode.window.showErrorMessage(`Failed to read ${target}.${ext}`);
    }
  }

  private async updateTranslation(target: string, key: string, newValue: string, bucket: string) {
    const ext = bucket === 'typescript' ? 'ts' : 'json';
    const localeFile = path.join(this.workspaceRoot, 'i18n', `${target}.${ext}`);
    const content = await fs.readFile(localeFile, 'utf-8');
    let obj: any;
    if (ext === 'ts') {
      const mod = await import(/* webpackIgnore */ localeFile);
      obj = mod.default;
    } else {
      obj = JSON.parse(content);
    }
    obj[key] = newValue;

    let newFile = '';
    if (ext === 'ts') {
      newFile = `export default ${JSON.stringify(obj, null, 2)};\n`;
    } else {
      newFile = JSON.stringify(obj, null, 2);
    }

    await fs.writeFile(localeFile, newFile, 'utf-8');
    await this.loadAndSendStrings(target, bucket);
  }

  private async removeTranslation(target: string, key: string, bucket: string) {
    const ext = bucket === 'typescript' ? 'ts' : 'json';
    const localeFile = path.join(this.workspaceRoot, 'i18n', `${target}.${ext}`);
    const content = await fs.readFile(localeFile, 'utf-8');
    let obj: any;
    if (ext === 'ts') {
      const mod = await import(/* webpackIgnore */ localeFile);
      obj = mod.default;
    } else {
      obj = JSON.parse(content);
    }

    delete obj[key];

    let newFile = '';
    if (ext === 'ts') {
      newFile = `export default ${JSON.stringify(obj, null, 2)};\n`;
    } else {
      newFile = JSON.stringify(obj, null, 2);
    }

    await fs.writeFile(localeFile, newFile, 'utf-8');
    await this.loadAndSendStrings(target, bucket);
  }

  private _getHtml(webview: vscode.Webview): string {
    const nonce = this._getNonce();
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>LingoDev Sidebar</title>
</head>
<body>
  <h3>🌍 LingoDev Assistant</h3>
  <div>
    <label for="target">Target Language: </label>
    <select id="target">
      <option value="es">es</option>
      <option value="fr">fr</option>
      <option value="de">de</option>
    </select>
  </div>
  <div>
    <label for="bucket">Format / Bucket: </label>
    <select id="bucket">
      <option value="typescript">TypeScript (.ts)</option>
      <option value="json">JSON (.json)</option>
    </select>
  </div>
  <div style="margin-top: 8px;">
    <button id="generate">Generate / Refresh</button>
  </div>

  <h4>Translations:</h4>
  <ul id="strings-list"></ul>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    document.getElementById('generate')?.addEventListener('click', () => {
      const target = (document.getElementById('target') as HTMLSelectElement).value;
      const bucket = (document.getElementById('bucket') as HTMLSelectElement).value;
      vscode.postMessage({ command: 'generateLocale', target, bucket });
    });

    window.addEventListener('message', event => {
      const msg = event.data;
      if (msg.command === 'setStrings') {
        const list = document.getElementById('strings-list');
        if (!list) return;
        list.innerHTML = '';
        msg.list.forEach((item) => {
          const li = document.createElement('li');
          li.textContent = item.key + ': ' + item.value;
          const btnCopy = document.createElement('button');
          btnCopy.textContent = 'Copy';
          btnCopy.onclick = () => {
            vscode.postMessage({ command: 'copy', newValue: item.value });
          };
          const btnEdit = document.createElement('button');
          btnEdit.textContent = 'Edit';
          btnEdit.onclick = () => {
            const newValue = prompt('Edit value for ' + item.key, item.value);
            if (newValue !== null) {
              vscode.postMessage({ command: 'edit', key: item.key, newValue, target: (document.getElementById('target') as HTMLSelectElement).value, bucket: (document.getElementById('bucket') as HTMLSelectElement).value });
            }
          };
          const btnRemove = document.createElement('button');
          btnRemove.textContent = 'Remove';
          btnRemove.onclick = () => {
            if (confirm('Remove ' + item.key + '?')) {
              vscode.postMessage({ command: 'remove', key: item.key, target: (document.getElementById('target') as HTMLSelectElement).value, bucket: (document.getElementById('bucket') as HTMLSelectElement).value });
            }
          };

          li.appendChild(btnCopy);
          li.appendChild(btnEdit);
          li.appendChild(btnRemove);

          list.appendChild(li);
        });
      }
    });
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
