export interface PadData {
  id: string;
  audioBlob?: Blob;
  audioUrl?: string;
  effect: 'none' | 'smurf' | 'troll';
  reverse: boolean;
}

