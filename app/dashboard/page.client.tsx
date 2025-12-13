"use client";

import { useEffect, useState } from "react";
import LeetCodeDashboard from "@/components/LeetCodeDashboard";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { CACHE_VERSION } from "@/lib/cache-version";

function getCachedData() {
  try {
    const cached = localStorage.getItem(`dashboard-cache-${CACHE_VERSION}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && Array.isArray(parsed.questions) && Array.isArray(parsed.companies)) {
        return { questions: parsed.questions, companies: parsed.companies };
      }
    }
  } catch {}
  return null;
}

export default function DashboardClient() {
  const { userId } = useAuth();
  const router = useRouter();
  const [questions, setQuestions] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const cached = getCachedData();
    if (cached) {
      queueMicrotask(() => {
        setQuestions(cached.questions);
        setCompanies(cached.companies);
        setLoading(false);
      });
      return;
    }

    fetch(`/api/questions?v=${CACHE_VERSION}`)
      .then((res) => res.json())
      .then((data) => {
        setQuestions(data.questions);
        setCompanies(data.companies);
        setLoading(false);
        try {
          localStorage.setItem(
            `dashboard-cache-${CACHE_VERSION}`,
            JSON.stringify({ questions: data.questions, companies: data.companies })
          );
        } catch {}
      })
      .catch((error) => {
        console.error("Error loading questions:", error);
        setLoading(false);
      });
  }, [userId]);

  useEffect(() => {
    if (!userId && !loading) {
      router.push("/");
    }
  }, [userId, loading, router]);

  return (
    <div className="container mx-auto py-8">
      <LeetCodeDashboard questions={questions} companies={companies} loading={loading || !userId} />
    </div>
  );
}
