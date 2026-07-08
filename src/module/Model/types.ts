export type ProviderType = "openai"; // | 'anthropic' | 'gemini' | 'qwenlm' | 'azure-openai'

export type ModelType = "text"; // | 'vision' | 'embedding' | 'reasoning' | 'function_calling'

/** 模型能力标识 */
export type ModelCaps = {
    vision?: boolean; // 视觉识别能力（图片理解）
    tools?: boolean; // 工具调用能力（Function Calling）
};

export type Model = {
    id: string;
    provider: string;
    name: string;
    group: string;
    types: ModelType[];
    caps?: ModelCaps;
    enabled: boolean;
    editable: boolean;
    rate?: number;
};

export type Provider = {
    id: string;
    type: ProviderType;
    logo: string | null;
    title: string;
    isSystem: boolean;
    apiUrl: string;
    websites: {
        official: string;
        docs: string;
        models: string;
    };
    data: {
        apiKey: string;
        apiHost: string;
        models: Model[];
        enabled: boolean;
    };
    runtime?: {};
};

export type ChatParam = {
    systemPrompt: string | null;
};
