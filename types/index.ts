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
}

