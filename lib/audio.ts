import { PadData } from '@/types';
import { Howl } from 'howler';

// Store Howl instances for each pad
const padSounds: Map<string, Howl> = new Map();
let isAudioUnlocked = false;

/**
 * Check if audio is unlocked
 */
export function isAudioReady(): boolean {
  return isAudioUnlocked;
}

/**
 * Unlocks audio - MUST be called from a direct user interaction (button click/tap)
 * Howler.js handles most of this automatically, but we still want explicit unlock
 */
export async function unlockAudio(): Promise<boolean> {
  console.log('🔓 Unlocking audio with Howler.js...');
  
  try {
    // Play a short beep to test and unlock audio
    const testSound = new Howl({
      src: ['data:audio/wav;base64,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']
    });

    // Play and wait for it to finish
    await new Promise<void>((resolve) => {
      testSound.play();
      testSound.on('end', () => {
        resolve();
      });
      // Fallback timeout
      setTimeout(resolve, 500);
    });

    isAudioUnlocked = true;
    console.log('✅ Audio unlocked successfully with Howler.js!');
    return true;
  } catch (error) {
    console.error('❌ Failed to unlock audio:', error);
    return false;
  }
}

/**
 * Records audio from microphone
 */
let currentMediaRecorder: MediaRecorder | null = null;
let currentStream: MediaStream | null = null;
let recordingChunks: Blob[] = [];
let isRecordingActive = false;

export async function startRecording(): Promise<boolean> {
  try {
    // Clean up any existing recording
    if (currentMediaRecorder && currentMediaRecorder.state !== 'inactive') {
      currentMediaRecorder.stop();
    }
    if (currentStream) {
      currentStream.getTracks().forEach((track) => track.stop());
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    currentStream = stream;
    recordingChunks = [];
    const mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordingChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      if (currentStream) {
        currentStream.getTracks().forEach((track) => track.stop());
        currentStream = null;
      }
      isRecordingActive = false;
    };

    mediaRecorder.onerror = (event) => {
      console.error('MediaRecorder error:', event);
      if (currentStream) {
        currentStream.getTracks().forEach((track) => track.stop());
        currentStream = null;
      }
      isRecordingActive = false;
      currentMediaRecorder = null;
    };

    mediaRecorder.start();
    currentMediaRecorder = mediaRecorder;
    isRecordingActive = true;
    return true;
  } catch (error) {
    console.error('Failed to start recording:', error);
    if (currentStream) {
      currentStream.getTracks().forEach((track) => track.stop());
      currentStream = null;
    }
    isRecordingActive = false;
    currentMediaRecorder = null;
    return false;
  }
}

export async function stopRecording(): Promise<Blob | null> {
  return new Promise(async (resolve) => {
    if (!currentMediaRecorder || !isRecordingActive) {
      resolve(null);
      return;
    }

    const mediaRecorder = currentMediaRecorder;

    if (mediaRecorder.state === 'inactive') {
      resolve(null);
      return;
    }

    mediaRecorder.onstop = async () => {
      if (currentStream) {
        currentStream.getTracks().forEach((track) => track.stop());
        currentStream = null;
      }

      if (recordingChunks.length > 0) {
        const originalBlob = new Blob(recordingChunks, { type: 'audio/webm' });
        currentMediaRecorder = null;
        recordingChunks = [];
        isRecordingActive = false;
        resolve(originalBlob);
      } else {
        currentMediaRecorder = null;
        recordingChunks = [];
        isRecordingActive = false;
        resolve(null);
      }
    };

    try {
      mediaRecorder.stop();
    } catch (error) {
      if (currentStream) {
        currentStream.getTracks().forEach((track) => track.stop());
        currentStream = null;
      }
      currentMediaRecorder = null;
      recordingChunks = [];
      isRecordingActive = false;
      resolve(null);
    }
  });
}

/**
 * Reverses audio blob using Web Audio API
 */
async function reverseAudioBlob(blob: Blob): Promise<Blob> {
  // Create temporary AudioContext for processing
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  
  try {
    // Convert blob to ArrayBuffer
    const arrayBuffer = await blob.arrayBuffer();
    
    // Decode audio data
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    // Create reversed buffer
    const reversedBuffer = audioContext.createBuffer(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      audioBuffer.sampleRate
    );
    
    // Reverse each channel
    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const channelData = audioBuffer.getChannelData(channel);
      const reversedData = reversedBuffer.getChannelData(channel);
      for (let i = 0; i < channelData.length; i++) {
        reversedData[i] = channelData[channelData.length - 1 - i];
      }
    }
    
    // Convert back to WAV blob
    const wavBlob = audioBufferToWavBlob(reversedBuffer);
    
    // Close the temporary context
    await audioContext.close();
    
    return wavBlob;
  } catch (error) {
    console.error('Error reversing audio:', error);
    await audioContext.close();
    throw error;
  }
}

/**
 * Converts AudioBuffer to WAV Blob
 */
