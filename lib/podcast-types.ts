export interface PodcastChapter {
  index: number;
  title: string;
  slug: string;
  chunks: number;
  chars: number;
  duration_seconds: number;
  file: string;
}

export interface PodcastManifest {
  title: string;
  author: string;
  generated_at: string;
  total_chapters: number;
  total_speakable_chars: number;
  estimated_cost_inr: number;
  chapters: PodcastChapter[];
}
