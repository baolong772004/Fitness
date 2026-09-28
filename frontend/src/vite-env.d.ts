/// <reference types="vite/client" />

interface ImportMetaEnv {
  // App Config
  readonly VITE_APP_NAME: string;
  readonly VITE_APP_SHORT_NAME: string;
  readonly VITE_APP_VERSION: string;
  readonly VITE_APP_ENV: 'development' | 'staging' | 'production';
  readonly VITE_APP_BASE_URL: string;

  // Center Info
  readonly VITE_CENTER_NAME: string;
  readonly VITE_CENTER_ADDRESS: string;
  readonly VITE_CENTER_HOTLINE: string;
  readonly VITE_CENTER_SUPPORT_EMAIL: string;
  readonly VITE_CENTER_OPERATING_HOURS: string;

  // API & Real-time
  readonly VITE_API_BASE_URL: string;
  readonly VITE_API_TIMEOUT_MS: string;
  readonly VITE_WS_CHECKIN_URL: string;
  readonly VITE_ENABLE_MOCK_FALLBACK: string;

  // Payment
  readonly VITE_VIETQR_BANK_ID: string;
  readonly VITE_VIETQR_ACCOUNT_NO: string;
  readonly VITE_VIETQR_ACCOUNT_NAME: string;
  readonly VITE_VIETQR_TEMPLATE: string;
  readonly VITE_MOMO_PARTNER_CODE: string;
  readonly VITE_MOMO_ACCESS_KEY: string;
  readonly VITE_MOMO_ENDPOINT: string;

  // AI Services
  readonly VITE_AI_PROVIDER: 'gemini' | 'openai' | 'mock';
  readonly VITE_GEMINI_API_KEY: string;
  readonly VITE_OPENAI_API_KEY: string;
  readonly VITE_AI_MODEL_NAME: string;

  // Features
  readonly VITE_ENABLE_AUDIO_SYNTHESIS: string;
  readonly VITE_MAKEUP_NOTICE_HOURS: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
