export const queryKeys = {
  prices: {
    all: ['prices'] as const,
    summary: () => [...queryKeys.prices.all, 'summary'] as const,
    compare: (category: string) =>
      [...queryKeys.prices.all, 'compare', category] as const,
    trend: (category: string) =>
      [...queryKeys.prices.all, 'trend', category] as const
  },
  commodities: {
    all: ['commodities'] as const,
    latest: () => [...queryKeys.commodities.all, 'latest'] as const,
    changes: () => [...queryKeys.commodities.all, 'changes'] as const,
    history: (symbol: string, startDate: string) =>
      [...queryKeys.commodities.all, 'history', symbol, startDate] as const
  }
} as const;
