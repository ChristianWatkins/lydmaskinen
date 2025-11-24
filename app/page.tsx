'use client';

import { useState, useEffect } from 'react';
import { PadData, Mode } from '@/types';
import Pad from '@/components/Pad';
import { playAudio, saveToStorage, loadFromStorage, initializeAudioContext } from '@/lib/audio';

export default function Home() {
  const [mode, setMode] = useState<Mode>('play');
  const [pads, setPads] = useState<PadData[]>(() => {
    // Initialize 6 pads
    return Array.from({ length: 6 }, (_, i) => ({
      id: `pad-${i}`,
      effect: 'none' as const,
      reverse: false,
    }));
  });
  const [recordingPadId, setRecordingPadId] = useState<string | null>(null);
  const [playingPadId, setPlayingPadId] = useState<string | null>(null);

  // No pre-initialization needed - AudioContext will be initialized on first use

  // Load from localStorage on mount
  useEffect(() => {
    const stored = loadFromStorage();
    if (stored.length > 0) {
      setPads(prevPads => {
        return prevPads.map((pad, index) => {
          const storedPad = stored[index];
          if (storedPad && storedPad.audioUrl) {
            // Convert URL back to blob if needed
            return {
              ...pad,
              ...storedPad,
            };
          }
          return pad;
        });
      });
    }
  }, []);

  // Save to localStorage whenever pads change
  useEffect(() => {
    const saveData = async () => {
      await saveToStorage(pads);
    };
    saveData();
  }, [pads]);

  const handleRecordStart = (padId: string) => {
    setRecordingPadId(padId);
  };

  const handleRecord = async (padId: string, blob: Blob) => {
    const audioUrl = URL.createObjectURL(blob);
    setPads(prevPads =>
      prevPads.map(pad =>
        pad.id === padId
          ? { ...pad, audioBlob: blob, audioUrl }
          : pad
      )
    );
    setRecordingPadId(null);
  };

  const handlePlay = async (padId: string) => {
    console.log('handlePlay called for pad:', padId);
    const pad = pads.find(p => p.id === padId);
    
    if (!pad) {
      console.warn('Pad not found:', padId);
      return;
    }
    
    if (!pad.audioBlob) {
      console.warn('No audio recorded for pad:', padId);
      return;
    }
    
    console.log('Playing pad with audio blob size:', pad.audioBlob.size);

    // Initialize audio context on first interaction
    try {
      await initializeAudioContext();
      console.log('AudioContext initialized for playback');
    } catch (error) {
      console.error('Failed to initialize AudioContext:', error);
      return;
    }

    setPlayingPadId(padId);
    try {
      await playAudio(pad);
      console.log('Playback completed successfully');
    } catch (error) {
      console.error('Playback error:', error);
    } finally {
      setPlayingPadId(null);
    }
  };

  const handleSaveEdit = (padId: string, updates: Partial<PadData>) => {
    setPads(prevPads =>
      prevPads.map(pad =>
        pad.id === padId ? { ...pad, ...updates } : pad
      )
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-100 to-orange-100 p-4">
      <div className="max-w-md mx-auto">
        {/* Mode Toggle */}
        <div className="mb-6 bg-white/80 backdrop-blur-sm rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-gray-700 font-semibold text-lg">Opptak</span>
              <button
                onClick={async () => {
                  // Always initialize AudioContext when toggling modes
                  await initializeAudioContext();
                  // Toggle between record and play (not edit)
                  if (mode === 'record') {
                    setMode('play');
                  } else {
                    setMode('record');
                  }
                }}
                className={`
                  relative inline-flex h-8 w-14 items-center rounded-full transition-colors duration-200 ease-in-out cursor-pointer
                  ${mode === 'record' ? 'bg-red-500' : 'bg-gray-300'}
                  focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500
                `}
              >
                <span
                  className={`
                    inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition-transform duration-200 ease-in-out
                    ${mode === 'record' ? 'translate-x-7' : 'translate-x-1'}
                  `}
                />
              </button>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-gray-700 font-semibold text-lg">Rediger</span>
              <button
                onClick={async () => {
                  // Always initialize AudioContext when toggling modes
                  await initializeAudioContext();
                  setMode(mode === 'edit' ? 'play' : 'edit');
                }}
                className={`
                  relative inline-flex h-8 w-14 items-center rounded-full transition-colors duration-200 ease-in-out cursor-pointer
                  ${mode === 'edit' ? 'bg-purple-500' : 'bg-gray-300'}
                  focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500
                `}
              >
                <span
                  className={`
                    inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition-transform duration-200 ease-in-out
                    ${mode === 'edit' ? 'translate-x-7' : 'translate-x-1'}
                  `}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Pad Grid */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {pads.map((pad) => (
            <Pad
              key={pad.id}
              padData={pad}
              mode={mode}
              onRecordStart={handleRecordStart}
              onRecord={handleRecord}
              onPlay={handlePlay}
              onSaveEdit={handleSaveEdit}
              isRecording={recordingPadId === pad.id}
              isPlaying={playingPadId === pad.id}
            />
          ))}
        </div>

      </div>

    </div>
  );
}
