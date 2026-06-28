import type { Metadata } from "next";
import DashboardClient from "./page.client";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Practice Questions",
  description:
    "Browse through 15,000+ DSA questions asked in technical interviews at 700+ companies. " +
    "Filter by company, topic, and difficulty.",
  alternates: { canonical: "https://codejeet.com/dashboard" },
};

export default async function DashboardPage() {
  return <DashboardClient />;
}
