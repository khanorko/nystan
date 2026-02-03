import type { TriggerType, MediaObject } from './index';

// Trigger-status för state machine
export type TriggerStatus = 'idle' | 'armed' | 'triggered' | 'completed';

// Kedjevillkor - vad som krävs för att arma en trigger
export interface ChainCondition {
  type: 'afterTrigger' | 'allOf' | 'anyOf' | 'timer' | 'never';

  // För 'afterTrigger': kräver att specifik trigger har triggered/completed
  triggerId?: string;

  // För 'allOf'/'anyOf': lista av trigger-IDs
  triggerIds?: string[];

  // Fördröjning efter föregående trigger (ms)
  delayMs?: number;
}

// Sub-trigger content
export interface SubTriggerContent {
  title: string;
  text?: string;
  audioBlob?: Blob;
  imageBlob?: Blob;
  url?: string;
  autoOpen?: boolean;
}

// Sub-trigger - trigger som endast är aktiv INUTI en annan triggers radie
export interface SubTrigger {
  id: string;
  type: Exclude<TriggerType, 'gps'>; // Kan inte vara GPS (redan inom radie)
  params: Record<string, unknown>;
  content: SubTriggerContent;
}

// Utökat MediaObject med kedjedata
export interface ChainedMediaObject extends MediaObject {
  // Kedjevillkor för att arma denna trigger
  armCondition?: ChainCondition;

  // Sub-triggers (aktiveras när användaren är inom huvudtriggerns radie)
  subTriggers?: SubTrigger[];

  // Referens till kedja (om del av en kedja)
  chainId?: string;

  // Position i kedjan (för sekventiella kedjor)
  chainOrder?: number;

  // Kan triggas flera gånger?
  repeatable?: boolean;

  // Timeout innan trigger återställs (ms), null = aldrig återställ
  resetTimeout?: number | null;
}

// Kedja - grupperar relaterade triggers
export interface TriggerChain {
  id: string;
  title: string;
  description?: string;

  // Ordning: 'sequential' = måste triggas i ordning, 'parallel' = vilken ordning som helst
  mode: 'sequential' | 'parallel';

  // Start-trigger (första som användaren kan se)
  entryTriggerId: string;

  // Alla trigger-IDs i kedjan
  triggerIds: string[];

  // Metadata
  createdAt: number;
  updatedAt?: number;
}

// Export för kedjor (för delning)
export interface ChainExport {
  version: number;
  chain: TriggerChain;
  objects: ChainedMediaObject[];
  // Base64-encoded media (utan blobs för URL-delning)
  media?: {
    [objectId: string]: {
      image?: string;
      audio?: string;
    };
  };
}