function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const length = buffer.length * buffer.numberOfChannels * 2;
  const arrayBuffer = new ArrayBuffer(44 + length);
  const view = new DataView(arrayBuffer);
  
  // Write WAV header
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  let offset = 0;
  writeString(offset, 'RIFF'); offset += 4;
  view.setUint32(offset, 36 + length, true); offset += 4;
  writeString(offset, 'WAVE'); offset += 4;
  writeString(offset, 'fmt '); offset += 4;
  view.setUint32(offset, 16, true); offset += 4;
  view.setUint16(offset, 1, true); offset += 2;
  view.setUint16(offset, buffer.numberOfChannels, true); offset += 2;
  view.setUint32(offset, buffer.sampleRate, true); offset += 4;
  view.setUint32(offset, buffer.sampleRate * buffer.numberOfChannels * 2, true); offset += 4;
  view.setUint16(offset, buffer.numberOfChannels * 2, true); offset += 2;
  view.setUint16(offset, 16, true); offset += 2;
  writeString(offset, 'data'); offset += 4;
  view.setUint32(offset, length, true); offset += 4;
  
  // Write audio samples
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }
  }
  
  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

/**
 * Plays audio using Howler.js - handles all the mobile quirks automatically!
 */
export async function playAudio(padData: PadData): Promise<void> {
  if (!padData.audioBlob) {
    console.warn('No audio blob to play');
    return;
  }

  console.log('🎵 playAudio called - blob size:', padData.audioBlob.size, 'bytes');

  return new Promise(async (resolve, reject) => {
    try {
      // TypeScript now knows audioBlob is defined
      let audioBlob = padData.audioBlob!;
      
      // Apply reverse if needed
      if (padData.reverse) {
        console.log('🔄 Reversing audio...');
        audioBlob = await reverseAudioBlob(audioBlob);
        console.log('✓ Audio reversed');
      }
      
      // Create URL for the blob
      const audioUrl = URL.createObjectURL(audioBlob);

      // Clean up old sound if exists
      if (padSounds.has(padData.id)) {
        const oldSound = padSounds.get(padData.id);
        oldSound?.unload();
        padSounds.delete(padData.id);
      }

      // Calculate playback rate based on effect
      let rate = 1.0;
      if (padData.effect === 'smurf') {
        rate = 1.5; // Higher pitch, faster
      } else if (padData.effect === 'troll') {
        rate = 0.6; // Lower pitch, slower
      }

      // Get volume from padData (0-10 range, convert to 0.0-1.0 for Howler)
      const volumeRaw = padData.volume !== undefined ? padData.volume : 10;
      const volume = Math.max(0, Math.min(1.0, volumeRaw / 10));

      // Create new Howl instance
      const sound = new Howl({
        src: [audioUrl],
        format: ['webm', 'wav'], // Support both formats
        html5: false, // Use Web Audio API for better control
        rate: rate,
        volume: volume,
        onload: () => {
          console.log('✓ Audio loaded successfully');
        },
        onloaderror: (id, error) => {
          console.error('❌ Error loading audio:', error);
          URL.revokeObjectURL(audioUrl);
          reject(new Error('Failed to load audio'));
        },
        onplay: () => {
          console.log('▶️ Audio playback started');
        },
        onend: () => {
          console.log('✓ Audio playback ended');
          URL.revokeObjectURL(audioUrl);
          resolve();
        },
        onplayerror: (id, error) => {
          console.error('❌ Error playing audio:', error);
          // Try to unlock audio and play again
          sound.once('unlock', () => {
            console.log('🔓 Audio unlocked, retrying playback...');
            sound.play();
          });
        },
      });

      // Store the sound instance
      padSounds.set(padData.id, sound);

      // Play the sound
      sound.play();
    } catch (error) {
      console.error('❌ Error in playAudio:', error);
      reject(error);
    }
  });
}

/**
 * Converts Blob to base64 string
 */
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      const base64Data = base64.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Converts base64 string to Blob
 */
function base64ToBlob(base64: string, mimeType: string = 'audio/webm'): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

/**
 * Saves pad data to localStorage
 */
export async function saveToStorage(pads: PadData[]): Promise<void> {
  if (typeof window === 'undefined') return;

  const dataToSave = await Promise.all(
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
      };
    })
  );

  localStorage.setItem('mpc-pads', JSON.stringify(dataToSave));
}

/**
 * Loads pad data from localStorage
 */
export function loadFromStorage(): Partial<PadData>[] {
  if (typeof window === 'undefined') return [];

  const stored = localStorage.getItem('mpc-pads');
  if (!stored) return [];

  try {
    const parsed = JSON.parse(stored);
    return parsed.map((item: any) => {
      const result: Partial<PadData> = {
        id: item.id,
        effect: item.effect || 'none',
        reverse: item.reverse || false,
        volume: item.volume !== undefined ? item.volume : 10,
      };

      if (item.audioBase64) {
        result.audioBlob = base64ToBlob(item.audioBase64);
        result.audioUrl = URL.createObjectURL(result.audioBlob);
      }

      return result;
    });
  } catch {
    return [];
  }
}
