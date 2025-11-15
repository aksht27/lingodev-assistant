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

export class SidebarPanel implements vscode.WebviewViewProvider {
    public static readonly viewType = 'lingodev-sidebar';
    public static currentPanel: SidebarPanel | undefined;

    private _view?: vscode.WebviewView;

    constructor(private readonly _extensionUri: vscode.Uri) {}

    public static createOrShow(extensionUri: vscode.Uri) {
        // For sidebar, we don't need to manually create - it's handled by the view provider
        vscode.commands.executeCommand('lingodev-sidebar.focus');
    }

    // Add a type guard method to safely access currentPanel
    public static hasCurrentPanel(): boolean {
        return !!this.currentPanel;
    }

    // Add a safe method to post messages
    public static safePostMessage(message: any): boolean {
        if (this.currentPanel && this.currentPanel.postMessage) {
            this.currentPanel.postMessage(message);
            return true;
        }
        return false;
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;
        SidebarPanel.currentPanel = this;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(
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
                }
            }
        );
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        const nonce = this._getNonce();
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LingoDev Assistant</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-sideBar-background);
            padding: 10px;
            margin: 0;
        }
        .container {
            max-width: 100%;
        }
        .header {
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        h1 {
            font-size: 1.2em;
            margin: 0 0 10px 0;
            color: var(--vscode-titleBar-activeForeground);
        }
        h2 {
            font-size: 1em;
            margin: 15px 0 10px 0;
            color: var(--vscode-descriptionForeground);
        }
        .test-button {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 12px;
            border-radius: 2px;
            cursor: pointer;
            margin-bottom: 15px;
        }
        .test-button:hover {
            background: var(--vscode-button-hoverBackground);
        }
        .strings-list {
            list-style: none;
            padding: 0;
            margin: 0;
        }
        .string-item {
            padding: 8px 12px;
            margin: 5px 0;
            background: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            border-radius: 3px;
            word-break: break-word;
        }
        .empty-state {
            text-align: center;
            padding: 20px;
            color: var(--vscode-descriptionForeground);
            font-style: italic;
        }
        .button-group {
            display: flex;
            gap: 5px;
            margin-top: 8px;
        }
        .button-group button {
            flex: 1;
            padding: 4px 8px;
            border: 1px solid var(--vscode-button-border);
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border-radius: 2px;
            cursor: pointer;
            font-size: 0.9em;
        }
        .button-group button:hover {
            background: var(--vscode-button-hoverBackground);
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🌍 LingoDev Assistant</h1>
            <p>Extracted & Translated Strings</p>
        </div>
        
        <button class="test-button" onclick="sendAlert()">Test Connection</button>
        
        <h2>Translations:</h2>
        <div id="strings-container">
            <div class="empty-state" id="empty-state">
                No strings yet. Select text in your code and use "Extract Selected String" to see translations here.
            </div>
            <ul class="strings-list" id="strings-list" style="display: none;"></ul>
        </div>
    </div>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();

        function sendAlert() {
            vscode.postMessage({ command: 'alert', text: 'Sidebar is working! 🎉' });
        }

        function generateId() {
            return 'string-' + Math.random().toString(36).substr(2, 9);
        }

        function createStringItem(text) {
            const stringsDiv = document.getElementById('strings-list');
            const emptyState = document.getElementById('empty-state');
            
            // Hide empty state and show list
            emptyState.style.display = 'none';
            stringsDiv.style.display = 'block';

            const id = generateId();
            const container = document.createElement('li');
            container.className = 'string-item';
            container.id = id;

            const span = document.createElement('span');
            span.textContent = text;

            const buttonGroup = document.createElement('div');
            buttonGroup.className = 'button-group';

            const copyBtn = document.createElement('button');
            copyBtn.textContent = 'Copy';
            copyBtn.onclick = () => {
                vscode.postMessage({ command: 'copy', text: text });
            };

            const editBtn = document.createElement('button');
            editBtn.textContent = 'Edit';
            editBtn.onclick = () => {
                const newText = prompt('Edit translation:', text);
                if (newText !== null) {
                    vscode.postMessage({
                        command: 'edit',
                        id: id,
                        text: newText,
                        oldText: text
                    });
                }
            };

            const removeBtn = document.createElement('button');
            removeBtn.textContent = 'Remove';
            removeBtn.onclick = () => {
                if (confirm('Remove this translation?')) {
                    container.remove();
                    vscode.postMessage({ command: 'remove', id: id });
                    // Show empty state if no items left
                    if (stringsDiv.children.length === 0) {
                        emptyState.style.display = 'block';
                        stringsDiv.style.display = 'none';
                    }
                }
            };

            buttonGroup.appendChild(copyBtn);
            buttonGroup.appendChild(editBtn);
            buttonGroup.appendChild(removeBtn);

            container.appendChild(span);
            container.appendChild(buttonGroup);
            stringsDiv.appendChild(container);
        }

        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            console.log('📨 Sidebar received message:', message);
            
            switch (message.command) {
                case 'addStringToUI':
                    createStringItem(message.text);
                    break;
                    
                case 'updateStringUI': {
                    const elem = document.getElementById(message.id);
                    if (elem) {
                        const span = elem.querySelector('span');
                        if (span) span.textContent = message.text;
                    }
                    break;
                }
                    
                case 'removeStringUI': {
                    const elem = document.getElementById(message.id);
                    if (elem) {
                        elem.remove();
                        const stringsList = document.getElementById('strings-list');
                        const emptyState = document.getElementById('empty-state');
                        if (stringsList.children.length === 0) {
                            emptyState.style.display = 'block';
                            stringsList.style.display = 'none';
                        }
                    }
                    break;
                }
                    
                case 'addMultipleStrings':
                    console.log('🎯 Adding multiple strings:', message.strings);
                    const stringsList = document.getElementById('strings-list');
                    const emptyState = document.getElementById('empty-state');
                    
                    if (message.strings && message.strings.length > 0) {
                        // Clear existing items
                        stringsList.innerHTML = '';
                        emptyState.style.display = 'none';
                        stringsList.style.display = 'block';
                        
                        // Add new strings
                        message.strings.forEach(str => {
                            createStringItem(str);
                        });
                        
                        console.log('✅ Successfully added ' + message.strings.length + ' strings to sidebar');
                    } else {
                        emptyState.style.display = 'block';
                        stringsList.style.display = 'none';
                    }
                    break;
            }
        });

        console.log('✅ Sidebar JavaScript loaded successfully');
        
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
            console.log('📤 Sending message to sidebar:', message);
            this._view.webview.postMessage(message);
        } else {
            console.error('❌ Cannot post message - sidebar view not available');
        }
    }
}