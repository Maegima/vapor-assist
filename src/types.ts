export interface OllamaChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export interface OllamaChatRequest {
    model: string;
    messages: OllamaChatMessage[];
    stream?: boolean;
}

export interface OllamaChatResponse {
    model: string;
    created_at: string;
    message: OllamaChatMessage;
    done: boolean;
    done_reason: string;
    total_duration: number;
    load_duration: number;
    prompt_eval_count: number;
    prompt_eval_duration: number;
    eval_count: number;
    eval_duration: number;
}

export interface OllamaGenerateRequest {
    model: string;
    prompt: string;
    stream?: boolean;
}

export interface OllamaGenerateResponse {
    model: string;
    created_at: string;
    response: string;
    done: boolean;
    done_reason: string;
    total_duration: number;
    load_duration: number;
    prompt_eval_count: number;
    prompt_eval_duration: number;
    eval_count: number;
    eval_duration: number;
}