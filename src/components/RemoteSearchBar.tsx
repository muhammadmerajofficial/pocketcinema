import React, { useState, useEffect, useRef } from 'react';
import { Search, Mic, MicOff, X, Volume2 } from 'lucide-react';
import { soundFx } from '../utils/sound';

interface RemoteSearchBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activeCategory: string;
}

// Support browser SpeechRecognition types
interface IWindow extends Window {
  webkitSpeechRecognition?: any;
  SpeechRecognition?: any;
}

export const RemoteSearchBar: React.FC<RemoteSearchBarProps> = ({
  searchQuery,
  onSearchChange,
  activeCategory,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const win = window as unknown as IWindow;
    const SpeechClass = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (SpeechClass) {
      const recognition = new SpeechClass();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        setSpeechError(null);
      };

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join('');
        onSearchChange(transcript);
      };

      recognition.onerror = (event: any) => {
        setIsListening(false);
        if (event.error === 'not-allowed') {
          setSpeechError('Mic permission required for voice search');
        } else if (event.error !== 'no-speech') {
          setSpeechError(`Voice error: ${event.error}`);
        }
        setTimeout(() => setSpeechError(null), 4000);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore cleanup abort
        }
      }
    };
  }, [onSearchChange]);

  const toggleVoiceSearch = () => {
    soundFx.playClick('voice');
    const win = window as unknown as IWindow;
    const SpeechClass = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechClass) {
      setSpeechError('Speech recognition is not supported in this browser.');
      setTimeout(() => setSpeechError(null), 3500);
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      setSpeechError(null);
      try {
        recognitionRef.current?.start();
      } catch (e: any) {
        recognitionRef.current?.stop();
        setTimeout(() => {
          try {
            recognitionRef.current?.start();
          } catch {
            setSpeechError('Could not start microphone');
          }
        }, 100);
      }
    }
  };

  const clearSearch = () => {
    soundFx.playClick('nav');
    onSearchChange('');
  };

  const getPlaceholderText = () => {
    if (activeCategory === 'movies') return 'Search movies by title, director, genre, or release year...';
    if (activeCategory === 'tv') return 'Search TV shows by title, network, genre, or season...';
    return 'Search anime by title, studio, genre, or era...';
  };

  return (
    <div id="remote-search-section" className="w-full flex flex-col gap-1.5">
      <div className={`relative flex items-center w-full rounded-2xl bg-zinc-900/90 border transition-all duration-300 ${
        isListening
          ? 'border-red-500/80 shadow-[0_0_25px_rgba(239,68,68,0.35)] ring-2 ring-red-500/20'
          : 'border-zinc-800/80 focus-within:border-amber-500/60 focus-within:shadow-[0_0_20px_rgba(245,158,11,0.2)] focus-within:ring-2 focus-within:ring-amber-500/20'
      }`}>
        {/* Left search icon */}
        <div className="pl-4 pr-2 flex items-center justify-center text-zinc-500">
          <Search className="w-5 h-5 transition-colors" />
        </div>

        {/* Long search bar input */}
        <input
          id="remote-main-search-input"
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={getPlaceholderText()}
          className="flex-1 py-3.5 px-2 bg-transparent text-zinc-100 text-sm md:text-base placeholder:text-zinc-500 focus:outline-none tracking-wide"
        />

        {/* Clear query button */}
        {searchQuery && (
          <button
            id="clear-search-btn"
            type="button"
            onClick={clearSearch}
            className="p-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors mr-1 cursor-pointer"
            title="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Voice control button with icon */}
        <button
          id="remote-voice-control-btn"
          type="button"
          onClick={toggleVoiceSearch}
          aria-label={isListening ? 'Stop listening' : 'Start voice search'}
          className={`relative mr-2 flex items-center justify-center p-2.5 rounded-xl transition-all duration-300 cursor-pointer select-none ${
            isListening
              ? 'bg-red-500 text-white shadow-lg shadow-red-500/50 scale-105 animate-pulse'
              : 'bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700/80 border border-zinc-700/50'
          }`}
          title={isListening ? 'Listening... click to stop' : 'Voice search (Click to speak)'}
        >
          {isListening ? (
            <>
              <span className="absolute -inset-1 rounded-xl bg-red-500/30 animate-ping" />
              <Mic className="w-4 h-4 relative z-10" />
            </>
          ) : (
            <Mic className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Voice status feedback notification */}
      {isListening && (
        <div id="voice-active-indicator" className="flex items-center gap-2 px-3 py-1.5 bg-red-950/40 border border-red-800/40 rounded-xl text-xs text-red-300 animate-fadeIn">
          <span className="w-2 h-2 rounded-full bg-red-400 animate-ping" />
          <Volume2 className="w-3.5 h-3.5 text-red-400 animate-bounce" />
          <span>Listening... Speak movie, TV show or anime name clearly</span>
        </div>
      )}

      {speechError && (
        <div id="voice-error-indicator" className="flex items-center gap-2 px-3 py-1.5 bg-amber-950/40 border border-amber-800/40 rounded-xl text-xs text-amber-300 animate-fadeIn">
          <MicOff className="w-3.5 h-3.5 text-amber-400" />
          <span>{speechError}</span>
        </div>
      )}
    </div>
  );
};
