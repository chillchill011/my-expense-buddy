import { queryOptions } from "@tanstack/react-query";

import { getExpenseDashboard, type DashboardResult } from "./expense.functions";

export const dashboardQueryOptions = queryOptions<DashboardResult>({
  queryKey: ["expense-dashboard"],
  queryFn: () => getExpenseDashboard(),
  staleTime: 60_000,
  gcTime: 10 * 60_000,
});
