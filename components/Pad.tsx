'use client';

import { PadData } from '@/types';
import { useState, useEffect, useRef } from 'react';
import { RotateCcw, Play, Waves } from 'lucide-react';

interface PadProps {
  padData: PadData;
  onRecordStart: (padId: string) => void;
  onRecord: (padId: string, blob: Blob) => void;
  onPlay: (padId: string) => void;
  onSaveEdit: (padId: string, updates: Partial<PadData>) => void;
  isRecording: boolean;
  isPlaying: boolean;
}

export default function Pad({
  padData,
  onRecordStart,
  onRecord,
  onPlay,
  onSaveEdit,
  isRecording,
  isPlaying,
}: PadProps) {
  const [isPressed, setIsPressed] = useState(false);
  const [isRecordingStarted, setIsRecordingStarted] = useState(false);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [showVolumeIndicator, setShowVolumeIndicator] = useState(false);
  const [currentVolume, setCurrentVolume] = useState<number>(padData.volume !== undefined ? padData.volume : 10);
  const [startVolume, setStartVolume] = useState<number>(padData.volume !== undefined ? padData.volume : 10);
  const [neutralState, setNeutralState] = useState<'from-baby' | 'from-troll'>('from-baby');
  const padRef = useRef<HTMLDivElement>(null);

  // Sync currentVolume with padData.volume
  useEffect(() => {
    setCurrentVolume(padData.volume !== undefined ? padData.volume : 10);
  }, [padData.volume]);

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

    // Track touch start position
    const startY = ('touches' in e && e.touches.length > 0) 
      ? e.touches[0].clientY 
      : ('clientY' in e ? e.clientY : null);
    
    if (startY !== null) {
      setTouchStartY(startY);
      const initialVolume = padData.volume !== undefined ? padData.volume : 10;
      setCurrentVolume(initialVolume);
      setStartVolume(initialVolume);
    }

    console.log('👆 handleStart called, padId:', padData.id);
    
    // Don't play immediately - wait to see if it's a volume gesture
    // Play will happen in handleEnd if no volume change detected
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (touchStartY === null || !padRef.current) return;
    
    e.preventDefault();
    
    const currentY = ('touches' in e && e.touches.length > 0)
      ? e.touches[0].clientY
      : ('clientY' in e ? e.clientY : null);
    
    if (currentY === null) return;

    // Get pad's bounding rectangle
    const padRect = padRef.current.getBoundingClientRect();
    const padTop = padRect.top;
    const padBottom = padRect.bottom;
    const padHeight = padBottom - padTop;

    // Calculate volume based on Y position relative to pad
    // Top of pad = 10, bottom = 0
    const relativeY = currentY - padTop; // 0 at top, padHeight at bottom
    const volumeRatio = 1 - (relativeY / padHeight); // 1 at top, 0 at bottom
    const newVolume = Math.max(0, Math.min(10, Math.round(volumeRatio * 10)));
    
    // Only update if volume actually changed
    if (newVolume !== currentVolume) {
      setCurrentVolume(newVolume);
      onSaveEdit(padData.id, { volume: newVolume });
      setShowVolumeIndicator(true);
    }
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
    
    // Check if volume changed (was a volume gesture)
    const volumeChanged = Math.abs(currentVolume - startVolume) > 0.1;
    
    // Hide volume indicator after a brief delay
    if (volumeChanged) {
      setTimeout(() => setShowVolumeIndicator(false), 1000);
    } else {
      setShowVolumeIndicator(false);
    }

    // Only play audio if volume didn't change (wasn't a volume gesture)
    if (!volumeChanged && (padData.audioBlob || padData.audioUrl)) {
      console.log('🎵 Playing audio for pad:', padData.id);
      onPlay(padData.id);
    }

    setIsPressed(false);
    setTouchStartY(null);
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

  const handleReverbToggle = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onSaveEdit(padData.id, { reverb: !padData.reverb });
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
              <RotateCcw size={20} className="text-white" strokeWidth={2.5} />
            ) : (
              <Play size={20} className="text-white" strokeWidth={2.5} />
            )}
          </button>

          {/* Reverb toggle button - Bottom left */}
          <button
            className={`absolute bottom-2 left-2 w-10 h-10 rounded-full z-20 backdrop-blur-sm shadow transition-all active:scale-90 flex items-center justify-center ${
              padData.reverb 
                ? 'bg-purple-500/80 hover:bg-purple-600/80' 
                : 'bg-black/20 hover:bg-black/30'
            }`}
            onClick={handleReverbToggle}
            onTouchEnd={handleReverbToggle}
          >
            <Waves 
              size={18} 
              className={padData.reverb ? 'text-white' : 'text-white/60'} 
              strokeWidth={padData.reverb ? 2.5 : 2}
            />
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

          {/* Main pad area for playback */}
          <button
            className="w-full h-full rounded-2xl"
            onMouseDown={handleStart}
            onMouseMove={handleMove}
            onMouseUp={handleEnd}
            onMouseLeave={handleEnd}
            onTouchStart={handleStart}
            onTouchMove={handleMove}
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
              
              {/* Volume indicator - shows during gesture, left side */}
              {showVolumeIndicator && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm rounded-2xl flex items-center">
                  <div className="absolute left-2 flex items-center gap-2">
                    {/* Vertical volume bar */}
                    <div className="h-32 w-3 bg-white/20 rounded-full overflow-hidden flex flex-col-reverse">
                      <div 
                        className="w-full bg-white rounded-full transition-all duration-100"
                        style={{ height: `${(currentVolume / 10) * 100}%` }}
                      />
                    </div>
                    {/* Volume number */}
                    <div className="text-white text-2xl font-bold">
                      {currentVolume}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

