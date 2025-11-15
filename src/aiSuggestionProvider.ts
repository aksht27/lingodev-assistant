export class AISuggestionProvider {
    private workspaceFolder: string;

    constructor(workspaceFolder: string) {
        this.workspaceFolder = workspaceFolder;
    }

    public async getAISuggestions(selectedText: string): Promise<string[]> {
        return [
            `🌍 Consider using i18n key: "user_${selectedText.toLowerCase().replace(/\s+/g, '_')}"`,
            `🤖 AI Suggestion: "${selectedText}" could be contextualized for better translation`,
            `💡 Best Practice: Use descriptive keys like "button_submit" instead of generic text`,
            `⚡ Lingo MCP: Matches common UI patterns - use component-based i18n`,
            `🔧 Use Lingo CLI --ai flag for smart extraction`
        ];
    }

    public async provideI18nPatterns(): Promise<string[]> {
        return [
            '🎯 Component Pattern: use react-i18next with useTranslation()',
            '🎯 Group translations by module/feature',
            '🎯 Key naming: "feature.component.element"',
            '🎯 Implement proper pluralization early',
            '🎯 Use context for gender/conditional translations'
        ];
    }
}
