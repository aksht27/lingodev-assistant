declare module 'lingo.dev' {
    export class LingoDotDevEngine {
        constructor(options?: { apiKey?: string });
        runCLI(options?: any): Promise<any>;
        extractStrings(options?: any): Promise<any>;
        syncTranslations(options?: any): Promise<any>;
    }
}
