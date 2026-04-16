import { DEFAULT_LOCATIONS } from './locations';
import { replaceOrderedOptions, subscribeOrderedOptions } from './orderedOptionsStore';

export function subscribeLocations(onData: (locations: string[]) => void, onError?: (err: unknown) => void) {
  return subscribeOrderedOptions('incident_locations', DEFAULT_LOCATIONS, onData, onError);
}

export async function replaceLocations(locations: string[]) {
  await replaceOrderedOptions('incident_locations', locations, DEFAULT_LOCATIONS);
}

