import { NextResponse } from "next/server";
import { getCompanies } from "@/lib/database";

const CACHE_FOREVER = "public, s-maxage=31536000, max-age=31536000, immutable";

export async function GET() {
  try {
    const companies = await getCompanies();

    return NextResponse.json(
      {
        companies: companies.map((c) => c.name),
      },
      {
        status: 200,
        headers: {
          "Cache-Control": CACHE_FOREVER,
        },
      }
    );
  } catch (error) {
    console.error("Error fetching companies:", error);
    return NextResponse.json({ error: "Failed to load companies from database" }, { status: 500 });
  }
}
