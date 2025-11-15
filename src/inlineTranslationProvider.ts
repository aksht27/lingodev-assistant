import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';

export class InlineTranslationProvider {
    private decorationType: vscode.TextEditorDecorationType;
    private workspaceFolder: string;

    constructor(workspaceFolder: string) {
        this.workspaceFolder = workspaceFolder;
        
        this.decorationType = vscode.window.createTextEditorDecorationType({
            after: {
                margin: '0 0 0 1em',
                color: new vscode.ThemeColor('descriptionForeground')
            }
        });
    }

    public async updateInlineTranslations(editor: vscode.TextEditor) {
        try {
            // Read translation files
            const enFile = path.join(this.workspaceFolder, 'i18n', 'en.json');
            const esFile = path.join(this.workspaceFolder, 'i18n', 'es.json');
            
            const enContent = await fs.readFile(enFile, 'utf-8');
            const esContent = await fs.readFile(esFile, 'utf-8');
            
            const enTranslations: Record<string, string> = JSON.parse(enContent);
            const esTranslations: Record<string, string> = JSON.parse(esContent);

            const decorations: vscode.DecorationOptions[] = [];
            const document = editor.document;
            const text = document.getText();

            // Find all strings in the document
            const stringRegex = /(["'`])(?:(?=(\\?))\2.)*?\1/g;
            let match;

            while ((match = stringRegex.exec(text)) !== null) {
                const startPos = document.positionAt(match.index);
                const endPos = document.positionAt(match.index + match[0].length);
                const stringContent = match[0].slice(1, -1); // Remove quotes

                // Find translation
                for (const [key, enText] of Object.entries(enTranslations)) {
                    if (enText === stringContent) {
                        const esText = esTranslations[key];
                        if (esText) {
                            const decoration: vscode.DecorationOptions = {
                                range: new vscode.Range(endPos, endPos),
                                renderOptions: {
                                    after: {
                                        contentText: ` → ES: "${esText}"`,
                                        color: 'rgba(150, 150, 150, 0.7)'
                                    }
                                }
                            };
                            decorations.push(decoration);
                        }
                        break;
                    }
                }
            }

            editor.setDecorations(this.decorationType, decorations);
        } catch (error) {
            console.error('Error updating inline translations:', error);
        }
    }

    public dispose() {
        this.decorationType.dispose();
    }
}