import { PadData } from '@/types';

let audioContext: AudioContext | null = null;
let isAudioContextInitialized = false;

/**
 * Initializes AudioContext on first user interaction (required for autoplay policy)
 * Must be called within a user event handler
 */
export async function initializeAudioContext(): Promise<AudioContext> {
  if (audioContext && isAudioContextInitialized) {
    return audioContext;
  }

  // Create new AudioContext
  audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  
  // Resume if suspended (required for autoplay policy)
  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }
  
  isAudioContextInitialized = true;
  return audioContext;
}

/**
 * Records audio from microphone while button is held down
 */
export async function recordAudio(): Promise<Blob> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mediaRecorder = new MediaRecorder(stream);
  const chunks: Blob[] = [];

  return new Promise((resolve, reject) => {
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      stream.getTracks().forEach(track => track.stop());
      const blob = new Blob(chunks, { type: 'audio/webm' });
      resolve(blob);
    };

    mediaRecorder.onerror = (event) => {
      stream.getTracks().forEach(track => track.stop());
      reject(event);
    };

    mediaRecorder.start();
    
    // Stop recording after a reasonable timeout (safety)
    setTimeout(() => {
      if (mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
      }
    }, 60000); // 60 second max
  });
}

/**
 * Stops recording (called when button is released)
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
      currentStream.getTracks().forEach(track => track.stop());
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
        currentStream.getTracks().forEach(track => track.stop());
        currentStream = null;
      }
      isRecordingActive = false;
    };

    mediaRecorder.onerror = (event) => {
      console.error('MediaRecorder error:', event);
      if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
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
      currentStream.getTracks().forEach(track => track.stop());
      currentStream = null;
    }
    isRecordingActive = false;
    currentMediaRecorder = null;
    return false;
  }
}

export async function stopRecording(): Promise<Blob | null> {
  return new Promise(async (resolve, reject) => {
    if (!currentMediaRecorder || !isRecordingActive) {
      // No active recording - this is not an error, just return null
      resolve(null);
      return;
    }

    const mediaRecorder = currentMediaRecorder;
    
    // Check if recorder is actually recording
    if (mediaRecorder.state === 'inactive') {
      resolve(null);
      return;
    }

    mediaRecorder.onstop = async () => {
      if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        currentStream = null;
      }
      
      // Only create blob if we have chunks
      if (recordingChunks.length > 0) {
        const originalBlob = new Blob(recordingChunks, { type: 'audio/webm' });
        
        try {
          // Decode audio and trim silence
          const context = await initializeAudioContext();
          const arrayBuffer = await blobToArrayBuffer(originalBlob);
          let audioBuffer = await context.decodeAudioData(arrayBuffer);
          
          // Only trim if audio is longer than 200ms (avoid trimming very short clips)
          if (audioBuffer.length > audioBuffer.sampleRate * 0.2) {
            // Trim silence from start and end
            const trimmedBuffer = await trimSilence(audioBuffer);
            
            // Only use trimmed version if it's not too short (at least 100ms)
            if (trimmedBuffer.length > audioBuffer.sampleRate * 0.1) {
              audioBuffer = trimmedBuffer;
            }
          }
          
          // Convert back to blob (keep original WebM format for compatibility)
          // For now, return original blob and trim on playback instead
          // This avoids format conversion issues
          currentMediaRecorder = null;
          recordingChunks = [];
          isRecordingActive = false;
          resolve(originalBlob);
        } catch (error) {
          console.error('Error processing audio:', error);
          // If processing fails, return original blob
          currentMediaRecorder = null;
          recordingChunks = [];
          isRecordingActive = false;
          resolve(originalBlob);
        }
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
      // If stop fails, clean up and resolve with null
      if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
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
 * Converts Blob to ArrayBuffer
 */
async function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(blob);
  });
}

/**
 * Trims silence from the beginning and end of audio buffer
 * Threshold is the minimum amplitude to consider as "sound" (0.0 to 1.0)
 * Lower threshold = more aggressive trimming, higher threshold = less trimming
 */
async function trimSilence(audioBuffer: AudioBuffer, threshold: number = 0.005): Promise<AudioBuffer> {
  const context = audioContext || await initializeAudioContext();
  const channelData = audioBuffer.getChannelData(0); // Use first channel for analysis
  const sampleRate = audioBuffer.sampleRate;
  
  // Calculate RMS (Root Mean Square) over a window for better detection
  const windowSize = Math.floor(sampleRate * 0.01); // 10ms window
  const rmsThreshold = threshold * 0.5; // Lower threshold for RMS
  
  // Find start of audio using RMS
  let startIndex = 0;
  for (let i = 0; i < channelData.length - windowSize; i += windowSize) {
    let sum = 0;
    for (let j = 0; j < windowSize; j++) {
      sum += channelData[i + j] * channelData[i + j];
    }
    const rms = Math.sqrt(sum / windowSize);
    if (rms > rmsThreshold) {
      startIndex = Math.max(0, i - sampleRate * 0.05); // Keep 50ms before first sound
      break;
    }
  }
  
  // Find end of audio using RMS
  let endIndex = channelData.length;
  for (let i = channelData.length - windowSize; i >= 0; i -= windowSize) {
    let sum = 0;
    for (let j = 0; j < windowSize; j++) {
      sum += channelData[i + j] * channelData[i + j];
    }
    const rms = Math.sqrt(sum / windowSize);
    if (rms > rmsThreshold) {
      endIndex = Math.min(channelData.length, i + windowSize + sampleRate * 0.05); // Keep 50ms after last sound
      break;
    }
  }
  
  // If no significant audio found or trimming would remove everything, return original
  if (startIndex >= endIndex || (endIndex - startIndex) < sampleRate * 0.1) {
    return audioBuffer;
  }
  
  // Create trimmed buffer
  const trimmedLength = endIndex - startIndex;
  const trimmedBuffer = context.createBuffer(
    audioBuffer.numberOfChannels,
    trimmedLength,
    sampleRate
  );
  
  // Copy trimmed data from all channels
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const originalData = audioBuffer.getChannelData(channel);
    const trimmedData = trimmedBuffer.getChannelData(channel);
    for (let i = 0; i < trimmedLength; i++) {
      trimmedData[i] = originalData[startIndex + i];
    }
  }
  
  return trimmedBuffer;
}

