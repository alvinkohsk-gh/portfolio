"use client";

import { useSyncExternalStore } from "react";
import * as store from "./store";

/** Reads/writes the portfolio from a module-level store backed by
 * localStorage. No React context or provider is needed - components just
 * call this hook directly. */
export function usePortfolio() {
  const state = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot
  );

  return {
    state,
    addTransaction: store.addTransaction,
    updateTransaction: store.updateTransaction,
    deleteTransaction: store.deleteTransaction,
    setPrice: store.setPrice,
    setLivePrices: store.setLivePrices,
    addWatchlistItem: store.addWatchlistItem,
    removeWatchlistItem: store.removeWatchlistItem,
    setCurrency: store.setCurrency,
    addPortfolio: store.addPortfolio,
    renamePortfolio: store.renamePortfolio,
    deletePortfolio: store.deletePortfolio,
    setActivePortfolio: store.setActivePortfolio,
    replaceState: store.replaceState,
    resetToSample: store.resetToSample,
    clearAll: store.clearAll,
  };
}
