'use client';

import { useState, useEffect, useRef } from 'react';
import { PadData, Sequence } from '@/types';
import Pad from '@/components/Pad';
import TrimEditor from '@/components/TrimEditor';
import { playAudio, saveToStorage, loadFromStorage, blobToBase64, base64ToBlob, playSequence, renderSequenceToAudio } from '@/lib/audio';
import { Save, FolderOpen, RotateCcw, Play, Square, Circle } from 'lucide-react';

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
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [editingPadId, setEditingPadId] = useState<string | null>(null);
  
  // Sequence recording state
  const [isRecordingSequence, setIsRecordingSequence] = useState(false);
  const [sequenceStartTime, setSequenceStartTime] = useState<number | null>(null);
  const [sequence, setSequence] = useState<Sequence | null>(null);
  const [isPlayingSequence, setIsPlayingSequence] = useState(false);
  const sequenceCleanupRef = useRef<(() => void) | null>(null);

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
    
    // If recording sequence, record this event
    if (isRecordingSequence && sequenceStartTime !== null) {
      const relativeTimestamp = performance.now() - sequenceStartTime;
      const event = {
        padId,
        timestamp: relativeTimestamp,
        padData: { ...pad }, // Snapshot of padData
      };
      
      setSequence(prev => {
        if (!prev) {
          return {
            events: [event],
            startTime: 0,
            endTime: relativeTimestamp,
          };
        }
        return {
          ...prev,
          events: [...prev.events, event],
          endTime: relativeTimestamp,
        };
      });
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
          startTime: pad.startTime,
          endTime: pad.endTime,
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
    
    setShowLoadModal(true);
  };

  const loadSetByName = (setName: string) => {
    const savedSets = JSON.parse(localStorage.getItem('mpc-saved-sets') || '[]');
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
          startTime: savedPad.startTime,
          endTime: savedPad.endTime,
        };
      });
      
      setPads(restoredPads);
      setShowLoadModal(false);
      alert(`Set "${setName}" loaded!`);
    }
  };

  const deleteSet = (setName: string) => {
    if (confirm(`Delete set "${setName}"?`)) {
      const savedSets = JSON.parse(localStorage.getItem('mpc-saved-sets') || '[]');
      const filteredSets = savedSets.filter((s: any) => s.name !== setName);
      localStorage.setItem('mpc-saved-sets', JSON.stringify(filteredSets));
      alert(`Set "${setName}" deleted!`);
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

  const handleRecordSequence = () => {
    setIsRecordingSequence(true);
    setSequenceStartTime(performance.now());
    setSequence({
      events: [],
      startTime: 0,
      endTime: 0,
    });
  };

  const handleStopSequence = () => {
    if (isRecordingSequence) {
      setIsRecordingSequence(false);
      setSequenceStartTime(null);
    }
    
    if (isPlayingSequence && sequenceCleanupRef.current) {
      sequenceCleanupRef.current();
      sequenceCleanupRef.current = null;
      setIsPlayingSequence(false);
    }
  };

  const handlePlaySequence = async () => {
    if (!sequence || sequence.events.length === 0) {
      alert('No sequence recorded!');
      return;
    }

    setIsPlayingSequence(true);
    try {
      const cleanup = await playSequence(sequence, pads);
      sequenceCleanupRef.current = cleanup;
      
      // Wait for sequence to finish (approximate)
      const duration = sequence.endTime / 1000;
      setTimeout(() => {
        setIsPlayingSequence(false);
        sequenceCleanupRef.current = null;
      }, duration * 1000 + 1000); // Add 1 second buffer for reverb tails
    } catch (error) {
      console.error('Error playing sequence:', error);
      setIsPlayingSequence(false);
      sequenceCleanupRef.current = null;
    }
  };

  const handleRenderSequence = async () => {
    if (!sequence || sequence.events.length === 0) {
      alert('No sequence recorded!');
      return;
    }

    try {
      const blob = await renderSequenceToAudio(sequence, pads);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sequence-${new Date().getTime()}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      alert('Sequence rendered and downloaded!');
    } catch (error) {
      console.error('Error rendering sequence:', error);
      alert('Error rendering sequence. Check console for details.');
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
              onEditorOpen={setEditingPadId}
              isRecording={recordingPadId === pad.id}
              isPlaying={playingPadId === pad.id}
            />
          ))}
        </div>

        {/* Sequence Status Indicator */}
        {(isRecordingSequence || isPlayingSequence) && (
          <div className="text-center mb-2">
            <span className={`text-sm font-semibold ${isRecordingSequence ? 'text-red-600' : 'text-green-600'}`}>
              {isRecordingSequence ? '● Recording sequence...' : '▶ Playing sequence...'}
            </span>
          </div>
        )}

        {/* Sequence Transport Controls */}
        <div className="flex justify-center gap-4 mt-6 mb-4">
          {/* Record Sequence */}
          <button
            onClick={handleRecordSequence}
            disabled={isRecordingSequence || isPlayingSequence}
            className={`flex flex-col items-center gap-1 px-4 py-3 rounded-lg shadow-lg transition-all active:scale-95 ${
              isRecordingSequence
                ? 'bg-red-600 text-white animate-pulse'
                : 'bg-red-500 hover:bg-red-600 text-white disabled:opacity-50 disabled:cursor-not-allowed'
            }`}
          >
            <Circle size={24} strokeWidth={2} fill={isRecordingSequence ? 'white' : 'none'} />
            <span className="text-xs font-semibold">Record</span>
          </button>

          {/* Stop */}
          <button
            onClick={handleStopSequence}
            disabled={!isRecordingSequence && !isPlayingSequence}
            className="flex flex-col items-center gap-1 px-4 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-lg shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Square size={24} strokeWidth={2} />
            <span className="text-xs font-semibold">Stop</span>
          </button>

          {/* Play Sequence */}
          <button
            onClick={handlePlaySequence}
            disabled={!sequence || sequence.events.length === 0 || isRecordingSequence || isPlayingSequence}
            className="flex flex-col items-center gap-1 px-4 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play size={24} strokeWidth={2} />
            <span className="text-xs font-semibold">Play</span>
          </button>
        </div>

        {/* Render Sequence Button */}
        {sequence && sequence.events.length > 0 && (
          <div className="flex justify-center mb-4">
            <button
              onClick={handleRenderSequence}
              disabled={isRecordingSequence || isPlayingSequence}
              className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Render Sequence ({sequence.events.length} events, {(sequence.endTime / 1000).toFixed(1)}s)
            </button>
          </div>
        )}

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

        {/* Load Set Modal */}
        {showLoadModal && (
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowLoadModal(false)}
          >
            <div 
              className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-bold mb-4">Load Set</h2>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {JSON.parse(localStorage.getItem('mpc-saved-sets') || '[]').length === 0 ? (
                  <div className="text-center py-4 text-gray-500">No saved sets found</div>
                ) : (
                  JSON.parse(localStorage.getItem('mpc-saved-sets') || '[]').map((set: any) => (
                    <div 
                      key={set.name}
                      className="flex items-center justify-between p-3 bg-gray-100 rounded-lg hover:bg-green-100 cursor-pointer transition-colors border-2 border-transparent hover:border-green-500"
                      onClick={() => loadSetByName(set.name)}
                    >
                      <div className="flex-1">
                        <div className="font-semibold text-gray-800">{set.name}</div>
                        <div className="text-xs text-gray-500">
                          {new Date(set.timestamp).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            loadSetByName(set.name);
                          }}
                          className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white text-sm rounded transition-colors"
                        >
                          Load
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteSet(set.name);
                          }}
                          className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-sm rounded transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <button
                onClick={() => setShowLoadModal(false)}
                className="mt-4 w-full px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Trim Editor Modal */}
        {editingPadId && (() => {
          const pad = pads.find(p => p.id === editingPadId);
          return pad ? (
            <TrimEditor
              padData={pad}
              onClose={() => setEditingPadId(null)}
              onSave={(updates) => {
                handleSaveEdit(editingPadId, updates);
              }}
            />
          ) : null;
        })()}

      </div>

    </div>
  );
}
