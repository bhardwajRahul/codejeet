import { redirect } from "next/navigation";
import { SYSTEM_DESIGN_CHAPTERS } from "@/lib/system-design/generated";

export const dynamicParams = true;

export default async function SystemDesignIndexRedirect() {
  const items = SYSTEM_DESIGN_CHAPTERS.map((chapter) => {
    const title = chapter.title || chapter.heading || chapter.folder;
    return { slug: chapter.slug, order: chapter.order, title };
  });

  if (items.length === 0) {
    redirect("/");
  }

  items.sort((a, b) => (a.order !== b.order ? a.order - b.order : a.title.localeCompare(b.title)));
  redirect(`/system-design/${encodeURIComponent(items[0].slug)}`);
}
