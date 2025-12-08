import DashboardClient from "./page.client";

export const dynamic = "force-static";

export default async function DashboardPage() {
  return <DashboardClient />;
}
