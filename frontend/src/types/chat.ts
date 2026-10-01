export type Role = "user"|"assistant"|"system";

export interface Message {
    role: Role;
    content: string;
}

export interface StreamChatParams {
    provider: string;
    model: string;
    messages: Message [];
    temperature: number;
    outChunk: (chunk_:string) => void;
    signal?: AbortSignal;
}
