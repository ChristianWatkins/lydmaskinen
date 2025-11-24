export interface PadData {
  id: string;
  audioBlob?: Blob;
  audioUrl?: string;
  effect: 'none' | 'smurf' | 'troll';
  reverse: boolean;
  volume: number; // 0.0 to 1.0
}

