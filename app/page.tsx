'use client';

import { useState, useEffect } from 'react';
import { PadData } from '@/types';
import Pad from '@/components/Pad';
import { playAudio, saveToStorage, loadFromStorage, blobToBase64, base64ToBlob } from '@/lib/audio';
import { Save, FolderOpen, RotateCcw } from 'lucide-react';

export default function Home() {
  const [pads, setPads] = useState<PadData[]>(() => {
    // Initialize 6 pads
    return Array.from({ length: 6 }, (_, i) => ({
      id: `pad-${i}`,
      effect: 'none' as const,
      reverse: false,
      volume: 10,
      reverb: false,
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

  const handleSaveSet = async () => {
    const setName = prompt('Enter a name for this set:');
    if (!setName) return;
    
    // Convert pads to storage format (with base64 audio)
    const padsToSave = await Promise.all(
      pads.map(async (pad) => {
        let audioBase64: string | undefined;
        if (pad.audioBlob) {
          audioBase64 = await blobToBase64(pad.audioBlob);
        }
        
        return {
          id: pad.id,
          audioBase64,
          effect: pad.effect,
          reverse: pad.reverse,
          volume: pad.volume !== undefined ? pad.volume : 10,
          reverb: pad.reverb !== undefined ? pad.reverb : false,
          reverbTime: pad.reverbTime,
          reverbDecay: pad.reverbDecay,
          reverbMix: pad.reverbMix,
        };
      })
    );
    
    const setData = {
      name: setName,
      pads: padsToSave,
      timestamp: new Date().toISOString(),
    };
    
    const savedSets = JSON.parse(localStorage.getItem('mpc-saved-sets') || '[]');
    // Remove existing set with same name if it exists
    const filteredSets = savedSets.filter((s: any) => s.name !== setName);
    filteredSets.push(setData);
    localStorage.setItem('mpc-saved-sets', JSON.stringify(filteredSets));
    
    alert(`Set "${setName}" saved!`);
  };

  const handleLoadSet = () => {
    const savedSets = JSON.parse(localStorage.getItem('mpc-saved-sets') || '[]');
    
    if (savedSets.length === 0) {
      alert('No saved sets found!');
      return;
    }
    
    const setName = prompt(`Enter set name to load (Available: ${savedSets.map((s: any) => s.name).join(', ')}):`);
    if (!setName) return;
    
    const setToLoad = savedSets.find((s: any) => s.name === setName);
    if (!setToLoad) {
      alert(`Set "${setName}" not found!`);
      return;
    }
    
    if (confirm(`Load set "${setName}"? This will replace your current pads.`)) {
      // Restore pads from saved format (convert base64 back to blob)
      const restoredPads = setToLoad.pads.map((savedPad: any) => {
        let audioBlob: Blob | undefined;
        let audioUrl: string | undefined;
        
        if (savedPad.audioBase64) {
          audioBlob = base64ToBlob(savedPad.audioBase64);
          audioUrl = URL.createObjectURL(audioBlob);
        }
        
        return {
          id: savedPad.id,
          audioBlob,
          audioUrl,
          effect: savedPad.effect || 'none',
          reverse: savedPad.reverse || false,
          volume: savedPad.volume !== undefined ? savedPad.volume : 10,
          reverb: savedPad.reverb !== undefined ? savedPad.reverb : false,
          reverbTime: savedPad.reverbTime,
          reverbDecay: savedPad.reverbDecay,
          reverbMix: savedPad.reverbMix,
        };
      });
      
      setPads(restoredPads);
      alert(`Set "${setName}" loaded!`);
    }
  };

  const handleReset = () => {
    if (confirm('Reset all pads? This will clear all audio and settings.')) {
      const resetPads = Array.from({ length: 6 }, (_, i) => ({
        id: `pad-${i}`,
        effect: 'none' as const,
        reverse: false,
        volume: 10,
        reverb: false,
      }));
      setPads(resetPads);
      localStorage.removeItem('mpc-pads');
      alert('All pads reset!');
    }
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

        {/* Control buttons - Bottom */}
        <div className="flex justify-center gap-4 mt-6">
          {/* Save Set */}
          <button
            onClick={handleSaveSet}
            className="flex flex-col items-center gap-1 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg shadow-lg transition-all active:scale-95"
          >
            <Save size={24} strokeWidth={2} />
            <span className="text-xs font-semibold">Save</span>
          </button>

          {/* Load Set */}
          <button
            onClick={handleLoadSet}
            className="flex flex-col items-center gap-1 px-4 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg shadow-lg transition-all active:scale-95"
          >
            <FolderOpen size={24} strokeWidth={2} />
            <span className="text-xs font-semibold">Load</span>
          </button>

          {/* Reset */}
          <button
            onClick={handleReset}
            className="flex flex-col items-center gap-1 px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg shadow-lg transition-all active:scale-95"
          >
            <RotateCcw size={24} strokeWidth={2} />
            <span className="text-xs font-semibold">Reset</span>
          </button>
        </div>

      </div>

    </div>
  );
}
