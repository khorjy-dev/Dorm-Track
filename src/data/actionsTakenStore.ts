import { DEFAULT_ACTIONS_TAKEN } from './actionsTaken';
import { replaceOrderedOptions, subscribeOrderedOptions } from './orderedOptionsStore';

export function subscribeActionsTaken(onData: (actions: string[]) => void, onError?: (err: unknown) => void) {
  return subscribeOrderedOptions('incident_actions', DEFAULT_ACTIONS_TAKEN, onData, onError);
}

export async function replaceActionsTaken(actions: string[]) {
  await replaceOrderedOptions('incident_actions', actions, DEFAULT_ACTIONS_TAKEN);
}
