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
            '🌍 Translation Preview',
            column,
            { 
                enableScripts: true, 
                localResourceRoots: [extensionUri],
                retainContextWhenHidden: true
            }
        );

        PreviewPanel.currentPanel = new PreviewPanel(panel, workspaceFolder);
    }

    private constructor(panel: vscode.WebviewPanel, workspaceFolder: string) {
        this._panel = panel;
        this.workspaceFolder = workspaceFolder;

        this.updatePreview();

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        
        this._panel.onDidChangeViewState(
            () => {
                if (this._panel.visible) {
                    this.updatePreview();
                }
            },
            null,
            this._disposables
        );
    }

    private async _getHtmlForWebview(): Promise<string> {
        const translations = await this.getTranslations();
        const enTranslations = translations.en || {};

        return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Translation Preview</title>
            <style>
                :root {
                    --primary: #007acc;
                    --primary-dark: #005a9e;
                    --primary-light: #4fc3f7;
                    --bg-primary: #1e1e1e;
                    --bg-secondary: #252526;
                    --bg-tertiary: #2d2d2d;
                    --bg-hover: #323233;
                    --text-primary: #ffffff;
                    --text-secondary: #cccccc;
                    --text-muted: #969696;
                    --border: #3e3e42;
                    --border-light: #464647;
                    --success: #4EC9B0;
                    --warning: #CE9178;
                    --error: #F44747;
                    --radius: 8px;
                    --shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
                    --transition: all 0.2s ease;
                }

                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }

                body {
                    font-family: 'Segoe UI', system-ui, sans-serif;
                    background: var(--bg-primary);
                    color: var(--text-primary);
                    line-height: 1.5;
                    padding: 0;
                    overflow-x: hidden;
                }

                .container {
                    max-width: 100%;
                    padding: 20px;
                }

                .header {
                    text-align: center;
                    margin-bottom: 32px;
                    padding: 20px 0;
                }

                .header h1 {
                    font-size: 28px;
                    font-weight: 600;
                    margin-bottom: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 12px;
                }

                .header .subtitle {
                    color: var(--text-secondary);
                    font-size: 14px;
                }

                .translation-container {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 24px;
                    max-width: 1200px;
                    margin: 0 auto;
                }

                .language-section {
                    background: var(--bg-secondary);
                    border: 1px solid var(--border);
                    border-radius: var(--radius);
                    padding: 24px;
                    box-shadow: var(--shadow);
                }

                .section-header {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 20px;
                    padding-bottom: 16px;
                    border-bottom: 1px solid var(--border-light);
                }

                .language-flag {
                    font-size: 24px;
                }

                .language-info {
                    flex: 1;
                }

                .language-name {
                    font-size: 16px;
                    font-weight: 600;
                    color: var(--text-primary);
                    margin-bottom: 4px;
                }

                .language-code {
                    font-size: 14px;
                    color: var(--text-muted);
                    font-family: 'Cascadia Code', monospace;
                }

                .text-area-container {
                    margin-bottom: 20px;
                }

                .text-area-container:last-child {
                    margin-bottom: 0;
                }

                .text-area-label {
                    display: block;
                    font-size: 14px;
                    font-weight: 500;
                    color: var(--text-secondary);
                    margin-bottom: 8px;
                }

                .text-area {
                    width: 100%;
                    min-height: 120px;
                    padding: 16px;
                    background: var(--bg-tertiary);
                    border: 1px solid var(--border);
                    border-radius: var(--radius);
                    color: var(--text-primary);
                    font-family: 'Segoe UI', system-ui, sans-serif;
                    font-size: 14px;
                    line-height: 1.5;
                    resize: vertical;
                    transition: var(--transition);
                }

                .text-area:focus {
                    outline: none;
                    border-color: var(--primary);
                    box-shadow: 0 0 0 2px rgba(0, 122, 204, 0.3);
                }

                .text-area.readonly {
                    background: var(--bg-secondary);
                    color: var(--text-secondary);
                    cursor: not-allowed;
                }

                .source-text-item {
                    background: var(--bg-tertiary);
                    border: 1px solid var(--border-light);
                    border-radius: var(--radius);
                    padding: 12px 16px;
                    margin-bottom: 8px;
                    cursor: pointer;
                    transition: var(--transition);
                }

                .source-text-item:hover {
                    background: var(--bg-hover);
                    border-color: var(--primary-light);
                }

                .source-text-item:last-child {
                    margin-bottom: 0;
                }

                .translation-item {
                    background: var(--bg-tertiary);
                    border: 1px solid var(--border-light);
                    border-radius: var(--radius);
                    padding: 12px 16px;
                    margin-bottom: 8px;
                    transition: var(--transition);
                }

                .translation-item:last-child {
                    margin-bottom: 0;
                }

                .translation-key {
                    font-family: 'Cascadia Code', monospace;
                    font-size: 12px;
                    color: var(--warning);
                    margin-bottom: 4px;
                }

                .translation-value {
                    font-size: 14px;
                    color: var(--text-primary);
                }

                .empty-state {
                    text-align: center;
                    padding: 40px 20px;
                    color: var(--text-muted);
                }

                .empty-state .icon {
                    font-size: 48px;
                    margin-bottom: 16px;
                    opacity: 0.5;
                }

                .empty-state h3 {
                    font-size: 16px;
                    margin-bottom: 8px;
                    color: var(--text-secondary);
                }

                .empty-state p {
                    font-size: 14px;
                }

                .select-wrapper {
                    position: relative;
                    margin-bottom: 20px;
                }

                .select-wrapper::after {
                    content: '▼';
                    position: absolute;
                    right: 16px;
                    top: 50%;
                    transform: translateY(-50%);
                    color: var(--text-muted);
                    font-size: 12px;
                    pointer-events: none;
                }

                select {
                    width: 100%;
                    padding: 12px 16px;
                    background: var(--bg-tertiary);
                    color: var(--text-primary);
                    border: 1px solid var(--border);
                    border-radius: var(--radius);
                    font-size: 14px;
                    appearance: none;
                    cursor: pointer;
                    transition: var(--transition);
                }

                select:hover {
                    border-color: var(--primary);
                    background: var(--bg-hover);
                }

                select:focus {
                    outline: none;
                    border-color: var(--primary);
                    box-shadow: 0 0 0 2px rgba(0, 122, 204, 0.3);
                }

                .footer {
                    margin-top: 32px;
                    text-align: center;
                    color: var(--text-muted);
                    font-size: 12px;
                    padding: 16px;
                    border-top: 1px solid var(--border-light);
                }

                /* Responsive Design */
                @media (max-width: 768px) {
                    .translation-container {
                        grid-template-columns: 1fr;
                        gap: 16px;
                    }
                    
                    .container {
                        padding: 16px;
                    }
                    
                    .language-section {
                        padding: 20px;
                    }
                }

                /* Scrollbar Styling */
                ::-webkit-scrollbar {
                    width: 8px;
                }

                ::-webkit-scrollbar-track {
                    background: var(--bg-tertiary);
                }

                ::-webkit-scrollbar-thumb {
                    background: var(--border);
                    border-radius: 4px;
                }

                ::-webkit-scrollbar-thumb:hover {
                    background: var(--border-light);
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>
                        <span class="icon">🌍</span>
                        Live Translation Preview
                    </h1>
                    <p class="subtitle">Real-time translation comparison between source and target languages</p>
                </div>

                <div class="translation-container">
                    <!-- Source Language Section -->
                    <div class="language-section">
                        <div class="section-header">
                            <div class="language-flag">🇺🇸</div>
                            <div class="language-info">
                                <div class="language-name">Source Language</div>
                                <div class="language-code">en-US</div>
                            </div>
                        </div>

                        <div class="text-area-container">
                            <label class="text-area-label">Source Text</label>
                            <div id="sourceTextList">
                                ${Object.keys(enTranslations).length > 0 ? 
                                    Object.entries(enTranslations).slice(0, 5).map(([key, value]) => `
                                        <div class="source-text-item" data-key="${key}">
                                            <div class="translation-key">${key}</div>
                                            <div class="translation-value">${value}</div>
                                        </div>
                                    `).join('') : 
                                    '<div class="empty-state"><div class="icon">📝</div><h3>No source text</h3><p>Add translations to see source text</p></div>'
                                }
                            </div>
                        </div>
                    </div>

                    <!-- Target Language Section -->
                    <div class="language-section">
                        <div class="section-header">
                            <div class="language-flag">🌐</div>
                            <div class="language-info">
                                <div class="language-name">Target Language</div>
                                <div class="language-code" id="targetLanguageCode">Select target language</div>
                            </div>
                        </div>

                        <div class="select-wrapper">
                            <select id="targetLanguageSelect">
                                <option value="">Select target language</option>
                                <option value="es">🇪🇸 Spanish (es-ES)</option>
                                <option value="fr">🇫🇷 French (fr-FR)</option>
                                <option value="de">🇩🇪 German (de-DE)</option>
                                <option value="it">🇮🇹 Italian (it-IT)</option>
                                <option value="ja">🇯🇵 Japanese (ja-JP)</option>
                                <option value="zh">🇨🇳 Chinese (zh-CN)</option>
                                <option value="ko">🇰🇷 Korean (ko-KR)</option>
                                <option value="ru">🇷🇺 Russian (ru-RU)</option>
                                <option value="pt">🇵🇹 Portuguese (pt-PT)</option>
                                <option value="ar">🇸🇦 Arabic (ar-SA)</option>
                            </select>
                        </div>

                        <div class="text-area-container">
                            <label class="text-area-label">Translated Text</label>
                            <div id="translatedTextList">
                                <div class="empty-state">
                                    <div class="icon">🔍</div>
                                    <h3>No translation selected</h3>
                                    <p>Select a target language to see translations</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="footer">
                    <p>🌍 LingoDev • Translation Preview • Click source text to see translations</p>
                </div>
            </div>

            <script>
                const translations = ${JSON.stringify(translations)};
                const targetLanguageSelect = document.getElementById('targetLanguageSelect');
                const targetLanguageCode = document.getElementById('targetLanguageCode');
                const translatedTextList = document.getElementById('translatedTextList');
                const sourceTextItems = document.querySelectorAll('.source-text-item');

                let currentTargetLanguage = '';
                let selectedSourceKey = '';

                function updateTargetLanguageDisplay() {
                    const selectedOption = targetLanguageSelect.options[targetLanguageSelect.selectedIndex];
                    if (selectedOption.value) {
                        targetLanguageCode.textContent = selectedOption.value + '-' + selectedOption.value.toUpperCase();
                        currentTargetLanguage = selectedOption.value;
                        updateTranslations();
                    } else {
                        targetLanguageCode.textContent = 'Select target language';
                        currentTargetLanguage = '';
                        translatedTextList.innerHTML = \`
                            <div class="empty-state">
                                <div class="icon">🔍</div>
                                <h3>No translation selected</h3>
                                <p>Select a target language to see translations</p>
                            </div>
                        \`;
                    }
                }

                function updateTranslations() {
                    if (!currentTargetLanguage) return;

                    const targetTranslations = translations[currentTargetLanguage] || {};
                    
                    if (selectedSourceKey) {
                        // Show translation for selected key
                        const translation = targetTranslations[selectedSourceKey];
                        translatedTextList.innerHTML = \`
                            <div class="translation-item">
                                <div class="translation-key">\${selectedSourceKey}</div>
                                <div class="translation-value">\${translation || '<em style="color: var(--text-muted);">No translation available</em>'}</div>
                            </div>
                        \`;
                    } else {
                        // Show all translations for the target language
                        const translationEntries = Object.entries(targetTranslations);
                        if (translationEntries.length > 0) {
                            translatedTextList.innerHTML = translationEntries.slice(0, 5).map(([key, value]) => \`
                                <div class="translation-item">
                                    <div class="translation-key">\${key}</div>
                                    <div class="translation-value">\${value}</div>
                                </div>
                            \`).join('');
                        } else {
                            translatedTextList.innerHTML = \`
                                <div class="empty-state">
                                    <div class="icon">🚫</div>
                                    <h3>No translations available</h3>
                                    <p>No translations found for \${currentTargetLanguage}</p>
                                </div>
                            \`;
                        }
                    }
                }

                function selectSourceText(key) {
                    // Remove selection from all items
                    sourceTextItems.forEach(item => {
                        item.style.borderColor = 'var(--border-light)';
                        item.style.background = 'var(--bg-tertiary)';
                    });
                    
                    // Add selection to clicked item
                    const selectedItem = document.querySelector(\`[data-key="\${key}"]\`);
                    if (selectedItem) {
                        selectedItem.style.borderColor = 'var(--primary)';
                        selectedItem.style.background = 'var(--primary-dark)';
                    }
                    
                    selectedSourceKey = key;
                    updateTranslations();
                }

                // Event Listeners
                targetLanguageSelect.addEventListener('change', updateTargetLanguageDisplay);

                sourceTextItems.forEach(item => {
                    item.addEventListener('click', () => {
                        const key = item.getAttribute('data-key');
                        selectSourceText(key);
                    });
                });

                // Initialize
                updateTargetLanguageDisplay();
            </script>
        </body>
        </html>`;
    }

    private async getTranslations(): Promise<Record<string, any>> {
        try {
            const i18nPath = path.join(this.workspaceFolder, 'i18n');
            const files = await fs.readdir(i18nPath);
            const translations: Record<string, any> = {};

            for (const file of files) {
                if (file.endsWith('.json')) {
                    const lang = path.basename(file, '.json');
                    const content = await fs.readFile(path.join(i18nPath, file), 'utf-8');
                    translations[lang] = JSON.parse(content);
                }
            }

            // Ensure we have all supported languages
            const supportedLangs = ['en', 'es', 'fr', 'de', 'it', 'ja', 'zh', 'ko', 'ru', 'pt', 'ar'];
            supportedLangs.forEach(lang => {
                if (!translations[lang]) {
                    translations[lang] = {};
                }
            });

            return translations;
        } catch (error) {
            console.error('Error loading translations:', error);
            return { 
                en: {}, es: {}, fr: {}, de: {}, it: {}, ja: {}, 
                zh: {}, ko: {}, ru: {}, pt: {}, ar: {} 
            };
        }
    }

    public async updatePreview() {
        const html = await this._getHtmlForWebview();
        this._panel.webview.html = html;
    }

    public dispose() {
        PreviewPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const d = this._disposables.pop();
            if (d) {
                d.dispose();
            }
        }
    }
}