'use client';

import { PadData } from '@/types';
import { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { X, Play, Save, ZoomIn, ZoomOut, Volume2, Maximize2 } from 'lucide-react';
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
  const [zoom, setZoom] = useState<number>(1); // 1 = normal, higher = more zoom
  const [volume, setVolume] = useState<number>(padData.volume ?? 10);
  const [isNormalizing, setIsNormalizing] = useState(false);
  const [currentAudioBlob, setCurrentAudioBlob] = useState<Blob | null>(padData.audioBlob || null);
  const startMarkerRef = useRef<HTMLDivElement>(null);
  const endMarkerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasInitializedRef = useRef(false);
  const savedStartTimeRef = useRef<number>(startTime);
  const savedEndTimeRef = useRef<number>(endTime);

  useEffect(() => {
    if (!waveformRef.current || !currentAudioBlob) return;

    // Clean up previous instance
    if (wavesurferRef.current) {
      wavesurferRef.current.destroy();
    }

    // Create WaveSurfer instance with current zoom
    const wavesurfer = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: '#4f46e5',
      progressColor: '#818cf8',
      cursorColor: '#e0e7ff',
      barWidth: 2,
      barRadius: 2,
      height: 100,
      normalize: true,
      backend: 'WebAudio',
      minPxPerSec: 10 * zoom, // Zoom control: higher = more zoom
    });

    wavesurferRef.current = wavesurfer;

    // Load audio
    const audioUrl = URL.createObjectURL(currentAudioBlob);
    wavesurfer.load(audioUrl);

    // Get duration when ready
    wavesurfer.on('ready', () => {
      const dur = wavesurfer.getDuration();
      setDuration(dur);
      // Only set endTime on first initialization, not when recreating due to zoom
      if (!hasInitializedRef.current) {
        hasInitializedRef.current = true;
        if (!padData.endTime || endTime === 0) {
          setEndTime(dur);
        }
      } else {
        // Restore saved startTime and endTime when recreating due to zoom
        setStartTime(savedStartTimeRef.current);
        setEndTime(savedEndTimeRef.current);
      }
      // Set initial volume
      const volumeValue = volume / 10;
      wavesurfer.setVolume(volumeValue);
    });

    // Handle playback state
    wavesurfer.on('play', () => setIsPlaying(true));
    wavesurfer.on('pause', () => setIsPlaying(false));
    wavesurfer.on('finish', () => setIsPlaying(false));

    // Cleanup
    return () => {
      wavesurfer.destroy();
      URL.revokeObjectURL(audioUrl);
    };
  }, [currentAudioBlob, zoom]);

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
    setZoom(prev => Math.min(prev + 0.5, 10)); // Max zoom 10x
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.5, 0.5)); // Min zoom 0.5x
  };

  const handleZoomReset = () => {
    setZoom(1);
  };

  const handleZoomToSelection = () => {
    if (!containerRef.current || duration === 0 || endTime <= startTime) return;
    
    // Calculate zoom level needed to fit the selection (startTime to endTime)
    const containerWidth = containerRef.current.offsetWidth;
    const selectionDuration = endTime - startTime;
    
    // We want the selection to take up about 80% of the container width
    const targetWidth = containerWidth * 0.8;
    const pixelsPerSecond = targetWidth / selectionDuration;
    
    // Base minPxPerSec is 10, so zoom factor is pixelsPerSecond / 10
    const calculatedZoom = Math.max(0.5, Math.min(10, pixelsPerSecond / 10));
    setZoom(calculatedZoom);
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
      setCurrentAudioBlob(normalizedBlob);
      // Update the audio URL for preview
      if (wavesurferRef.current) {
        const audioUrl = URL.createObjectURL(normalizedBlob);
        wavesurferRef.current.load(audioUrl);
      }
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
              className="relative mb-4 bg-gray-100 rounded-lg p-4"
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
              <span className="text-sm min-w-[3rem] text-center text-gray-700 font-medium">{zoom.toFixed(1)}x</span>
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
                disabled={duration === 0 || zoom === 1}
                className="p-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer border border-gray-400"
                title="Reset zoom"
              >
                1x
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

