/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TMDB_API_KEY?: string;
  readonly VITE_ANILIST_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  CINEMATIC_CONFIG?: {
    TMDB_API_KEY: string;
    ANILIST_CLIENT_ID: string;
    TMDB_BASE_URL: string;
    TMDB_IMAGE_BASE: string;
    ANILIST_GRAPHQL_URL: string;
  };
}
