import { queryOptions } from "@tanstack/react-query";

import { getExpenseDashboard, type DashboardResult } from "./expense.functions";

export const dashboardQueryOptions = queryOptions<DashboardResult>({
  queryKey: ["expense-dashboard"],
  queryFn: () => getExpenseDashboard(),
  // One dropped connection shouldn't blank the page — retry briefly before
  // surfacing the friendly error screen.
  retry: 2,
  retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 4000),
  staleTime: 5 * 60_000,
  gcTime: 10 * 60_000,
  refetchOnWindowFocus: false,
});
