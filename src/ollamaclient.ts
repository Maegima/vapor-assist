import { OllamaChatRequest, OllamaChatResponse, OllamaGenerateRequest, OllamaGenerateResponse } from './types';
import { ConfigManager } from './configmanager';

export class OllamaClient {
    constructor(private readonly config: ConfigManager) {}

    public async generate(message: string): Promise<string> {
        if (!this.config.endpoint) return 'No endpoint configured.';

        const payload: OllamaGenerateRequest = {
            model: this.config.model || '',
            prompt: message,
            stream: false
        };

        try {
            const response = await fetch(this.config.endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json() as OllamaGenerateResponse;
            return data.response ?? 'No response returned by Ollama.';
        } catch (err) {
            return 'Error contacting Ollama Generate API: ' + err;
        }
    }

    public async chat(message: string): Promise<string> {
        if (!this.config.endpoint) return 'No endpoint configured.';

        const payload: OllamaChatRequest = {
            model: this.config.model ?? '',
            messages: [{ role: 'user', content: message }],
            stream: false
        };

        try {
            const response = await fetch(this.config.endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json() as OllamaChatResponse;
            return data.message?.content ?? 'No message returned by Ollama Chat.';
        } catch (err) {
            return 'Error contacting Ollama Chat API: ' + err;
        }
    }
}