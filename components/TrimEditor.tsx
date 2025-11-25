'use client';

import { PadData } from '@/types';
import { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { X, Play, Save, ZoomIn, ZoomOut, Volume2, Maximize2, RotateCcw } from 'lucide-react';
import { normalizeAudioBlob } from '@/lib/audio';

interface TrimEditorProps {
  padData: PadData;
  onClose: () => void;
  onSave: (updates: Partial<PadData>) => void;
}

export default function TrimEditor({ padData, onClose, onSave }: TrimEditorProps) {
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [startTime, setStartTime] = useState<number>(padData.startTime ?? 0);
  const [endTime, setEndTime] = useState<number>(padData.endTime ?? 0);
  const [duration, setDuration] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [minPxPerSec, setMinPxPerSec] = useState<number>(100); // Pixels per second for waveform
  const [volume, setVolume] = useState<number>(padData.volume ?? 10);
  const [isNormalizing, setIsNormalizing] = useState(false);
  const [currentAudioBlob, setCurrentAudioBlob] = useState<Blob | null>(padData.audioBlob || null);
  const startMarkerRef = useRef<HTMLDivElement>(null);
  const endMarkerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasInitializedRef = useRef(false);
  const savedStartTimeRef = useRef<number>(startTime);
  const savedEndTimeRef = useRef<number>(endTime);
  const isMountedRef = useRef(true);
  const initialPinchDistanceRef = useRef<number | null>(null);
  const initialPinchZoomRef = useRef<number>(100);

  // Initialize WaveSurfer (only when audioBlob changes)
  useEffect(() => {
    if (!waveformRef.current || !currentAudioBlob) return;

    isMountedRef.current = true;
    let audioUrl: string | null = null;
    let wavesurfer: WaveSurfer | null = null;
    let isCleanedUp = false;

    // ALWAYS clear the container first to prevent double waveforms (especially in StrictMode)
    if (waveformRef.current) {
      waveformRef.current.innerHTML = '';
    }

    // Clean up previous instance if it exists
    if (wavesurferRef.current) {
      const previousInstance = wavesurferRef.current;
      wavesurferRef.current = null; // Clear ref first to avoid race conditions
      
      // Destroy immediately but catch errors
      try {
        if (previousInstance) {
          // Try to pause first if playing
          try {
            if (previousInstance.isPlaying && previousInstance.isPlaying()) {
              previousInstance.pause();
            }
          } catch (e) {
            // Ignore pause errors
          }
          
          // Destroy with error suppression
          previousInstance.destroy();
        }
      } catch (error: any) {
        // AbortError and all other cleanup errors are expected and safe to ignore
        // The instance is being cleaned up anyway, so errors don't matter
        // We don't log or handle them at all
      }
    }

    // Create WaveSurfer instance
    wavesurfer = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: '#4f46e5',
      progressColor: '#818cf8',
      cursorColor: '#e0e7ff',
      barWidth: 2,
      barRadius: 2,
      height: 100,
      normalize: true,
      backend: 'WebAudio',
      minPxPerSec: minPxPerSec,
    });

    wavesurferRef.current = wavesurfer;

    // Load audio
    audioUrl = URL.createObjectURL(currentAudioBlob);
    wavesurfer.load(audioUrl);

    // Also listen to decode event as a fallback for duration
    wavesurfer.on('decode', () => {
      if (isCleanedUp || !isMountedRef.current || !wavesurferRef.current) return;
      
      const dur = wavesurferRef.current.getDuration();
      if (dur && isFinite(dur) && dur > 0) {
        // Update duration if it was 0 or invalid
        if (duration === 0 || !duration) {
          setDuration(dur);
        }
        // Update endTime if it's still 0 and we haven't initialized yet
        if (!hasInitializedRef.current && (endTime === 0 || !endTime)) {
          hasInitializedRef.current = true;
          setStartTime(0);
          setEndTime(dur);
          savedStartTimeRef.current = 0;
          savedEndTimeRef.current = dur;
        }
      }
    });

    // Get duration when ready
    wavesurfer.on('ready', () => {
      if (isCleanedUp || !isMountedRef.current || !wavesurferRef.current) return;
      
      const dur = wavesurferRef.current.getDuration();
      
      // Check if duration is valid (not 0, NaN, or Infinity)
      if (!dur || !isFinite(dur) || dur <= 0) {
        console.warn('Invalid duration from WaveSurfer:', dur, 'Retrying...');
        // Retry after a short delay - sometimes duration isn't ready immediately
        setTimeout(() => {
          if (wavesurferRef.current && !isCleanedUp && isMountedRef.current) {
            const retryDur = wavesurferRef.current.getDuration();
            if (retryDur && isFinite(retryDur) && retryDur > 0) {
              setDuration(retryDur);
              if (!hasInitializedRef.current) {
                hasInitializedRef.current = true;
                setStartTime(0);
                setEndTime(retryDur);
                savedStartTimeRef.current = 0;
                savedEndTimeRef.current = retryDur;
              }
            }
          }
        }, 100);
        return;
      }
      
      setDuration(dur);
      // Only set endTime on first initialization
      if (!hasInitializedRef.current) {
        hasInitializedRef.current = true;
        
        // Initialize startTime and endTime properly
        let initialStartTime = padData.startTime ?? 0;
        let initialEndTime = padData.endTime;
        
        // If endTime is not set, undefined, null, or 0, use duration
        if (initialEndTime === undefined || initialEndTime === null || initialEndTime <= 0) {
          initialEndTime = dur;
        }
        
        // Ensure values are within valid range
        initialStartTime = Math.max(0, Math.min(initialStartTime, dur));
        initialEndTime = Math.max(initialStartTime, Math.min(initialEndTime, dur));
        
        // Ensure startTime is less than endTime
        if (initialStartTime >= initialEndTime) {
          initialStartTime = 0;
          initialEndTime = dur;
        }
        
        setStartTime(initialStartTime);
        setEndTime(initialEndTime);
        savedStartTimeRef.current = initialStartTime;
        savedEndTimeRef.current = initialEndTime;
      }
      // Set initial volume
      const volumeValue = volume / 10;
      wavesurferRef.current.setVolume(volumeValue);
      // Set initial zoom
      wavesurferRef.current.zoom(minPxPerSec);
    });

    // Handle playback state
    wavesurfer.on('play', () => {
      if (!isCleanedUp && isMountedRef.current) setIsPlaying(true);
    });
    wavesurfer.on('pause', () => {
      if (!isCleanedUp && isMountedRef.current) setIsPlaying(false);
    });
    wavesurfer.on('finish', () => {
      if (!isCleanedUp && isMountedRef.current) setIsPlaying(false);
    });

    // Cleanup
    return () => {
      isCleanedUp = true;
      isMountedRef.current = false;
      
      // Don't destroy here - let the next effect run handle cleanup
      // This prevents race conditions with React StrictMode
      // The container innerHTML will be cleared at the start of the next effect
      
      // Clean up URL
      if (audioUrl) {
        try {
          URL.revokeObjectURL(audioUrl);
        } catch (error) {
          // Ignore URL revocation errors
        }
      }
    };
  }, [currentAudioBlob]);

  // Cleanup WaveSurfer on actual component unmount
  useEffect(() => {
    return () => {
      // Just clear the ref - the instance will be garbage collected
      // Calling destroy() causes AbortError in React StrictMode
      wavesurferRef.current = null;
    };
  }, []);

  // Update zoom when minPxPerSec changes (only if audio is loaded)
  useEffect(() => {
    if (wavesurferRef.current && duration > 0) {
      try {
        wavesurferRef.current.zoom(minPxPerSec);
      } catch {
        // Ignore zoom errors if audio not ready
      }
    }
  }, [minPxPerSec, duration]);

  // Update refs when startTime/endTime change (but don't recreate WaveSurfer)
  useEffect(() => {
    savedStartTimeRef.current = startTime;
    savedEndTimeRef.current = endTime;
  }, [startTime, endTime]);

  // Update volume when it changes
  useEffect(() => {
    if (wavesurferRef.current) {
      const volumeValue = volume / 10;
      wavesurferRef.current.setVolume(volumeValue);
    }
  }, [volume]);

  // Update markers position based on startTime and endTime
  useEffect(() => {
    if (!containerRef.current || !startMarkerRef.current || !endMarkerRef.current || duration === 0) return;

    const container = containerRef.current;
    const containerWidth = container.offsetWidth;
    const startPercent = (startTime / duration) * 100;
    const endPercent = (endTime / duration) * 100;

    startMarkerRef.current.style.left = `${startPercent}%`;
    endMarkerRef.current.style.left = `${endPercent}%`;
  }, [startTime, endTime, duration]);

  const handleStartMarkerDrag = (e: React.MouseEvent | React.TouchEvent) => {
    if (!containerRef.current || !wavesurferRef.current || duration === 0) return;

    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    
    const updatePosition = (clientX: number) => {
      const x = clientX - containerRect.left;
      const percent = Math.max(0, Math.min(100, (x / containerRect.width) * 100));
      const newStartTime = (percent / 100) * duration;
      
      if (newStartTime < endTime) {
        setStartTime(Math.max(0, newStartTime));
      }
    };

    const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      updatePosition(clientX);
    };

    const handleEnd = () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleEnd);
    };

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    updatePosition(clientX);

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleMove);
    document.addEventListener('touchend', handleEnd);
  };

  const handleEndMarkerDrag = (e: React.MouseEvent | React.TouchEvent) => {
    if (!containerRef.current || !wavesurferRef.current || duration === 0) return;

    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    
    const updatePosition = (clientX: number) => {
      const x = clientX - containerRect.left;
      const percent = Math.max(0, Math.min(100, (x / containerRect.width) * 100));
      const newEndTime = (percent / 100) * duration;
      
      if (newEndTime > startTime) {
        setEndTime(Math.min(duration, newEndTime));
      }
    };

    const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      updatePosition(clientX);
    };

    const handleEnd = () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleEnd);
    };

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    updatePosition(clientX);

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleMove);
    document.addEventListener('touchend', handleEnd);
  };

  const handlePreview = () => {
    if (!wavesurferRef.current || duration === 0) return;
    
    // Set volume (0-1 range)
    const volumeValue = volume / 10;
    wavesurferRef.current.setVolume(volumeValue);
    
    const startRatio = startTime / duration;
    wavesurferRef.current.seekTo(startRatio);
    wavesurferRef.current.play();
    
    // Stop at endTime
    const checkTime = setInterval(() => {
      if (wavesurferRef.current) {
        const currentTime = wavesurferRef.current.getCurrentTime();
        if (currentTime >= endTime) {
          wavesurferRef.current.pause();
          wavesurferRef.current.seekTo(startRatio);
          clearInterval(checkTime);
        }
      }
    }, 50);
  };

  const handleZoomIn = () => {
    setMinPxPerSec(prev => Math.min(prev + 350, 1000)); // Max 1000 px/sec
  };

  const handleZoomOut = () => {
    setMinPxPerSec(prev => Math.max(prev - 100, 10)); // Min 10 px/sec
  };

  const handleZoomReset = () => {
    setMinPxPerSec(100);
  };

  const handleZoomToSelection = () => {
    if (!wavesurferRef.current || duration === 0 || endTime <= startTime) return;
    
    // Jump to 500 px/sec zoom
    setMinPxPerSec(500);
    
    // Seek to the start of the selection so it's visible
    setTimeout(() => {
      if (wavesurferRef.current && duration > 0) {
        // Seek to slightly before the start marker so it's visible
        const seekPosition = Math.max(0, (startTime - 0.05) / duration);
        wavesurferRef.current.seekTo(seekPosition);
      }
    }, 50);
  };

  // Pinch-to-zoom handlers for mobile
  const getDistance = (touches: React.TouchList) => {
    const [t1, t2] = [touches[0], touches[1]];
    return Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
  };

  const handlePinchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      initialPinchDistanceRef.current = getDistance(e.touches);
      initialPinchZoomRef.current = minPxPerSec;
    }
  };

  const handlePinchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialPinchDistanceRef.current !== null) {
      e.preventDefault();
      const currentDistance = getDistance(e.touches);
      const scale = currentDistance / initialPinchDistanceRef.current;
      const newZoom = Math.max(10, Math.min(1000, initialPinchZoomRef.current * scale));
      setMinPxPerSec(Math.round(newZoom));
    }
  };

  const handlePinchEnd = () => {
    initialPinchDistanceRef.current = null;
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseInt(e.target.value);
    setVolume(newVolume);
  };

  const handleNormalize = async () => {
    if (!currentAudioBlob || isNormalizing) return;
    
    setIsNormalizing(true);
    try {
      const normalizedBlob = await normalizeAudioBlob(currentAudioBlob);
      // Setting the blob will trigger the useEffect to reload WaveSurfer
      setCurrentAudioBlob(normalizedBlob);
    } catch (error) {
      console.error('Error normalizing audio:', error);
      alert('Failed to normalize audio');
    } finally {
      setIsNormalizing(false);
    }
  };

  const handleSave = () => {
    onSave({
      startTime: startTime > 0 ? startTime : undefined,
      endTime: endTime < duration ? endTime : undefined,
      volume: volume,
      audioBlob: currentAudioBlob || undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Edit Audio</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg text-gray-900 transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
        </div>

        {currentAudioBlob ? (
          <>
            {/* Waveform container */}
            <div 
              ref={containerRef}
              className="relative mb-4 bg-gray-100 rounded-lg p-4 touch-none"
              onTouchStart={handlePinchStart}
              onTouchMove={handlePinchMove}
              onTouchEnd={handlePinchEnd}
            >
              <div ref={waveformRef} className="w-full" />
              
              {/* Start marker */}
              <div
                ref={startMarkerRef}
                className="absolute top-0 bottom-0 w-1 bg-green-500 cursor-ew-resize z-10"
                style={{ left: `${(startTime / duration) * 100}%` }}
                onMouseDown={handleStartMarkerDrag}
                onTouchStart={handleStartMarkerDrag}
              >
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-green-500 text-white text-xs px-1 rounded">
                  Start
                </div>
              </div>

              {/* End marker */}
              <div
                ref={endMarkerRef}
                className="absolute top-0 bottom-0 w-1 bg-red-500 cursor-ew-resize z-10"
                style={{ left: `${(endTime / duration) * 100}%` }}
                onMouseDown={handleEndMarkerDrag}
                onTouchStart={handleEndMarkerDrag}
              >
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-red-500 text-white text-xs px-1 rounded">
                  End
                </div>
              </div>

              {/* Trimmed region highlight */}
              {duration > 0 && (
                <div
                  className="absolute top-0 bottom-0 bg-blue-200/30 pointer-events-none"
                  style={{
                    left: `${(startTime / duration) * 100}%`,
                    width: `${((endTime - startTime) / duration) * 100}%`,
                  }}
                />
              )}
            </div>

            {/* Zoom controls */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm font-semibold text-gray-700">Zoom:</span>
              <button
                onClick={handleZoomOut}
                disabled={duration === 0}
                className="p-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer border border-blue-300"
                title="Zoom out"
              >
                <ZoomOut size={16} />
              </button>
              <span className="text-sm min-w-[4rem] text-center text-gray-700 font-medium">{minPxPerSec}</span>
              <button
                onClick={handleZoomIn}
                disabled={duration === 0}
                className="p-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer border border-blue-300"
                title="Zoom in"
              >
                <ZoomIn size={16} />
              </button>
              <button
                onClick={handleZoomToSelection}
                disabled={duration === 0 || endTime <= startTime}
                className="p-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-lg transition-colors ml-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer border border-indigo-300"
                title="Zoom to selection (fit start/end markers)"
              >
                <Maximize2 size={16} />
              </button>
              <button
                onClick={handleZoomReset}
                disabled={duration === 0 || minPxPerSec === 100}
                className="p-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer border border-blue-300"
                title="Reset zoom"
              >
                <RotateCcw size={16} />
              </button>
            </div>

            {/* Volume control */}
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-2 min-w-[6rem]">
                <Volume2 size={16} className="text-gray-700" />
                <span className="text-sm font-semibold text-gray-700">Volume:</span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                value={volume}
                onChange={handleVolumeChange}
                className="flex-1 h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                style={{
                  background: `linear-gradient(to right, #4f46e5 0%, #4f46e5 ${(volume / 10) * 100}%, #d1d5db ${(volume / 10) * 100}%, #d1d5db 100%)`
                }}
              />
              <span className="text-sm font-semibold min-w-[2rem] text-gray-700">{volume}</span>
            </div>

            {/* Time display */}
            <div className="flex items-center justify-between mb-4 text-sm text-gray-800">
              <div>
                <span className="font-semibold text-gray-900">Start:</span> <span className="text-gray-700">{startTime.toFixed(2)}s</span>
              </div>
              <div>
                <span className="font-semibold text-gray-900">End:</span> <span className="text-gray-700">{endTime.toFixed(2)}s</span>
              </div>
              <div>
                <span className="font-semibold text-gray-900">Duration:</span> <span className="text-gray-700">{(endTime - startTime).toFixed(2)}s</span>
              </div>
              {duration > 0 && (
                <div>
                  <span className="font-semibold text-gray-900">Total:</span> <span className="text-gray-700">{duration.toFixed(2)}s</span>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handlePreview}
                disabled={isPlaying}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <Play size={16} />
                Preview
              </button>
              <button
                onClick={handleNormalize}
                disabled={isNormalizing}
                className="flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                title="Normalize audio (permanently adjust volume to maximum)"
              >
                <Maximize2 size={16} />
                {isNormalizing ? 'Normalizing...' : 'Normalize'}
              </button>
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors cursor-pointer"
              >
                <Save size={16} />
                Save
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <div className="text-center py-8 text-gray-500">
            No audio available for this pad
          </div>
        )}
      </div>
    </div>
  );
}

