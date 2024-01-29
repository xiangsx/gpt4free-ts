export interface ApiKeyBase {
  name: string;
  models: string[];
  quota: number;
}

export interface ApiKey extends ApiKeyBase {
  created: number;
  key: string;
  id: string;
  quotaUsed: number;
}

export interface ApiKeysData {
  apiKeys: ApiKey[];
}
