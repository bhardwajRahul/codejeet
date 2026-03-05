import type { Metadata } from "next";
import HomeClient from "./page.client";

export const metadata: Metadata = {
  title: "CodeJeet - Company-wise LeetCode Interview Questions",
  description:
    "Browse 17,000+ company-wise LeetCode DSA interview questions from 660+ companies. " +
    "Filter by company, topic, and difficulty. Practice smarter for your next tech interview.",
  alternates: { canonical: "https://codejeet.com" },
  openGraph: {
    title: "CodeJeet - Company-wise LeetCode Interview Questions",
    description:
      "Browse 17,000+ company-wise LeetCode DSA interview questions from 660+ companies.",
    url: "https://codejeet.com",
    type: "website",
  },
};

export default function Home() {
  return <HomeClient />;
}
