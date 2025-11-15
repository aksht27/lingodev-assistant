import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';

export class PreviewPanel {
    public static currentPanel: PreviewPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private workspaceFolder: string;

    public static createOrShow(extensionUri: vscode.Uri, workspaceFolder: string) {
        const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;

        if (PreviewPanel.currentPanel) {
            PreviewPanel.currentPanel._panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'lingodev-preview',
            '🌍 Live Translation Preview',
            column,
            { enableScripts: true, localResourceRoots: [extensionUri] }
        );

        PreviewPanel.currentPanel = new PreviewPanel(panel, workspaceFolder);
    }

    private constructor(panel: vscode.WebviewPanel, workspaceFolder: string) {
        this._panel = panel;
        this.workspaceFolder = workspaceFolder;

        this.updatePreview();

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    }

    private async _getHtmlForWebview(): Promise<string> {
        const translations = await this.getTranslations();
        return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Live Translation Preview</title>
            <style>
                body { font-family: system-ui, sans-serif; padding: 20px; background: #1e1e1e; color: #fff; }
                .language-selector { margin-bottom:20px; padding:10px; background:#2d2d2d; border-radius:5px; }
                select { padding:8px; background:#3c3c3c; color:white; border:1px solid #555; border-radius:3px; }
                .preview-area { border:2px solid #555; padding:20px; border-radius:8px; background:#252526; min-height:200px; }
                .translation-item { padding:10px; margin:5px 0; background:#2d2d2d; border-left:3px solid #007acc; }
            </style>
        </head>
        <body>
            <div class="language-selector">
                <label>Language: </label>
                <select id="languageSelect">
                    <option value="en">English</option>
                    <option value="es">Spanish</option>
                    <option value="fr">French</option>
                    <option value="de">German</option>
                </select>
            </div>
            <div class="preview-area" id="previewArea">
                <h3>🌐 Live Translation Preview</h3>
                <div id="translationsContainer"></div>
            </div>
            <script>
                const translations = ${JSON.stringify(translations)};
                const languageSelect = document.getElementById('languageSelect');
                const container = document.getElementById('translationsContainer');

                function updatePreview() {
                    const lang = languageSelect.value;
                    container.innerHTML = '';
                    for(const [key,value] of Object.entries(translations[lang] || {})){
                        const div = document.createElement('div');
                        div.className='translation-item';
                        div.innerHTML=\`<strong>\${key}:</strong> \${value}\`;
                        container.appendChild(div);
                    }
                }

                languageSelect.addEventListener('change', updatePreview);
                updatePreview();
            </script>
        </body>
        </html>`;
    }

    private async getTranslations(): Promise<Record<string, any>> {
        try {
            const enFile = path.join(this.workspaceFolder, 'i18n', 'en.json');
            const esFile = path.join(this.workspaceFolder, 'i18n', 'es.json');

            const enContent = await fs.readFile(enFile, 'utf-8');
            const esContent = await fs.readFile(esFile, 'utf-8');

            return { en: JSON.parse(enContent), es: JSON.parse(esContent), fr: {}, de: {} };
        } catch {
            return { en: {}, es: {}, fr: {}, de: {} };
        }
    }

    public async updatePreview() {
        const html = await this._getHtmlForWebview();
        this._panel.webview.html = html;
    }

    public dispose() {
        PreviewPanel.currentPanel = undefined;
        this._panel.dispose();
        while(this._disposables.length){
            const d = this._disposables.pop();
            if(d) d.dispose();
        }
    }
}
