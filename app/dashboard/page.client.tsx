"use client";

import { useSyncExternalStore } from "react";
import LeetCodeDashboard from "@/components/LeetCodeDashboard";
import {
  subscribeToDashboard,
  getDashboardSnapshot,
  getDashboardServerSnapshot,
  retryDashboard,
} from "@/lib/dashboard-store";

export default function DashboardClient() {
  const { data, loading, error } = useSyncExternalStore(
    subscribeToDashboard,
    getDashboardSnapshot,
    getDashboardServerSnapshot
  );

  return (
    <div className="container mx-auto py-8">
      <LeetCodeDashboard index={data} loading={loading} error={error} onRetry={retryDashboard} />
    </div>
  );
}