/**
 * Converts AudioBuffer back to Blob
 */
async function audioBufferToBlob(audioBuffer: AudioBuffer): Promise<Blob> {
  const context = audioContext || await initializeAudioContext();
  
  // Use OfflineAudioContext to render the buffer
  const offlineContext = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    audioBuffer.sampleRate
  );
  
  const source = offlineContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offlineContext.destination);
  source.start(0);
  
  const renderedBuffer = await offlineContext.startRendering();
  
  // Convert to WAV format
  const wav = audioBufferToWav(renderedBuffer);
  return new Blob([wav], { type: 'audio/wav' });
}

/**
 * Converts AudioBuffer to WAV format
 */
function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const length = buffer.length;
  const numberOfChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const arrayBuffer = new ArrayBuffer(44 + length * numberOfChannels * 2);
  const view = new DataView(arrayBuffer);
  
  // WAV header
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  let offset = 0;
  writeString(offset, 'RIFF'); offset += 4;
  view.setUint32(offset, 36 + length * numberOfChannels * 2, true); offset += 4;
  writeString(offset, 'WAVE'); offset += 4;
  writeString(offset, 'fmt '); offset += 4;
  view.setUint32(offset, 16, true); offset += 4; // Subchunk1Size
  view.setUint16(offset, 1, true); offset += 2; // AudioFormat
  view.setUint16(offset, numberOfChannels, true); offset += 2;
  view.setUint32(offset, sampleRate, true); offset += 4;
  view.setUint32(offset, sampleRate * numberOfChannels * 2, true); offset += 4; // ByteRate
  view.setUint16(offset, numberOfChannels * 2, true); offset += 2; // BlockAlign
  view.setUint16(offset, 16, true); offset += 2; // BitsPerSample
  writeString(offset, 'data'); offset += 4;
  view.setUint32(offset, length * numberOfChannels * 2, true); offset += 4;
  
  // Convert float samples to 16-bit PCM
  for (let i = 0; i < length; i++) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }
  }
  
  return arrayBuffer;
}

/**
 * Reverses audio buffer
 */
async function reverseAudioBuffer(audioBuffer: AudioBuffer): Promise<AudioBuffer> {
  const context = audioContext || await initializeAudioContext();
  const reversedBuffer = context.createBuffer(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    audioBuffer.sampleRate
  );

  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const channelData = audioBuffer.getChannelData(channel);
    const reversedData = reversedBuffer.getChannelData(channel);
    for (let i = 0; i < channelData.length; i++) {
      reversedData[i] = channelData[channelData.length - 1 - i];
    }
  }

  return reversedBuffer;
}

/**
 * Applies effect to audio buffer
 */
async function applyEffectToBuffer(
  audioBuffer: AudioBuffer,
  effect: 'smurf' | 'troll' | 'none'
): Promise<AudioBuffer> {
  if (effect === 'none') {
    return audioBuffer;
  }

  // Calculate playback rate and new buffer length
  const playbackRate = effect === 'smurf' ? 1.5 : 0.6;
  const newLength = Math.ceil(audioBuffer.length / playbackRate);

  // Use offline context to render the effect
  const offlineContext = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    newLength,
    audioBuffer.sampleRate
  );

  const offlineSource = offlineContext.createBufferSource();
  offlineSource.buffer = audioBuffer;
  offlineSource.playbackRate.value = playbackRate;

  const offlineGain = offlineContext.createGain();
  offlineGain.gain.value = effect === 'smurf' ? 1.2 : 1.1;

  offlineSource.connect(offlineGain);
  offlineGain.connect(offlineContext.destination);
  offlineSource.start(0);

  return await offlineContext.startRendering();
}

/**
 * Plays audio with effects and reverse option
 * Returns a promise that resolves when playback finishes
 */
export async function playAudio(padData: PadData): Promise<void> {
  if (!padData.audioBlob) {
    return;
  }

  const context = await initializeAudioContext();
  
  // Convert blob to array buffer
  const arrayBuffer = await blobToArrayBuffer(padData.audioBlob);
  
  // Decode audio data
  let audioBuffer = await context.decodeAudioData(arrayBuffer);

  // Trim silence on playback (only if audio is longer than 200ms)
  if (audioBuffer.length > audioBuffer.sampleRate * 0.2) {
    const trimmedBuffer = await trimSilence(audioBuffer);
    // Only use trimmed if it's not too short (at least 100ms)
    if (trimmedBuffer.length > audioBuffer.sampleRate * 0.1) {
      audioBuffer = trimmedBuffer;
    }
  }

  // Apply reverse if needed
  if (padData.reverse) {
    audioBuffer = await reverseAudioBuffer(audioBuffer);
  }

  // Apply effect
  audioBuffer = await applyEffectToBuffer(audioBuffer, padData.effect);

  // Create source and play
  return new Promise((resolve) => {
    const source = context.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(context.destination);
    
    source.onended = () => {
      resolve();
    };
    
    source.start(0);
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
      // Remove data URL prefix
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

