'use client';

import { PadData } from '@/types';
import { useState, useEffect, useRef } from 'react';
import { Undo2, ArrowRight, Scissors } from 'lucide-react';

interface PadProps {
  padData: PadData;
  onRecordStart: (padId: string) => void;
  onRecord: (padId: string, blob: Blob) => void;
  onPlay: (padId: string) => void;
  onSaveEdit: (padId: string, updates: Partial<PadData>) => void;
  onEditorOpen?: (padId: string) => void;
  isRecording: boolean;
  isPlaying: boolean;
}

export default function Pad({
  padData,
  onRecordStart,
  onRecord,
  onPlay,
  onSaveEdit,
  onEditorOpen,
  isRecording,
  isPlaying,
}: PadProps) {
  const [isPressed, setIsPressed] = useState(false);
  const [isRecordingStarted, setIsRecordingStarted] = useState(false);
  const [neutralState, setNeutralState] = useState<'from-baby' | 'from-troll'>('from-baby');
  const padRef = useRef<HTMLDivElement>(null);

  // Sync neutralState when effect changes externally
  useEffect(() => {
    if (padData.effect === 'smurf') {
      setNeutralState('from-baby');
    } else if (padData.effect === 'troll') {
      setNeutralState('from-troll');
    }
  }, [padData.effect]);

  const handleStart = async (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsPressed(true);
    console.log('👆 handleStart called, padId:', padData.id);
  };

  const handleRecordStart = async (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Don't trigger pad play
    
    console.log('🎙 Starting recording for pad:', padData.id);
      onRecordStart(padData.id);
      const { startRecording } = await import('@/lib/audio');
      const started = await startRecording();
      setIsRecordingStarted(started);
      console.log('Recording started:', started);
  };

  const handleRecordEnd = async (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Don't trigger pad play
    
    if (isRecordingStarted) {
      // Stop recording and save
      const { stopRecording } = await import('@/lib/audio');
      try {
        const blob = await stopRecording();
        if (blob) {
          onRecord(padData.id, blob);
        }
      } catch (error) {
        console.error('Recording error:', error);
      }
    }
    
    setIsRecordingStarted(false);
  };

  const handleEnd = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    
    // Play audio if available
    if (padData.audioBlob || padData.audioUrl) {
      console.log('🎵 Playing audio for pad:', padData.id);
      onPlay(padData.id);
    }

    setIsPressed(false);
  };

  const handleDirectionToggle = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onSaveEdit(padData.id, { reverse: !padData.reverse });
  };

  const handleEffectCycle = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Cycle with two neutrals hack: neutral1 → baby → neutral2 → troll → neutral1
    const currentEffect = padData.effect || 'none';
    let newEffect: PadData['effect'];
    let newNeutralState: 'from-baby' | 'from-troll' = neutralState;
    
    if (currentEffect === 'smurf') {
      // baby → neutral (neutral2, from baby)
      newEffect = 'none';
      newNeutralState = 'from-baby';
    } else if (currentEffect === 'none') {
      // neutral → depends on which neutral we're in
      if (neutralState === 'from-baby') {
        // neutral (from baby) → troll
        newEffect = 'troll';
        newNeutralState = 'from-troll';
      } else {
        // neutral (from troll) → baby
        newEffect = 'smurf';
        newNeutralState = 'from-baby';
      }
    } else if (currentEffect === 'troll') {
      // troll → neutral (neutral1, from troll)
      newEffect = 'none';
      newNeutralState = 'from-troll';
    } else {
      // Fallback
      newEffect = 'troll';
    }
    
    setNeutralState(newNeutralState);
    console.log('Effect cycle:', currentEffect, '→', newEffect, '(neutral state:', newNeutralState, ')');
    onSaveEdit(padData.id, { effect: newEffect });
  };


  const hasAudio = !!padData.audioBlob || !!padData.audioUrl;
  const padState = isRecording ? 'recording' : isPlaying ? 'playing' : hasAudio ? 'has-audio' : 'empty';

  // Color palette for pads
  const padColors: Record<string, { bg: string; border: string; hover: string }> = {
    'pad-0': { bg: 'bg-pink-400', border: 'border-pink-500', hover: 'hover:bg-pink-500' },
    'pad-1': { bg: 'bg-blue-400', border: 'border-blue-500', hover: 'hover:bg-blue-500' },
    'pad-2': { bg: 'bg-yellow-400', border: 'border-yellow-500', hover: 'hover:bg-yellow-500' },
    'pad-3': { bg: 'bg-green-400', border: 'border-green-500', hover: 'hover:bg-green-500' },
    'pad-4': { bg: 'bg-orange-400', border: 'border-orange-500', hover: 'hover:bg-orange-500' },
    'pad-5': { bg: 'bg-purple-400', border: 'border-purple-500', hover: 'hover:bg-purple-500' },
  };

  const colors = padColors[padData.id] || { bg: 'bg-gray-400', border: 'border-gray-500', hover: 'hover:bg-gray-500' };

  return (
    <div className="aspect-square w-full">
      <div className="relative w-full h-full">
        {/* Main Pad */}
        <div
          ref={padRef}
          className={`
            relative w-full h-full rounded-2xl border-4 transition-all duration-150
            ${padState === 'recording' ? 'bg-red-500 border-red-600 scale-95 shadow-lg shadow-red-500/50' : ''}
            ${padState === 'playing' ? 'bg-green-400 border-green-500 scale-95 shadow-lg shadow-green-500/50' : ''}
            ${padState === 'has-audio' ? `${colors.bg} ${colors.border} ${colors.hover} active:scale-95` : ''}
            ${padState === 'empty' ? `${colors.bg} ${colors.border} ${colors.hover} opacity-60 active:scale-95` : ''}
            ${isPressed ? 'scale-90' : ''}
            touch-none select-none
          `}
        >
          {/* Record button - Top right */}
          <button
            className={`
              absolute top-2 right-2 w-10 h-10 rounded-full z-20
              ${isRecording ? 'bg-red-600 animate-pulse' : 'bg-red-500 hover:bg-red-600'}
              shadow-lg transition-all active:scale-90
            `}
            onMouseDown={handleRecordStart}
            onMouseUp={handleRecordEnd}
            onMouseLeave={handleRecordEnd}
            onTouchStart={handleRecordStart}
            onTouchEnd={handleRecordEnd}
          >
            <div className="w-full h-full flex items-center justify-center text-white text-sm font-bold">
              ●
            </div>
          </button>

          {/* Direction toggle button - Middle right */}
          <button
            className="absolute top-1/2 -translate-y-1/2 right-2 w-10 h-10 rounded-full z-20 bg-black/20 hover:bg-black/30 backdrop-blur-sm shadow transition-all active:scale-90 flex items-center justify-center"
            onClick={handleDirectionToggle}
            onTouchEnd={handleDirectionToggle}
          >
            {padData.reverse ? (
              <Undo2 size={20} className="text-white" strokeWidth={2.5} />
            ) : (
              <ArrowRight size={20} className="text-white" strokeWidth={2.5} />
            )}
          </button>

          {/* Effect toggle button - Bottom right */}
          <button
            className="absolute bottom-2 right-2 w-10 h-10 rounded-full z-20 bg-black/20 hover:bg-black/30 backdrop-blur-sm shadow transition-all active:scale-90 flex items-center justify-center"
            onClick={handleEffectCycle}
            onTouchEnd={handleEffectCycle}
          >
            {padData.effect === 'none' && (
              <span className="text-white text-sm font-bold">—</span>
            )}
            {padData.effect === 'smurf' && (
              <span className="text-xl">👶</span>
            )}
            {padData.effect === 'troll' && (
              <span className="text-xl">👹</span>
            )}
          </button>

          {/* Trim button - Bottom left (only show if audio exists) */}
          {hasAudio && onEditorOpen && (
            <button
              className="absolute bottom-2 left-2 w-10 h-10 rounded-full z-20 bg-black/20 hover:bg-black/30 backdrop-blur-sm shadow transition-all active:scale-90 flex items-center justify-center"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onEditorOpen(padData.id);
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onEditorOpen(padData.id);
              }}
            >
              <Scissors size={18} className="text-white" strokeWidth={2.5} />
            </button>
          )}

          {/* Main pad area for playback */}
          <button
            className="w-full h-full rounded-2xl"
            onMouseDown={handleStart}
            onMouseUp={handleEnd}
            onMouseLeave={handleEnd}
            onTouchStart={handleStart}
            onTouchEnd={handleEnd}
          >
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              {padState === 'recording' && (
                <>
                  <div className="text-white text-3xl font-bold animate-pulse mb-2">●</div>
                  <div className="text-white text-xs font-semibold">HOLD INNE</div>
                </>
              )}
              {padState === 'empty' && (
                <div className="text-center">
                  <div className="text-gray-700 text-xs font-medium mb-1">Tom</div>
                  <div className="text-gray-600 text-xs">Hold rød knapp</div>
                </div>
              )}
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

