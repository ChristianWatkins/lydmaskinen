'use client';

import { PadData } from '@/types';
import { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { X, Play, Save } from 'lucide-react';

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
  const startMarkerRef = useRef<HTMLDivElement>(null);
  const endMarkerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!waveformRef.current || !padData.audioBlob) return;

    // Create WaveSurfer instance
    const wavesurfer = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: '#4f46e5',
      progressColor: '#818cf8',
      cursorColor: '#e0e7ff',
      barWidth: 2,
      barRadius: 2,
      responsive: true,
      height: 100,
      normalize: true,
      backend: 'WebAudio',
    });

    wavesurferRef.current = wavesurfer;

    // Load audio
    const audioUrl = padData.audioUrl || URL.createObjectURL(padData.audioBlob);
    wavesurfer.load(audioUrl);

    // Get duration when ready
    wavesurfer.on('ready', () => {
      const dur = wavesurfer.getDuration();
      setDuration(dur);
      if (!padData.endTime) {
        setEndTime(dur);
      }
    });

    // Handle playback state
    wavesurfer.on('play', () => setIsPlaying(true));
    wavesurfer.on('pause', () => setIsPlaying(false));
    wavesurfer.on('finish', () => setIsPlaying(false));

    // Cleanup
    return () => {
      wavesurfer.destroy();
      if (!padData.audioUrl && audioUrl.startsWith('blob:')) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [padData.audioBlob, padData.audioUrl]);

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
    if (!wavesurferRef.current) return;
    
    wavesurferRef.current.seek(startTime / duration);
    wavesurferRef.current.play();
    
    // Stop at endTime
    const checkTime = setInterval(() => {
      if (wavesurferRef.current) {
        const currentTime = wavesurferRef.current.getCurrentTime();
        if (currentTime >= endTime) {
          wavesurferRef.current.pause();
          wavesurferRef.current.seek(startTime / duration);
          clearInterval(checkTime);
        }
      }
    }, 50);
  };

  const handleSave = () => {
    onSave({
      startTime: startTime > 0 ? startTime : undefined,
      endTime: endTime < duration ? endTime : undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Trim Audio</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {padData.audioBlob ? (
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

            {/* Time display */}
            <div className="flex items-center justify-between mb-4 text-sm">
              <div>
                <span className="font-semibold">Start:</span> {startTime.toFixed(2)}s
              </div>
              <div>
                <span className="font-semibold">End:</span> {endTime.toFixed(2)}s
              </div>
              <div>
                <span className="font-semibold">Duration:</span> {(endTime - startTime).toFixed(2)}s
              </div>
              {duration > 0 && (
                <div>
                  <span className="font-semibold">Total:</span> {duration.toFixed(2)}s
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="flex gap-2">
              <button
                onClick={handlePreview}
                disabled={isPlaying}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                <Play size={16} />
                Preview
              </button>
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
              >
                <Save size={16} />
                Save
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg transition-colors"
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

