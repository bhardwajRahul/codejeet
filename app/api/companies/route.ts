import { NextResponse } from "next/server";
import { getCompanies } from "@/lib/data";

const CACHE_FOREVER = "public, s-maxage=31536000, max-age=31536000, immutable";

export async function GET() {
  try {
    const companies = await getCompanies();

    return NextResponse.json(
      {
        companies: companies,
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
    return NextResponse.json({ error: "Failed to load companies" }, { status: 500 });
  }
}
