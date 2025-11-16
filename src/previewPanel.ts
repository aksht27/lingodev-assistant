import * as vscode from 'vscode';

export class PreviewPanel {
    public static currentPanel: PreviewPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];

    public static createOrShow(extensionUri: vscode.Uri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (PreviewPanel.currentPanel) {
            PreviewPanel.currentPanel._panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'translationPreview',
            '🌐 Lingo Live Translation',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [extensionUri],
                retainContextWhenHidden: true
            }
        );

        PreviewPanel.currentPanel = new PreviewPanel(panel, extensionUri);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._panel.webview.html = this._getWebviewContent();
        
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.webview.onDidReceiveMessage(async data => {
            switch (data.type) {
                case 'translate':
                    const translated = await this.translateText(data.text, data.sourceLang, data.targetLang);
                    this._panel.webview.postMessage({
                        type: 'translationResult',
                        value: translated
                    });
                    break;
                case 'getClipboard':
                    const clipboardText = await vscode.env.clipboard.readText();
                    this._panel.webview.postMessage({
                        type: 'clipboardContent',
                        value: clipboardText
                    });
                    break;
                case 'swapLanguages':
                    this._panel.webview.postMessage({
                        type: 'swapLanguages'
                    });
                    break;
            }
        });

        this._panel.onDidChangeViewState(e => {
            if (e.webviewPanel.visible) {
                this._panel.webview.postMessage({ type: 'panelVisible' });
            }
        });
    }

    private async translateText(text: string, sourceLang: string, targetLang: string): Promise<string> {
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Mock translations for demo
        const translations: any = {
            'en-fr': `[French] ${text}`,
            'en-es': `[Spanish] ${text}`,
            'en-de': `[German] ${text}`,
            'en-ja': `[Japanese] ${text}`,
            'en-zh': `[Chinese] ${text}`,
            'fr-en': `[English] ${text}`,
            'es-en': `[English] ${text}`,
            'de-en': `[English] ${text}`,
            'ja-en': `[English] ${text}`,
            'zh-en': `[English] ${text}`
        };

        const key = `${sourceLang}-${targetLang}`;
        return translations[key] || `[${targetLang.toUpperCase()}] ${text}`;
    }

    public setTranslationText(text: string) {
        this._panel.webview.postMessage({
            type: 'setText',
            value: text
        });
    }

    private _getWebviewContent() {
        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Lingo Live Translation</title>
                <style>
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }
                    body { 
                        padding: 0;
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        color: #333;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        min-height: 100vh;
                    }
                    .container {
                        max-width: 1200px;
                        margin: 0 auto;
                        padding: 20px;
                    }
                    .header {
                        text-align: center;
                        margin-bottom: 30px;
                        color: white;
                    }
                    .header h1 {
                        font-size: 2.5rem;
                        margin-bottom: 10px;
                        text-shadow: 0 2px 4px rgba(0,0,0,0.3);
                    }
                    .header p {
                        font-size: 1.1rem;
                        opacity: 0.9;
                    }
                    .translation-card {
                        background: white;
                        border-radius: 15px;
                        padding: 30px;
                        box-shadow: 0 10px 30px rgba(0,0,0,0.2);
                        backdrop-filter: blur(10px);
                    }
                    .language-controls {
                        display: grid;
                        grid-template-columns: 1fr auto 1fr;
                        gap: 20px;
                        align-items: end;
                        margin-bottom: 30px;
                    }
                    .language-group {
                        display: flex;
                        flex-direction: column;
                    }
                    .language-group label {
                        font-weight: 600;
                        margin-bottom: 8px;
                        color: #555;
                    }
                    .language-select {
                        padding: 12px 15px;
                        border: 2px solid #e1e5e9;
                        border-radius: 8px;
                        font-size: 16px;
                        background: white;
                        transition: border-color 0.3s;
                    }
                    .language-select:focus {
                        outline: none;
                        border-color: #667eea;
                    }
                    .swap-btn {
                        background: #667eea;
                        color: white;
                        border: none;
                        border-radius: 50%;
                        width: 50px;
                        height: 50px;
                        font-size: 20px;
                        cursor: pointer;
                        transition: all 0.3s;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin-bottom: 8px;
                    }
                    .swap-btn:hover {
                        background: #764ba2;
                        transform: rotate(180deg);
                    }
                    .text-areas {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 20px;
                        margin-bottom: 25px;
                    }
                    .text-area-group {
                        display: flex;
                        flex-direction: column;
                    }
                    .text-area-group label {
                        font-weight: 600;
                        margin-bottom: 8px;
                        color: #555;
                    }
                    .text-area {
                        padding: 15px;
                        border: 2px solid #e1e5e9;
                        border-radius: 8px;
                        font-size: 16px;
                        resize: vertical;
                        min-height: 150px;
                        font-family: inherit;
                        transition: border-color 0.3s;
                    }
                    .text-area:focus {
                        outline: none;
                        border-color: #667eea;
                    }
                    .controls {
                        display: flex;
                        gap: 15px;
                        justify-content: center;
                        margin-top: 25px;
                    }
                    .btn {
                        padding: 12px 30px;
                        border: none;
                        border-radius: 8px;
                        font-size: 16px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.3s;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                    }
                    .btn-primary {
                        background: #667eea;
                        color: white;
                    }
                    .btn-primary:hover {
                        background: #764ba2;
                        transform: translateY(-2px);
                    }
                    .btn-secondary {
                        background: #f8f9fa;
                        color: #333;
                        border: 2px solid #e1e5e9;
                    }
                    .btn-secondary:hover {
                        background: #e9ecef;
                    }
                    .btn:disabled {
                        opacity: 0.6;
                        cursor: not-allowed;
                        transform: none;
                    }
                    .translation-info {
                        text-align: center;
                        margin-top: 20px;
                        padding: 15px;
                        background: #f8f9fa;
                        border-radius: 8px;
                        border-left: 4px solid #667eea;
                    }
                    .char-count {
                        text-align: right;
                        font-size: 14px;
                        color: #666;
                        margin-top: 5px;
                    }
                    .loading {
                        display: inline-block;
                        width: 20px;
                        height: 20px;
                        border: 3px solid #f3f3f3;
                        border-top: 3px solid #667eea;
                        border-radius: 50%;
                        animation: spin 1s linear infinite;
                    }
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                    .feature-tags {
                        display: flex;
                        gap: 10px;
                        justify-content: center;
                        margin-top: 20px;
                        flex-wrap: wrap;
                    }
                    .tag {
                        background: rgba(102, 126, 234, 0.1);
                        color: #667eea;
                        padding: 5px 12px;
                        border-radius: 20px;
                        font-size: 12px;
                        font-weight: 600;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🌐 Lingo Live Translation</h1>
                        <p>Professional translation powered by Lingo AI Technology</p>
                    </div>
                    
                    <div class="translation-card">
                        <div class="language-controls">
                            <div class="language-group">
                                <label for="sourceLang">Source Language</label>
                                <select id="sourceLang" class="language-select">
                                    <option value="en">English</option>
                                    <option value="fr">French</option>
                                    <option value="es">Spanish</option>
                                    <option value="de">German</option>
                                    <option value="ja">Japanese</option>
                                    <option value="zh">Chinese</option>
                                </select>
                            </div>
                            
                            <button class="swap-btn" title="Swap languages">⇄</button>
                            
                            <div class="language-group">
                                <label for="targetLang">Target Language</label>
                                <select id="targetLang" class="language-select">
                                    <option value="fr">French</option>
                                    <option value="es">Spanish</option>
                                    <option value="de">German</option>
                                    <option value="ja">Japanese</option>
                                    <option value="zh">Chinese</option>
                                    <option value="en">English</option>
                                </select>
                            </div>
                        </div>

                        <div class="text-areas">
                            <div class="text-area-group">
                                <label for="sourceText">Text to Translate</label>
                                <textarea 
                                    id="sourceText" 
                                    class="text-area" 
                                    placeholder="Enter text to translate or paste from clipboard..."
                                    rows="6"
                                ></textarea>
                                <div class="char-count">
                                    <span id="sourceCharCount">0</span> characters
                                </div>
                            </div>
                            
                            <div class="text-area-group">
                                <label for="targetText">Translation</label>
                                <textarea 
                                    id="targetText" 
                                    class="text-area" 
                                    placeholder="Translation will appear here..."
                                    rows="6"
                                    readonly
                                ></textarea>
                                <div class="char-count">
                                    <span id="targetCharCount">0</span> characters
                                </div>
                            </div>
                        </div>

                        <div class="controls">
                            <button id="translateBtn" class="btn btn-primary">
                                <span>🚀 Translate</span>
                            </button>
                            <button id="clearBtn" class="btn btn-secondary">
                                <span>🗑️ Clear</span>
                            </button>
                        </div>

                        <div class="translation-info">
                            <strong>💡 Tip:</strong> Copy strings from your code in the sidebar and paste here for instant translation.
                        </div>

                        <div class="feature-tags">
                            <span class="tag">AI-Powered</span>
                            <span class="tag">Real-time</span>
                            <span class="tag">100+ Languages</span>
                            <span class="tag">Context-Aware</span>
                            <span class="tag">Team Sync</span>
                        </div>
                    </div>
                </div>

                <script>
                    const vscode = acquireVsCodeApi();
                    const sourceText = document.getElementById('sourceText');
                    const targetText = document.getElementById('targetText');
                    const sourceLang = document.getElementById('sourceLang');
                    const targetLang = document.getElementById('targetLang');
                    const translateBtn = document.getElementById('translateBtn');
                    const clearBtn = document.getElementById('clearBtn');
                    const swapBtn = document.querySelector('.swap-btn');
                    const sourceCharCount = document.getElementById('sourceCharCount');
                    const targetCharCount = document.getElementById('targetCharCount');

                    // Update character count
                    sourceText.addEventListener('input', () => {
                        sourceCharCount.textContent = sourceText.value.length;
                    });

                    targetText.addEventListener('input', () => {
                        targetCharCount.textContent = targetText.value.length;
                    });

                    // Swap languages
                    swapBtn.addEventListener('click', () => {
                        const tempLang = sourceLang.value;
                        sourceLang.value = targetLang.value;
                        targetLang.value = tempLang;
                        
                        const tempText = sourceText.value;
                        sourceText.value = targetText.value;
                        targetText.value = tempText;
                        
                        // Update character counts
                        sourceCharCount.textContent = sourceText.value.length;
                        targetCharCount.textContent = targetText.value.length;
                    });

                    // Auto-translate when text is pasted
                    sourceText.addEventListener('paste', (e) => {
                        setTimeout(() => {
                            if (sourceText.value.trim()) {
                                translateText();
                            }
                        }, 100);
                    });

                    // Translate button
                    translateBtn.addEventListener('click', translateText);

                    // Clear button
                    clearBtn.addEventListener('click', () => {
                        sourceText.value = '';
                        targetText.value = '';
                        sourceCharCount.textContent = '0';
                        targetCharCount.textContent = '0';
                        sourceText.focus();
                    });

                    // Auto-translate on Enter (with Ctrl/Cmd)
                    sourceText.addEventListener('keydown', (e) => {
                        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                            translateText();
                        }
                    });

                    function translateText() {
                        const text = sourceText.value.trim();
                        if (!text) {
                            vscode.postMessage({ type: 'getClipboard' });
                            return;
                        }

                        const originalText = translateBtn.innerHTML;
                        translateBtn.innerHTML = '<div class="loading"></div> Translating...';
                        translateBtn.disabled = true;
                        
                        vscode.postMessage({
                            type: 'translate',
                            text: text,
                            sourceLang: sourceLang.value,
                            targetLang: targetLang.value
                        });
                    }

                    // Handle messages from extension
                    window.addEventListener('message', (event) => {
                        const message = event.data;
                        
                        switch (message.type) {
                            case 'translationResult':
                                targetText.value = message.value;
                                targetCharCount.textContent = message.value.length;
                                translateBtn.innerHTML = '🚀 Translate';
                                translateBtn.disabled = false;
                                break;
                                
                            case 'clipboardContent':
                                if (message.value && message.value.trim()) {
                                    sourceText.value = message.value;
                                    sourceCharCount.textContent = message.value.length;
                                    setTimeout(translateText, 100);
                                }
                                break;
                                
                            case 'setText':
                                if (message.value) {
                                    sourceText.value = message.value;
                                    sourceCharCount.textContent = message.value.length;
                                    setTimeout(translateText, 100);
                                }
                                break;
                                
                            case 'panelVisible':
                                vscode.postMessage({ type: 'getClipboard' });
                                break;
                                
                            case 'swapLanguages':
                                swapBtn.click();
                                break;
                        }
                    });

                    // Get clipboard content when panel loads
                    vscode.postMessage({ type: 'getClipboard' });

                    // Focus the source text area
                    sourceText.focus();
                </script>
            </body>
            </html>`;
    }

    public dispose() {
        PreviewPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }
}