'use client';

import { useEffect, useRef, useState } from 'react';

interface Pad {
  id: string;
  label: string;
  hasAudio: boolean;
  audioBlob?: Blob;
}

export default function Home() {
  const [pads, setPads] = useState<Pad[]>([]);
  const [recording, setRecording] = useState<string | null>(null);
  const [audioContextReady, setAudioContextReady] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Initialize AudioContext on first user interaction
  const initializeAudioContext = async () => {
    if (audioContextReady) return;
    
    console.log('Initializing AudioContext...');
    
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
        console.log('New AudioContext created. State:', audioContextRef.current.state);
      }
      
      if (audioContextRef.current.state === 'suspended') {
        console.log('AudioContext suspended, resuming...');
        await audioContextRef.current.resume();
        console.log('AudioContext resumed. State:', audioContextRef.current.state);
      }
      
      setAudioContextReady(true);
      console.log('AudioContext ready for playback');
    } catch (error) {
      console.error('Failed to initialize AudioContext:', error);
    }
  };

  useEffect(() => {
    // Initialize 16 pads
    const initialPads: Pad[] = Array.from({ length: 16 }, (_, i) => ({
      id: `pad-${i}`,
      label: `PAD ${i + 1}`,
      hasAudio: false,
    }));
    setPads(initialPads);

    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const handleStart = async (mode: 'play' | 'record', padId: string) => {
    console.log('handleStart called, mode:', mode, 'padId:', padId);
    
    // Always initialize AudioContext on first interaction
    await initializeAudioContext();

    if (mode === 'play') {
      await handlePlay(padId);
    } else if (mode === 'record') {
      await handleRecord(padId);
    }
  };

  const handlePlay = async (padId: string) => {
    console.log('handlePlay called for pad:', padId);
    const pad = pads.find((p) => p.id === padId);
    
    if (!pad) {
      console.log('Pad not found:', padId);
      return;
    }

    console.log('Attempting to play audio for pad:', padId, 'hasAudio:', pad.hasAudio);

    if (!pad.hasAudio || !pad.audioBlob) {
      console.log('No audio data for pad:', padId);
      return;
    }

    if (!audioContextRef.current) {
      console.error('AudioContext not initialized');
      return;
    }

    try {
      console.log('Playing pad with audio blob size:', pad.audioBlob.size);

      // Ensure AudioContext is running
      if (audioContextRef.current.state === 'suspended') {
        console.log('AudioContext suspended, resuming...');
        await audioContextRef.current.resume();
      }

      console.log('AudioContext state in playAudio:', audioContextRef.current.state);

      const arrayBuffer = await pad.audioBlob.arrayBuffer();
      console.log('ArrayBuffer size:', arrayBuffer.byteLength, 'bytes');

      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
      console.log('AudioBuffer decoded - length:', audioBuffer.length, 'samples, duration:', audioBuffer.duration, 'seconds');

      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);

      console.log('Audio source created and connected, starting playback...');
      console.log('AudioContext state before start:', audioContextRef.current.state);

      source.start(0);
      console.log('Audio playback started successfully');

      source.onended = () => {
        console.log('Audio playback ended');
      };
    } catch (error) {
      console.error('Error playing audio:', error);
    }
  };

  const handleRecord = async (padId: string) => {
    console.log('handleRecord called for pad:', padId);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('Microphone access granted');

      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        console.log('Audio data available, size:', event.data.size);
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        console.log('Recording stopped, total chunks:', audioChunksRef.current.length);
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        console.log('Created audio blob, size:', audioBlob.size);

        setPads((prevPads) =>
          prevPads.map((p) =>
            p.id === padId ? { ...p, hasAudio: true, audioBlob } : p
          )
        );

        setRecording(null);
        stream.getTracks().forEach((track) => track.stop());
        console.log('Microphone stream stopped');
      };

      mediaRecorderRef.current.start();
      setRecording(padId);
      console.log('Recording started for pad:', padId);
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  };

  const handleStop = () => {
    console.log('handleStop called');
    if (mediaRecorderRef.current && recording) {
      console.log('Stopping MediaRecorder');
      mediaRecorderRef.current.stop();
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-purple-900 via-black to-black p-8">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-white mb-2">MPC Sampler</h1>
        <p className="text-gray-400">Click to play • Right-click to record</p>
        {!audioContextReady && (
          <p className="text-yellow-400 mt-2 text-sm">Click any pad to enable audio</p>
        )}
      </div>

      <div className="grid grid-cols-4 gap-4 max-w-4xl">
        {pads.map((pad) => (
          <button
            key={pad.id}
            className={`relative aspect-square rounded-lg border-2 transition-all duration-200 ${
              recording === pad.id
                ? 'bg-red-600 border-red-400 animate-pulse'
                : pad.hasAudio
                ? 'bg-green-600 border-green-400 hover:bg-green-500'
                : 'bg-gray-800 border-gray-600 hover:bg-gray-700'
            } active:scale-95`}
            onClick={() => handleStart('play', pad.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              if (recording === pad.id) {
                handleStop();
              } else if (!recording) {
                handleStart('record', pad.id);
              }
            }}
          >
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-4">
              <span className="text-lg font-bold">{pad.label}</span>
              {recording === pad.id && (
                <span className="text-xs mt-2">Recording...</span>
              )}
              {!recording && pad.hasAudio && (
                <span className="text-xs mt-2 text-green-200">Ready</span>
              )}
            </div>
          </button>
        ))}
      </div>

      <div className="mt-8 text-gray-400 text-sm text-center">
        <p>Left-click: Play sample</p>
        <p>Right-click: Start recording (right-click again to stop)</p>
      </div>
    </div>
  );
}
