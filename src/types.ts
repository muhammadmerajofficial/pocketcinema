export type CategoryType = 'movies' | 'tv' | 'anime';

export interface AdvancedSearchFilters {
  category: 'all' | CategoryType;
  country: string; // Country code e.g. 'US', 'IN', 'JP', 'KR', 'GB', 'BD', or ''
  year: string; // Specific year e.g. '2024' or range '2020-2025' or 'classic' or ''
  genre: string; // Genre name e.g. 'Action', 'Sci-Fi', or ''
  language: string; // Language code e.g. 'en', 'bn', 'hi', 'ja', 'ko', or ''
}

export interface MediaItem {
  id: string;
  title: string;
  category: CategoryType;
  year: number;
  releaseDate: string;
  poster: string;
  backdrop: string;
  rating: number; // e.g., 8.9
  genres: string[];
  durationOrEpisodes: string; // e.g. "2h 49m" or "4 Seasons (37 Eps)"
  directorOrStudio: string;
  synopsis: string;
  tagline?: string;
  ageRating: string; // "PG-13", "TV-MA", "16+"
  cast?: string[];
  timelineEra: string; // e.g., "2024 - 2025 (Latest Releases)", "2020 - 2023 (Modern Era)", "2010 - 2019 (Golden Blockbusters)", "Classic Masterpieces"
  originalLanguage?: string;
  originCountry?: string[];
}

export type RemoteButtonType = 'up' | 'down' | 'prev' | 'next' | 'ok';

export interface RemoteFeedback {
  action: string;
  timestamp: number;
}

export interface PersonItem {
  id: number;
  name: string;
  knownForDepartment: string;
  roleTitle: string;
  profilePath: string;
  popularity: number;
  knownForTitles: string[];
  gender?: number;
  biography?: string;
}
