export type TriggerType =
  | 'gps'
  | 'qr'
  | 'shake'
  | 'tilt'
  | 'compass'
  | 'touch'
  | 'hold'
  | 'timer'
  | 'proximity'
  | 'dice'
  | 'code'
  | 'spinner'
  | 'ai';

export interface DiceFace {
  title: string;
  text?: string;
  url?: string;
  autoOpen?: boolean;
}

// Spinner/Roulette option
export interface SpinnerOption {
  id: string;
  label: string;
  color?: string;
  content?: {
    title: string;
    text?: string;
    url?: string;
    autoOpen?: boolean;
  };
  // Eller trigga en annan trigger
  chainToTriggerId?: string;
}

export interface Trigger {
  type: TriggerType;
  params: Record<string, unknown>;
}

export interface Location {
  lat: number;
  lng: number;
}

export interface MediaObject {
  id: string;
  title: string;
  text?: string;
  imageBlob?: Blob;
  audioBlob?: Blob;
  location: Location;
  radius: number;
  trigger: Trigger;
  active: boolean;
  requiresPresence?: number;
  diceContent?: DiceFace[];
  spinnerContent?: SpinnerOption[];
  // Kedjedata (för ChainedMediaObject kompatibilitet)
  chainId?: string;
  chainOrder?: number;
  armCondition?: import('./chain').ChainCondition;
  subTriggers?: import('./chain').SubTrigger[];
  repeatable?: boolean;
  resetTimeout?: number | null;
  createdAt: number;
}

export interface Session {
  id: string;
  objects: string[];
  createdAt: number;
}

export interface GeolocationState {
  position: GeolocationPosition | null;
  error: GeolocationPositionError | null;
  loading: boolean;
}

// Re-export chain types
export * from './chain';
