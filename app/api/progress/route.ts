import { auth } from "@clerk/nextjs/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

// Reads Clerk identity + the D1 binding at request time — must be dynamic.
export const dynamic = "force-dynamic";

function db() {
  return getCloudflareContext().env.DB;
}

// GET -> { progress: { [slug]: solvedAtISO } }. Signed-out returns an empty map
// (200, not a redirect) so the client can call it unconditionally.
export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ progress: {} });

  const { results } = await db()
    .prepare("SELECT slug, solved_at FROM progress WHERE user_id = ?")
    .bind(userId)
    .all<{ slug: string; solved_at: string }>();

  const progress: Record<string, string> = {};
  for (const row of results ?? []) progress[row.slug] = row.solved_at;
  return Response.json({ progress });
}

// POST { slug, completed }. Check -> insert keeping the original solve date
// (ON CONFLICT DO NOTHING, so the revision clock never resets). Uncheck -> delete.
// user_id always comes from the server session, never the request body.
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  let body: { slug?: unknown; completed?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const { slug, completed } = body;
  if (typeof slug !== "string" || slug.length === 0 || slug.length > 256) {
    return new Response("Invalid slug", { status: 400 });
  }

  const d = db();
  if (completed) {
    await d
      .prepare(
        "INSERT INTO progress (user_id, slug, solved_at) VALUES (?, ?, ?) ON CONFLICT(user_id, slug) DO NOTHING"
      )
      .bind(userId, slug, new Date().toISOString())
      .run();
  } else {
    await d.prepare("DELETE FROM progress WHERE user_id = ? AND slug = ?").bind(userId, slug).run();
  }

  return Response.json({ ok: true });
}
