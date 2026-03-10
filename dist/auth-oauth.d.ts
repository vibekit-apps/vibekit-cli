/**
 * OAuth flows for provider authentication
 *
 * Supports:
 * - Anthropic (Claude) via setup-token style flow
 * - OpenAI (Codex) via PKCE OAuth flow
 */
interface OAuthResult {
    accessToken: string;
    refreshToken?: string;
    expiresIn?: number;
    provider: 'anthropic' | 'openai';
}
export declare function loginOpenAI(): Promise<OAuthResult>;
export declare function loginAnthropic(): Promise<OAuthResult>;
export {};
