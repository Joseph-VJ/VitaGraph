export interface AppActivity {
  agentBusy: boolean;
  upload: { stage: 0 | 1 | 2 | 3 | 4 } | null;
  finished: number;
}

let currentActivity: AppActivity = {
  agentBusy: false,
  upload: null,
  finished: 0,
};

const listeners = new Set<(activity: AppActivity) => void>();

export function getActivity(): AppActivity {
  return currentActivity;
}

export function setActivity(update: Partial<AppActivity>): void {
  currentActivity = { ...currentActivity, ...update };
  listeners.forEach((listener) => {
    try {
      listener(currentActivity);
    } catch {
      /* ignore listener error */
    }
  });
}

export function subscribe(listener: (activity: AppActivity) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
