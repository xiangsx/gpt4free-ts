import { AsyncLocalStorage } from 'async_hooks';

export type StoreSN = {
  sn?: string;
};
export const AsyncStoreSN = new AsyncLocalStorage<StoreSN>();
