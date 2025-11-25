export interface PadData {
  id: string;
  audioBlob?: Blob;
  audioUrl?: string;
  effect: 'none' | 'smurf' | 'troll';
  reverse: boolean;
  volume: number; // 0 to 10
  reverb: boolean;
  reverbTime?: number; // seconds (Pizzicato time parameter)
  reverbDecay?: number; // Pizzicato decay parameter (0-10)
  reverbMix?: number; // Pizzicato mix parameter (0-1, wet signal)
  startTime?: number; // Trim start point in seconds (default: 0)
  endTime?: number; // Trim end point in seconds (default: audio duration)
}

export interface SequenceEvent {
  padId: string;
  timestamp: number; // Relative time in milliseconds from sequence start
  padData: PadData; // Snapshot of padData at time of play
}

export interface Sequence {
  events: SequenceEvent[];
  startTime: number; // Always 0 (recording start reference)
  endTime: number; // Duration in milliseconds
}

