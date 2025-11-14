import * as vscode from 'vscode';

interface SidebarMessage {
    command: 
        | 'addStringToUI' 
        | 'updateStringUI' 
        | 'removeStringUI' 
        | 'alert' 
        | 'copy' 
        | 'edit' 
        | 'remove' 
        | 'addMultipleStrings';
    text?: string;
    strings?: string[];
    id?: string;
    oldText?: string;
}

export class SidebarPanel {
    public static currentPanel: SidebarPanel | undefined;

    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];

    private constructor(panel: vscode.WebviewPanel, private readonly _extensionUri: vscode.Uri) {
        this._panel = panel;
        this._panel.webview.html = this._getHtmlForWebview();

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.webview.onDidReceiveMessage(
            (message: SidebarMessage) => {
                switch (message.command) {
                    case 'alert':
                        vscode.window.showInformationMessage(message.text || '');
                        break;

                    case 'copy':
                        vscode.env.clipboard.writeText(message.text || '');
                        vscode.window.showInformationMessage('Copied to clipboard!');
                        break;

                    case 'edit':
                        this._panel.webview.postMessage({ command: 'updateStringUI', id: message.id, text: message.text });
                        if (message.oldText && message.text) {
                            const editor = vscode.window.activeTextEditor;
                            if (editor) {
                                const doc = editor.document;
                                const text = doc.getText();
                                const index = text.indexOf(message.oldText);
                                if (index !== -1) {
                                    const start = doc.positionAt(index);
                                    const end = doc.positionAt(index + message.oldText.length);
                                    editor.edit(editBuilder => editBuilder.replace(new vscode.Range(start, end), message.text!));
                                }
                            }
                        }
                        break;

                    case 'remove':
                        this._panel.webview.postMessage({ command: 'removeStringUI', id: message.id });
                        break;

                    case 'addStringToUI':
                        this._panel.webview.postMessage({ command: 'addStringToUI', text: message.text });
                        break;

                    case 'addMultipleStrings':
                        if (message.strings && message.strings.length > 0) {
                            message.strings.forEach(str => {
                                this._panel.webview.postMessage({ command: 'addStringToUI', text: str });
                            });
                        }
                        break;
                }
            },
            null,
            this._disposables
        );
    }

    public dispose() {
        SidebarPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) disposable.dispose();
        }
    }

    public static createOrShow(extensionUri: vscode.Uri) {
        const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;

        if (SidebarPanel.currentPanel) {
            SidebarPanel.currentPanel._panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'lingodev-sidebar',
            'LingoDev Assistant',
            column,
            { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')] }
        );

        SidebarPanel.currentPanel = new SidebarPanel(panel, extensionUri);
    }

    public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        SidebarPanel.currentPanel = new SidebarPanel(panel, extensionUri);
    }

    private _getHtmlForWebview(): string {
        const nonce = this._getNonce();
        return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline';">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>LingoDev Assistant</title>
            <style>
                body { font-family: sans-serif; padding: 10px; }
                .string-item { margin: 5px 0; padding: 5px; border: 1px solid #ccc; border-radius: 4px; display: flex; align-items: center; justify-content: space-between; }
                .string-text { flex: 1; margin-right: 10px; }
                button { margin-left: 5px; }
            </style>
        </head>
        <body>
            <h1>LingoDev Assistant</h1>
            <button onclick="sendAlert()">Test Alert</button>
            <h2>Extracted Strings:</h2>
            <div id="strings"><i>No strings extracted yet.</i></div>

            <script nonce="${nonce}">
                const vscode = acquireVsCodeApi();

                function sendAlert() {
                    vscode.postMessage({ command: 'alert', text: 'Button clicked!' });
                }

                function generateId() {
                    return 'string-' + Math.random().toString(36).substr(2, 9);
                }

                function createStringItem(text) {
                    const stringsDiv = document.getElementById('strings');
                    if(stringsDiv.querySelector('i')) stringsDiv.innerHTML = '';

                    const id = generateId();
                    const container = document.createElement('div');
                    container.className = 'string-item';
                    container.id = id;

                    const span = document.createElement('span');
                    span.className = 'string-text';
                    span.textContent = text;

                    const copyBtn = document.createElement('button');
                    copyBtn.textContent = 'Copy';
                    copyBtn.onclick = () => vscode.postMessage({ command: 'copy', text: span.textContent });

                    const editBtn = document.createElement('button');
                    editBtn.textContent = 'Edit';
                    editBtn.onclick = () => {
                        const newText = prompt('Edit string:', span.textContent);
                        if(newText !== null){
                            const oldText = span.textContent;
                            span.textContent = newText;
                            vscode.postMessage({ command: 'edit', id, text: newText, oldText });
                        }
                    };

                    const removeBtn = document.createElement('button');
                    removeBtn.textContent = 'Remove';
                    removeBtn.onclick = () => {
                        if(confirm('Are you sure you want to remove this string?')) {
                            container.remove();
                            vscode.postMessage({ command: 'remove', id });
                        }
                    };

                    container.appendChild(span);
                    container.appendChild(copyBtn);
                    container.appendChild(editBtn);
                    container.appendChild(removeBtn);
                    stringsDiv.appendChild(container);
                    stringsDiv.scrollTop = stringsDiv.scrollHeight;
                }

                window.addEventListener('message', event => {
                    const message = event.data;
                    switch(message.command){
                        case 'addStringToUI':
                            createStringItem(message.text);
                            break;
                        case 'updateStringUI':
                            const elem = document.getElementById(message.id);
                            if(elem) elem.querySelector('.string-text').textContent = message.text;
                            break;
                        case 'removeStringUI':
                            const rem = document.getElementById(message.id);
                            if(rem) rem.remove();
                            break;
                        case 'addMultipleStrings':
                            if(message.strings && message.strings.length > 0){
                                message.strings.forEach(str => createStringItem(str));
                            }
                            break;
                    }
                });
            </script>
        </body>
        </html>`;
    }

    private _getNonce(): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        return Array.from({ length: 32 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
    }

    public postMessage(msg: SidebarMessage) {
        this._panel.webview.postMessage(msg);
    }
}
