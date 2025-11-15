import { LingoDotDevEngine } from "lingo.dev";

const apiKey = process.env.LINGO_API_KEY;

if (!apiKey) {
    throw new Error("⚠️ LINGO_API_KEY not set in .env");
}

export const lingoClient = new LingoDotDevEngine({
    apiKey
});
