import { LingoDotDevEngine } from "lingo.dev/sdk";

export class LingoClient {
  private engine: LingoDotDevEngine;

  constructor(apiKey: string) {
    this.engine = new LingoDotDevEngine({
      apiKey: apiKey,
    });
  }

  // Test the connection / API key by doing a small translation
  async testConnection(): Promise<{ ok: boolean; error?: unknown }> {
    try {
      await this.engine.localizeText("ping", {
        sourceLocale: "en",
        targetLocale: "en",
      });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err };
    }
  }

  // Translate a single string from source to target
  async translateText(
    text: string,
    source: string,
    target: string
  ): Promise<string> {
    const result = await this.engine.localizeText(text, {
      sourceLocale: source,
      targetLocale: target,
    });
    return result;
  }

  // Translate an object (key → text) from source to target
  async translateObject(
    obj: Record<string, string>,
    source: string,
    target: string
  ): Promise<Record<string, string>> {
    const translated = await this.engine.localizeObject(obj, {
      sourceLocale: source,
      targetLocale: target,
    });
    return translated;
  }
}
