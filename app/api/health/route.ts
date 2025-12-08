import { NextResponse } from "next/server";

const CACHE_FOREVER = "public, s-maxage=31536000, max-age=31536000, immutable";

export async function GET() {
  return new NextResponse("OK", {
    status: 200,
    headers: {
      "Content-Type": "text/plain",
      "Cache-Control": CACHE_FOREVER,
    },
  });
}
