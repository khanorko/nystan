import type {
  ChainedMediaObject,
  TriggerStatus,
  TriggerChain,
} from '../types/chain';

// ===== STATE =====

interface ChainSessionState {
  // Status per trigger-ID
  triggerStatus: Map<string, TriggerStatus>;

  // Tidpunkt för senaste statusändring
  statusChangedAt: Map<string, number>;

  // Timer-IDs för fördröjda transitions
  pendingTimers: Map<string, number>;

  // Laddade kedjor
  chains: Map<string, TriggerChain>;

  // Alla objekt i sessionen (för villkorsutvärdering)
  objects: ChainedMediaObject[];
}

const sessionState: ChainSessionState = {
  triggerStatus: new Map(),
  statusChangedAt: new Map(),
  pendingTimers: new Map(),
  chains: new Map(),
  objects: [],
};

// ===== STATUS LISTENERS =====

type StatusChangeCallback = (
  triggerId: string,
  status: TriggerStatus,
  previous?: TriggerStatus
) => void;

const statusListeners = new Set<StatusChangeCallback>();

export function onStatusChange(callback: StatusChangeCallback): () => void {
  statusListeners.add(callback);
  return () => statusListeners.delete(callback);
}

function notifyStatusChange(
  triggerId: string,
  status: TriggerStatus,
  previous?: TriggerStatus
): void {
  statusListeners.forEach((cb) => cb(triggerId, status, previous));
}

// ===== CORE FUNCTIONS =====

/**
 * Hämta status för en trigger
 */
export function getTriggerStatus(triggerId: string): TriggerStatus {
  return sessionState.triggerStatus.get(triggerId) || 'idle';
}

/**
 * Uppdatera status för en trigger
 */
export function setTriggerStatus(triggerId: string, status: TriggerStatus): void {
  const previousStatus = sessionState.triggerStatus.get(triggerId);
  if (previousStatus === status) return;

  sessionState.triggerStatus.set(triggerId, status);
  sessionState.statusChangedAt.set(triggerId, Date.now());

  notifyStatusChange(triggerId, status, previousStatus);
}

/**
 * Kontrollera om en trigger ska armas baserat på villkor
 */
export function evaluateArmCondition(
  trigger: ChainedMediaObject,
  _allTriggers?: ChainedMediaObject[]
): boolean {
  // Ingen condition = alltid armed
  if (!trigger.armCondition) return true;

  const { type, triggerId, triggerIds, delayMs } = trigger.armCondition;

  switch (type) {
    case 'never':
      // Manuellt styrd (t.ex. via QR eller admin)
      return false;

    case 'afterTrigger':
      // Kräver att en specifik trigger har completed/triggered
      if (!triggerId) return true;
      const status = sessionState.triggerStatus.get(triggerId);
      if (status !== 'completed' && status !== 'triggered') return false;

      // Kontrollera fördröjning
      if (delayMs) {
        const changedAt = sessionState.statusChangedAt.get(triggerId) || 0;
        if (Date.now() - changedAt < delayMs) {
          // Schemalägg en ny utvärdering efter fördröjningen
          scheduleArmEvaluation(trigger.id, delayMs - (Date.now() - changedAt));
          return false;
        }
      }
      return true;

    case 'allOf':
      // Alla specificerade triggers måste vara completed/triggered
      return (triggerIds || []).every((id) => {
        const s = sessionState.triggerStatus.get(id);
        return s === 'completed' || s === 'triggered';
      });

    case 'anyOf':
      // Minst en av triggers måste vara completed/triggered
      return (triggerIds || []).some((id) => {
        const s = sessionState.triggerStatus.get(id);
        return s === 'completed' || s === 'triggered';
      });

    case 'timer':
      // Timer-villkor hanteras separat
      return true;

    default:
      return true;
  }
}

/**
 * Initiera session med triggers
 */
export function initializeSession(triggers: ChainedMediaObject[]): void {
  // Rensa tidigare state
  sessionState.triggerStatus.clear();
  sessionState.statusChangedAt.clear();
  sessionState.objects = triggers;
  clearAllTimers();

  // Försök återställa från localStorage
  const restored = restoreSessionState();

  if (!restored) {
    // Sätt initial status för alla triggers
    for (const trigger of triggers) {
      const initialStatus = evaluateArmCondition(trigger, triggers) ? 'armed' : 'idle';
      sessionState.triggerStatus.set(trigger.id, initialStatus);
    }
  }
}

/**
 * Bearbeta en trigger-aktivering
 * Returnerar true om triggern aktiverades, false om den inte kunde aktiveras
 */
export function processTriggerActivation(
  trigger: ChainedMediaObject,
  allTriggers?: ChainedMediaObject[]
): boolean {
  const currentStatus = getTriggerStatus(trigger.id);

  // Endast armed triggers kan aktiveras
  if (currentStatus !== 'armed') {
    return false;
  }

  // Sätt status till triggered
  setTriggerStatus(trigger.id, 'triggered');

  // Uppdatera relaterade triggers
  updateDependentTriggers(trigger.id, allTriggers || sessionState.objects);

  // Persistera state
  persistSessionState();

  return true;
}

/**
 * Markera trigger som slutförd (efter content visats)
 */
