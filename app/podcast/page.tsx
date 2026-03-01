import PodcastClient from "./page.client";

export const dynamic = "force-static";

export const metadata = {
  title: "The Accidental CTO - Audiobook | CodeJeet",
  description:
    "Listen to The Accidental CTO by Subhash Choudhary. A system design journey from startup to scale.",
};

export default function PodcastPage() {
  return <PodcastClient />;
}
