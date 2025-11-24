'use client';

import { useState, useEffect } from 'react';
import { PadData } from '@/types';
import Pad from '@/components/Pad';
import { playAudio, saveToStorage, loadFromStorage } from '@/lib/audio';

export default function Home() {
  const [pads, setPads] = useState<PadData[]>(() => {
    // Initialize 6 pads
    return Array.from({ length: 6 }, (_, i) => ({
      id: `pad-${i}`,
      effect: 'none' as const,
      reverse: false,
      volume: 1.0,
    }));
  });
  const [recordingPadId, setRecordingPadId] = useState<string | null>(null);
  const [playingPadId, setPlayingPadId] = useState<string | null>(null);

  // Request microphone permission on mount to reduce notification spam
  useEffect(() => {
    const requestMicPermission = async () => {
      try {
        // Request permission but don't actually use the stream yet
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('✓ Microphone permission granted on startup');
        // Immediately stop the stream - we just wanted the permission
        stream.getTracks().forEach(track => track.stop());
      } catch (error) {
        console.log('⚠️ Microphone permission not granted:', error);
        // This is fine - user will be prompted when they actually try to record
      }
    };
    
    requestMicPermission();
  }, []);

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

    setPlayingPadId(padId);
    try {
      // Howler.js handles audio unlocking automatically
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
        {/* Pad Grid */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {pads.map((pad) => (
            <Pad
              key={pad.id}
              padData={pad}
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