export function completeTrigger(
  triggerId: string,
  trigger?: ChainedMediaObject,
  allTriggers?: ChainedMediaObject[]
): void {
  const currentStatus = getTriggerStatus(triggerId);

  if (currentStatus !== 'triggered') return;

  const obj = trigger || sessionState.objects.find((o) => o.id === triggerId);
  const triggers = allTriggers || sessionState.objects;

  if (obj?.repeatable) {
    // Återställ till armed efter timeout
    const timeout = obj.resetTimeout ?? 30000;
    if (timeout > 0) {
      scheduleStatusChange(triggerId, 'armed', timeout);
    } else {
      setTriggerStatus(triggerId, 'armed');
    }
  } else {
    // Permanent completed
    setTriggerStatus(triggerId, 'completed');
  }

  // Uppdatera beroende triggers
  updateDependentTriggers(triggerId, triggers);

  // Persistera state
  persistSessionState();
}

/**
 * Uppdatera status för triggers som beror på en ändrad trigger
 */
function updateDependentTriggers(
  changedTriggerId: string,
  allTriggers: ChainedMediaObject[]
): void {
  for (const trigger of allTriggers) {
    if (trigger.id === changedTriggerId) continue;

    const currentStatus = getTriggerStatus(trigger.id);
    if (currentStatus !== 'idle') continue;

    // Kontrollera om villkoret nu är uppfyllt
    if (evaluateArmCondition(trigger, allTriggers)) {
      setTriggerStatus(trigger.id, 'armed');
    }
  }
}

// ===== HELPERS =====

function scheduleStatusChange(
  triggerId: string,
  newStatus: TriggerStatus,
  delayMs: number
): void {
  // Avbryt eventuell existerande timer
  const existingTimer = sessionState.pendingTimers.get(triggerId);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  const timerId = window.setTimeout(() => {
    setTriggerStatus(triggerId, newStatus);
    sessionState.pendingTimers.delete(triggerId);
    persistSessionState();
  }, delayMs);

  sessionState.pendingTimers.set(triggerId, timerId);
}

function scheduleArmEvaluation(triggerId: string, delayMs: number): void {
  const existingTimer = sessionState.pendingTimers.get(`arm-${triggerId}`);
  if (existingTimer) return; // Redan schemalagd

  const timerId = window.setTimeout(() => {
    const trigger = sessionState.objects.find((o) => o.id === triggerId);
    if (trigger && getTriggerStatus(triggerId) === 'idle') {
      if (evaluateArmCondition(trigger)) {
        setTriggerStatus(triggerId, 'armed');
        persistSessionState();
      }
    }
    sessionState.pendingTimers.delete(`arm-${triggerId}`);
  }, delayMs);

  sessionState.pendingTimers.set(`arm-${triggerId}`, timerId);
}

function clearAllTimers(): void {
  sessionState.pendingTimers.forEach((id) => clearTimeout(id));
  sessionState.pendingTimers.clear();
}

// ===== PERSISTENCE =====

const STORAGE_KEY = 'kontextlager_chain_state';

/**
 * Spara session-state till localStorage (för PWA offline)
 */
export function persistSessionState(): void {
  try {
    const data = {
      triggerStatus: Array.from(sessionState.triggerStatus.entries()),
      statusChangedAt: Array.from(sessionState.statusChangedAt.entries()),
      timestamp: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // localStorage kan vara full eller otillgänglig
  }
}

/**
 * Återställ session-state från localStorage
 */
function restoreSessionState(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return false;

    const data = JSON.parse(stored);

    // Kontrollera att datan inte är för gammal (max 24h)
    if (Date.now() - data.timestamp > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(STORAGE_KEY);
      return false;
    }

    sessionState.triggerStatus = new Map(data.triggerStatus);
    sessionState.statusChangedAt = new Map(data.statusChangedAt);
    return true;
  } catch {
    return false;
  }
}

/**
 * Rensa all sparad state
 */
export function clearSessionState(): void {
  sessionState.triggerStatus.clear();
  sessionState.statusChangedAt.clear();
  sessionState.objects = [];
  clearAllTimers();
  localStorage.removeItem(STORAGE_KEY);
}

// ===== CHAIN MANAGEMENT =====

/**
 * Ladda en kedja
 */
export function loadChain(chain: TriggerChain): void {
  sessionState.chains.set(chain.id, chain);
}

/**
 * Hämta en kedja
 */
export function getChain(chainId: string): TriggerChain | undefined {
  return sessionState.chains.get(chainId);
}

/**
 * Hämta alla triggers i en kedja
 */
export function getChainTriggers(chainId: string): ChainedMediaObject[] {
  return sessionState.objects
    .filter((o) => o.chainId === chainId)
    .sort((a, b) => (a.chainOrder || 0) - (b.chainOrder || 0));
}

/**
 * Beräkna progress för en kedja (0-1)
 */
export function getChainProgress(chainId: string): number {
  const triggers = getChainTriggers(chainId);
  if (triggers.length === 0) return 0;

  const completed = triggers.filter(
    (t) => getTriggerStatus(t.id) === 'completed'
  ).length;
  return completed / triggers.length;
}

// ===== DEBUG =====

export function getSessionState(): ChainSessionState {
  return sessionState;
}
