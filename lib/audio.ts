import { PadData } from '@/types';

let audioContext: AudioContext | null = null;
let isAudioUnlocked = false;

/**
 * Gets the AudioContext instance, creating it if needed
 * MUST be called directly from user event handler (click/touch)
 */
export function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    console.log('✓ AudioContext created. State:', audioContext.state);
  }
  return audioContext;
}

/**
 * Check if audio is unlocked
 */
export function isAudioReady(): boolean {
  return isAudioUnlocked && audioContext !== null && audioContext.state === 'running';
}

/**
 * Unlocks audio - MUST be called from a direct user interaction (button click/tap)
 * This is the proper way to initialize audio on mobile browsers
 */
export async function unlockAudio(): Promise<boolean> {
  console.log('🔓 Unlocking audio...');
  
  try {
    // Create context if needed
    const context = getAudioContext();
    console.log('AudioContext state before unlock:', context.state);
    
    // Resume context
    if (context.state === 'suspended') {
      console.log('Resuming suspended AudioContext...');
      await context.resume();
      console.log('✓ AudioContext resumed. State:', context.state);
    }
    
    // Play a TEST TONE to fully unlock and verify audio works (iOS Safari requirement)
    console.log('🔔 Playing test tone to verify audio...');
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    
    oscillator.frequency.value = 440; // A4 note
    gainNode.gain.value = 0.1; // Quiet but audible
    
    oscillator.connect(gainNode);
    gainNode.connect(context.destination);
    
    oscillator.start(context.currentTime);
    oscillator.stop(context.currentTime + 0.1); // 100ms beep
    
    // Wait for the beep to finish
    await new Promise(resolve => setTimeout(resolve, 200));
    
    isAudioUnlocked = true;
    console.log('✅ Audio unlocked successfully! If you heard a short beep, audio is working.');
    return true;
  } catch (error) {
    console.error('❌ Failed to unlock audio:', error);
    return false;
  }
}

/**
 * Ensures AudioContext is running - MUST be called from user event handler
 * Returns a promise that resolves when context is running
 */
export async function ensureAudioContextRunning(): Promise<void> {
  const context = getAudioContext();
  
  if (context.state === 'running') {
    console.log('✓ AudioContext already running');
    isAudioUnlocked = true;
    return;
  }
  
  if (context.state === 'suspended') {
    console.log('⏸ AudioContext suspended, resuming...');
    await context.resume();
    console.log('✓ AudioContext resumed. State:', context.state);
    isAudioUnlocked = true;
  }
  
  if (context.state === 'closed') {
    console.error('✗ AudioContext is closed, creating new one');
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }
    isAudioUnlocked = true;
    console.log('✓ New AudioContext created and running');
  }
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
        
        // Return original blob without processing for now
        // Trimming can be re-enabled later if needed
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
  const context = getAudioContext();
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
  const context = getAudioContext();
  
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
  const context = getAudioContext();
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
    console.warn('No audio blob to play');
    return;
  }

  console.log('🎵 playAudio called - blob size:', padData.audioBlob.size, 'bytes');

  try {
    // Get AudioContext (will be created if needed, but should already exist from touch event)
    const context = getAudioContext();
    console.log('📱 AudioContext state before playback:', context.state);
    
    // Ensure it's running
    await ensureAudioContextRunning();
    
    if (context.state !== 'running') {
      console.error('✗ AudioContext failed to start. State:', context.state);
      throw new Error(`AudioContext is ${context.state}, cannot play audio`);
    }
    
    console.log('✓ AudioContext ready. State:', context.state);
    
    // Convert blob to array buffer
    const arrayBuffer = await blobToArrayBuffer(padData.audioBlob);
    console.log('ArrayBuffer size:', arrayBuffer.byteLength, 'bytes');
    
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      console.error('Empty array buffer');
      return;
    }
    
    // Decode audio data
    let audioBuffer: AudioBuffer;
    try {
      audioBuffer = await context.decodeAudioData(arrayBuffer.slice(0));
      console.log('AudioBuffer decoded - length:', audioBuffer.length, 'samples, duration:', (audioBuffer.length / audioBuffer.sampleRate).toFixed(2), 'seconds');
    } catch (error) {
      console.error('Error decoding audio data:', error);
      return;
    }

    if (!audioBuffer || audioBuffer.length === 0) {
      console.error('Empty audio buffer');
      return;
    }

    // Temporarily disable trimming to test if it's causing issues
    // TODO: Re-enable trimming with better logic
    /*
    // Trim silence on playback (only if audio is longer than 200ms)
    if (audioBuffer.length > audioBuffer.sampleRate * 0.2) {
      try {
        const trimmedBuffer = await trimSilence(audioBuffer);
        // Only use trimmed if it's not too short (at least 100ms)
        if (trimmedBuffer.length > audioBuffer.sampleRate * 0.1) {
          audioBuffer = trimmedBuffer;
        }
      } catch (error) {
        console.error('Error trimming audio:', error);
        // Continue with original buffer if trimming fails
      }
    }
    */

    // Apply reverse if needed
    if (padData.reverse) {
      console.log('Applying reverse effect');
      audioBuffer = await reverseAudioBuffer(audioBuffer);
    }

    // Apply effect
    if (padData.effect !== 'none') {
      console.log('Applying effect:', padData.effect);
      audioBuffer = await applyEffectToBuffer(audioBuffer, padData.effect);
    }

    // Create source and play
    return new Promise((resolve, reject) => {
      try {
        const source = context.createBufferSource();
        source.buffer = audioBuffer;
        
        // Connect to destination
        const gainNode = context.createGain();
        gainNode.gain.value = 1.0; // Full volume
        source.connect(gainNode);
        gainNode.connect(context.destination);
        
        console.log('🔊 Audio source created and connected, starting playback...');
        console.log('📊 Buffer info:', {
          duration: audioBuffer.duration,
          length: audioBuffer.length,
          sampleRate: audioBuffer.sampleRate,
          numberOfChannels: audioBuffer.numberOfChannels
        });
        console.log('🎚️ Gain value:', gainNode.gain.value);
        console.log('🔌 Destination:', context.destination);
        console.log('📱 AudioContext state before start:', context.state);
        console.log('🔢 AudioContext currentTime:', context.currentTime);
        
        source.onended = () => {
          console.log('✓ Audio playback ended');
          resolve();
        };
        
        source.start(0);
        console.log('▶️ Audio playback started successfully');
        console.log('📱 AudioContext state after start:', context.state);
        
        // Add a timeout to log if playback seems stuck
        setTimeout(() => {
          console.log('⏱️ 1 second into playback. Context time:', context.currentTime);
        }, 1000);
      } catch (error) {
        console.error('❌ Error starting audio playback:', error);
        reject(error);
      }
    });
  } catch (error) {
    console.error('Error in playAudio:', error);
    throw error;
  }
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

