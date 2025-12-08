import { NextResponse } from "next/server";
import { getTopics } from "@/lib/database";

const CACHE_FOREVER = "public, s-maxage=31536000, max-age=31536000, immutable";

export async function GET() {
  try {
    const topics = await getTopics();

    return NextResponse.json(
      {
        topics,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": CACHE_FOREVER,
        },
      }
    );
  } catch (error) {
    console.error("Error fetching topics:", error);
    return NextResponse.json({ error: "Failed to load topics from database" }, { status: 500 });
  }
}
