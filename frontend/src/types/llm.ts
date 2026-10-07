export interface ModelInfo {
  id: string;
  name: string;
  context_window?: number;
  description?: string;
}

export interface ProviderInfo {
  id: string;
  name: string;
  is_active: boolean;
  models: ModelInfo[];
}
