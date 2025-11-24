'use client';

import { PadData, Mode } from '@/types';
import { useState, useEffect } from 'react';
import { RotateCcw, Play } from 'lucide-react';

interface PadProps {
  padData: PadData;
  mode: Mode;
  onRecordStart: (padId: string) => void;
  onRecord: (padId: string, blob: Blob) => void;
  onPlay: (padId: string) => void;
  onSaveEdit: (padId: string, updates: Partial<PadData>) => void;
  isRecording: boolean;
  isPlaying: boolean;
}

export default function Pad({
  padData,
  mode,
  onRecordStart,
  onRecord,
  onPlay,
  onSaveEdit,
  isRecording,
  isPlaying,
}: PadProps) {
  const [isPressed, setIsPressed] = useState(false);
  const [isRecordingStarted, setIsRecordingStarted] = useState(false);
  const [localEffect, setLocalEffect] = useState<PadData['effect']>(padData.effect);
  const [localReverse, setLocalReverse] = useState(padData.reverse);

  // Update local state when padData changes
  useEffect(() => {
    setLocalEffect(padData.effect);
    setLocalReverse(padData.reverse);
  }, [padData.effect, padData.reverse]);

  const handleStart = async (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsPressed(true);

    console.log('handleStart called, mode:', mode);
    
    if (mode === 'record') {
      // Start recording - don't play audio
      console.log('Starting recording for pad:', padData.id);
      onRecordStart(padData.id);
      const { startRecording } = await import('@/lib/audio');
      const started = await startRecording();
      setIsRecordingStarted(started);
    } else if (mode === 'play') {
      // Play audio - only in play mode
      console.log('Playing audio for pad:', padData.id);
      onPlay(padData.id);
    }
    // Edit mode is handled by handleClick
  };

  const handleEnd = async (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    
    if (mode === 'record' && isPressed && isRecordingStarted) {
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
    
    setIsPressed(false);
    setIsRecordingStarted(false);
  };

  const handleEffectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newEffect = e.target.value as PadData['effect'];
    setLocalEffect(newEffect);
    onSaveEdit(padData.id, { effect: newEffect });
  };

  const handleReverseToggle = (reverse: boolean) => {
    setLocalReverse(reverse);
    onSaveEdit(padData.id, { reverse });
  };

  const hasAudio = !!padData.audioBlob || !!padData.audioUrl;
  const padState = isRecording ? 'recording' : isPlaying ? 'playing' : hasAudio ? 'has-audio' : 'empty';
  const isFlipped = mode === 'edit';

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
    <div className="aspect-square w-full" style={{ perspective: '1000px' }}>
      <div
        className="relative w-full h-full transition-transform duration-600 ease-in-out"
        style={{
          transformStyle: 'preserve-3d',
          transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
      >
        {/* Front side - Pad */}
        <div
          className={`
            absolute inset-0 w-full h-full backface-hidden rounded-2xl border-4 transition-all duration-150
            ${padState === 'recording' ? 'bg-red-500 border-red-600 scale-95 shadow-lg shadow-red-500/50' : ''}
            ${padState === 'playing' ? 'bg-green-400 border-green-500 scale-95 shadow-lg shadow-green-500/50' : ''}
            ${padState === 'has-audio' ? `${colors.bg} ${colors.border} ${colors.hover} active:scale-95` : ''}
            ${padState === 'empty' ? `${colors.bg} ${colors.border} ${colors.hover} opacity-60 active:scale-95` : ''}
            ${isPressed ? 'scale-90' : ''}
            touch-none select-none
          `}
          style={{ backfaceVisibility: 'hidden' }}
        >
          <button
            className="w-full h-full"
            onMouseDown={mode !== 'edit' ? handleStart : undefined}
            onMouseUp={mode !== 'edit' ? handleEnd : undefined}
            onMouseLeave={mode !== 'edit' ? handleEnd : undefined}
            onTouchStart={mode !== 'edit' ? handleStart : undefined}
            onTouchEnd={mode !== 'edit' ? handleEnd : undefined}
            disabled={mode === 'edit'}
          >
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {padState === 'recording' && (
                <>
                  <div className="text-white text-3xl font-bold animate-pulse mb-2">●</div>
                  <div className="text-white text-xs font-semibold">HOLD INNE</div>
                </>
              )}
              {padState === 'empty' && mode === 'record' && (
                <div className="text-center">
                  <div className="text-gray-400 text-xs font-medium mb-1">Tom</div>
                  <div className="text-gray-300 text-xs">Hold inne</div>
                </div>
              )}
              {padState === 'empty' && mode !== 'record' && (
                <div className="text-gray-400 text-sm font-medium">Tom</div>
              )}
            </div>

            {/* Settings indicators - same layout as back side, but without grid */}
            {padState !== 'recording' && (
              <>
                {/* Upper left: Reverse - matches back side position */}
                {padData.reverse && (
                  <div className="absolute top-0 left-0 w-1/2 h-1/2 flex items-center justify-center pointer-events-none">
                    <RotateCcw size={32} className="text-gray-900 opacity-80" strokeWidth={2.5} />
                  </div>
                )}
                
                {/* Upper right: Forward - matches back side position */}
                {!padData.reverse && (
                  <div className="absolute top-0 right-0 w-1/2 h-1/2 flex items-center justify-center pointer-events-none">
                    <Play size={32} className="text-gray-900 opacity-80" strokeWidth={2.5} />
                  </div>
                )}
                
                {/* Lower left: Troll - matches back side position */}
                {padData.effect === 'troll' && (
                  <div className="absolute bottom-0 left-0 w-1/2 h-1/2 flex items-center justify-center pointer-events-none">
                    <span className="text-4xl opacity-80">👹</span>
                  </div>
                )}
                
                {/* Lower right: Smurfe - matches back side position */}
                {padData.effect === 'smurf' && (
                  <div className="absolute bottom-0 right-0 w-1/2 h-1/2 flex items-center justify-center pointer-events-none">
                    <span className="text-4xl opacity-80">👶</span>
                  </div>
                )}
              </>
            )}
          </button>
        </div>

        {/* Back side - Edit settings */}
        <div
          className={`
            absolute inset-0 w-full h-full backface-hidden rounded-2xl border-4 bg-white border-purple-300
            grid grid-cols-2 gap-0
          `}
          style={{ 
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
          }}
        >
          {/* Øvre venstre: Revers */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleReverseToggle(true);
            }}
            className={`
              flex items-center justify-center border-r-2 border-b-2 border-gray-200 transition-all
              ${localReverse 
                ? 'bg-purple-500 text-white' 
                : 'bg-gray-50 text-gray-600 active:bg-gray-100'
              }
            `}
          >
            <RotateCcw size={32} strokeWidth={2.5} />
          </button>

          {/* Øvre høyre: Forover */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleReverseToggle(false);
            }}
            className={`
              flex items-center justify-center border-b-2 border-gray-200 transition-all
              ${!localReverse 
                ? 'bg-purple-500 text-white' 
                : 'bg-gray-50 text-gray-600 active:bg-gray-100'
              }
            `}
          >
            <Play size={32} strokeWidth={2.5} />
          </button>

          {/* Nedre venstre: Troll */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleEffectChange({ target: { value: 'troll' } } as React.ChangeEvent<HTMLSelectElement>);
            }}
            className={`
              flex items-center justify-center border-r-2 border-gray-200 transition-all
              ${localEffect === 'troll'
                ? 'bg-purple-500 text-white' 
                : 'bg-gray-50 text-gray-600 active:bg-gray-100'
              }
            `}
          >
            <span className="text-3xl">👹</span>
          </button>

          {/* Nedre høyre: Smurfe */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleEffectChange({ target: { value: 'smurf' } } as React.ChangeEvent<HTMLSelectElement>);
            }}
            className={`
              flex items-center justify-center transition-all
              ${localEffect === 'smurf'
                ? 'bg-purple-500 text-white' 
                : 'bg-gray-50 text-gray-600 active:bg-gray-100'
              }
            `}
          >
            <span className="text-3xl">👶</span>
          </button>
        </div>
      </div>
    </div>
  );
}

