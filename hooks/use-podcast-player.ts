"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PodcastChapter, PodcastManifest } from "@/lib/podcast-types";

const STORAGE_KEY = "podcast-progress-v1";
const AVAILABLE_RATES = [0.9, 0.95, 1, 1.25, 1.5, 2] as const;
const TIMEUPDATE_THROTTLE_MS = 250;
const SAVE_DEBOUNCE_MS = 5000;

interface StoredProgress {
  chapterIndex: number;
  currentTime: number;
  playbackRate: number;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function loadProgress(): StoredProgress | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredProgress;
  } catch {
    return null;
  }
}

function saveProgress(progress: StoredProgress): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {}
}

function getAudioUrl(chapter: PodcastChapter): string {
  const base = process.env.NEXT_PUBLIC_R2_BASE_URL ?? "";
  return `${base}/podcast/${chapter.file}`;
}

export function usePodcastPlayer() {
  const [manifest, setManifest] = useState<PodcastManifest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedPercentage, setBufferedPercentage] = useState(0);
  const [playbackRate, setPlaybackRateState] = useState(1);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastTimeupdateRef = useRef(0);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const manifestRef = useRef<PodcastManifest | null>(null);
  const chapterIndexRef = useRef(0);
  const restoredTimeRef = useRef<number | null>(null);
  const playAfterLoadRef = useRef(false);

  manifestRef.current = manifest;
  chapterIndexRef.current = currentChapterIndex;

  const chapters = manifest?.chapters ?? [];
  const currentChapter: PodcastChapter | null = chapters[currentChapterIndex] ?? null;
  const hasNextChapter = currentChapterIndex < chapters.length - 1;
  const hasPrevChapter = currentChapterIndex > 0;
  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;
  const formattedCurrentTime = formatTime(currentTime);
  const formattedDuration = formatTime(duration);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = "metadata";
    audioRef.current = audio;

    audio.addEventListener("loadedmetadata", () => {
      setDuration(audio.duration);

      if (restoredTimeRef.current !== null && restoredTimeRef.current < audio.duration) {
        audio.currentTime = restoredTimeRef.current;
        setCurrentTime(restoredTimeRef.current);
        restoredTimeRef.current = null;
      }

      if (playAfterLoadRef.current) {
        playAfterLoadRef.current = false;
        audio.play().catch(() => {});
      }
    });

    audio.addEventListener("timeupdate", () => {
      const now = Date.now();
      if (now - lastTimeupdateRef.current < TIMEUPDATE_THROTTLE_MS) return;
      lastTimeupdateRef.current = now;
      setCurrentTime(audio.currentTime);

      if (!saveTimerRef.current) {
        saveTimerRef.current = setTimeout(() => {
          saveTimerRef.current = null;
          const a = audioRef.current;
          if (!a) return;
          saveProgress({
            chapterIndex: chapterIndexRef.current,
            currentTime: a.currentTime,
            playbackRate: a.playbackRate,
          });
        }, SAVE_DEBOUNCE_MS);
      }
    });

    audio.addEventListener("progress", () => {
      if (audio.buffered.length > 0 && audio.duration > 0) {
        const end = audio.buffered.end(audio.buffered.length - 1);
        setBufferedPercentage((end / audio.duration) * 100);
      }
    });

    audio.addEventListener("play", () => setIsPlaying(true));

    audio.addEventListener("pause", () => {
      setIsPlaying(false);
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      saveProgress({
        chapterIndex: chapterIndexRef.current,
        currentTime: audio.currentTime,
        playbackRate: audio.playbackRate,
      });
    });

    audio.addEventListener("ended", () => {
      setIsPlaying(false);
      const m = manifestRef.current;
      const idx = chapterIndexRef.current;
      if (m && idx < m.chapters.length - 1) {
        const nextIdx = idx + 1;
        chapterIndexRef.current = nextIdx;
        setCurrentChapterIndex(nextIdx);
        setCurrentTime(0);
        setDuration(0);
        setBufferedPercentage(0);
        playAfterLoadRef.current = true;
        audio.src = getAudioUrl(m.chapters[nextIdx]);
        audio.load();
        saveProgress({ chapterIndex: nextIdx, currentTime: 0, playbackRate: audio.playbackRate });
      }
    });

    audio.addEventListener("error", () => {
      setError(audio.error?.message ?? "Audio playback error");
      setIsPlaying(false);
    });

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveProgress({
        chapterIndex: chapterIndexRef.current,
        currentTime: audio.currentTime,
        playbackRate: audio.playbackRate,
      });
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchManifest() {
      try {
        const res = await fetch("/data/podcast.json");
        if (!res.ok) throw new Error(`Failed to fetch podcast manifest: ${res.status}`);
        const data = (await res.json()) as PodcastManifest;
        if (cancelled) return;

        setManifest(data);
        manifestRef.current = data;

        const saved = loadProgress();
        const audio = audioRef.current;
        if (!audio) return;

        let startIndex = 0;
        let startTime = 0;
        let rate = 1;

        if (saved && saved.chapterIndex < data.chapters.length) {
          startIndex = saved.chapterIndex;
          startTime = saved.currentTime;
          rate = AVAILABLE_RATES.includes(saved.playbackRate as (typeof AVAILABLE_RATES)[number])
            ? saved.playbackRate
            : 1;
        }

        chapterIndexRef.current = startIndex;
        setCurrentChapterIndex(startIndex);
        setPlaybackRateState(rate);
        audio.playbackRate = rate;

        const chapter = data.chapters[startIndex];
        if (chapter) {
          if (startTime > 0) {
            restoredTimeRef.current = startTime;
          }
          audio.src = getAudioUrl(chapter);
          audio.load();
        }
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load podcast data");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchManifest();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator) || !currentChapter) {
      return;
    }
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentChapter.title,
      artist: "Subhash Choudhary",
      album: "The Accidental CTO",
    });
  }, [currentChapter]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;

    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ["play", () => audioRef.current?.play()],
      ["pause", () => audioRef.current?.pause()],
      [
        "previoustrack",
        () => {
          const idx = chapterIndexRef.current;
          const m = manifestRef.current;
          if (m && idx > 0) {
            const prevIdx = idx - 1;
            const audio = audioRef.current;
            chapterIndexRef.current = prevIdx;
            setCurrentChapterIndex(prevIdx);
            setCurrentTime(0);
            setDuration(0);
            setBufferedPercentage(0);
            playAfterLoadRef.current = true;
            if (audio) {
              audio.src = getAudioUrl(m.chapters[prevIdx]);
              audio.load();
            }
          }
        },
      ],
      [
        "nexttrack",
        () => {
          const idx = chapterIndexRef.current;
          const m = manifestRef.current;
          if (m && idx < m.chapters.length - 1) {
            const nextIdx = idx + 1;
            const audio = audioRef.current;
            chapterIndexRef.current = nextIdx;
            setCurrentChapterIndex(nextIdx);
            setCurrentTime(0);
            setDuration(0);
            setBufferedPercentage(0);
            playAfterLoadRef.current = true;
            if (audio) {
              audio.src = getAudioUrl(m.chapters[nextIdx]);
              audio.load();
            }
          }
        },
      ],
      [
        "seekbackward",
        () => {
          const a = audioRef.current;
          if (a) {
            a.currentTime = Math.max(0, a.currentTime - 15);
            setCurrentTime(a.currentTime);
          }
        },
      ],
      [
        "seekforward",
        () => {
          const a = audioRef.current;
          if (a) {
            a.currentTime = Math.min(a.duration || 0, a.currentTime + 30);
            setCurrentTime(a.currentTime);
          }
        },
      ],
    ];

    for (const [action, handler] of handlers) {
      navigator.mediaSession.setActionHandler(action, handler);
    }

    return () => {
      for (const [action] of handlers) {
        navigator.mediaSession.setActionHandler(action, null);
      }
    };
  }, []);

  const play = useCallback(() => {
    audioRef.current?.play().catch(() => {});
  }, []);

  const pause = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio?.src) return;
    if (audio.paused) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, []);

  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(audio.duration || 0, time));
    setCurrentTime(audio.currentTime);
  }, []);

  const seekByPercentage = useCallback((pct: number) => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    audio.currentTime = (pct / 100) * audio.duration;
    setCurrentTime(audio.currentTime);
  }, []);

  const skipForward = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 30);
    setCurrentTime(audio.currentTime);
  }, []);

  const skipBackward = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, audio.currentTime - 15);
    setCurrentTime(audio.currentTime);
  }, []);

  const goToChapter = useCallback((index: number) => {
    const m = manifestRef.current;
    if (!m || index < 0 || index >= m.chapters.length) return;

    const chapter = m.chapters[index];
    const audio = audioRef.current;

    chapterIndexRef.current = index;
    setCurrentChapterIndex(index);
    setCurrentTime(0);
    setDuration(0);
    setBufferedPercentage(0);
    restoredTimeRef.current = null;
    playAfterLoadRef.current = true;

    if (audio) {
      audio.src = getAudioUrl(chapter);
      audio.load();
    }

    saveProgress({ chapterIndex: index, currentTime: 0, playbackRate: audio?.playbackRate ?? 1 });
  }, []);

  const nextChapter = useCallback(() => {
    const idx = chapterIndexRef.current;
    const m = manifestRef.current;
    if (m && idx < m.chapters.length - 1) {
      goToChapter(idx + 1);
    }
  }, [goToChapter]);

  const prevChapter = useCallback(() => {
    const idx = chapterIndexRef.current;
    if (idx > 0) {
      goToChapter(idx - 1);
    }
  }, [goToChapter]);

  const setPlaybackRate = useCallback((rate: number) => {
    const audio = audioRef.current;
    if (audio) {
      audio.playbackRate = rate;
    }
    setPlaybackRateState(rate);
    if (audio) {
      saveProgress({
        chapterIndex: chapterIndexRef.current,
        currentTime: audio.currentTime,
        playbackRate: rate,
      });
    }
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const tag = target.tagName.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (target.isContentEditable) return;

      const audio = audioRef.current;
      if (!audio) return;

      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          if (audio.paused) {
            audio.play().catch(() => {});
          } else {
            audio.pause();
          }
          break;
        case "ArrowLeft":
          e.preventDefault();
          audio.currentTime = Math.max(0, audio.currentTime - 15);
          setCurrentTime(audio.currentTime);
          break;
        case "ArrowRight":
          e.preventDefault();
          audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 30);
          setCurrentTime(audio.currentTime);
          break;
        case "[":
          e.preventDefault();
          if (chapterIndexRef.current > 0) {
            goToChapter(chapterIndexRef.current - 1);
          }
          break;
        case "]":
          e.preventDefault();
          if (
            manifestRef.current &&
            chapterIndexRef.current < manifestRef.current.chapters.length - 1
          ) {
            goToChapter(chapterIndexRef.current + 1);
          }
          break;
        case "P":
          if (e.shiftKey) {
            e.preventDefault();
            if (chapterIndexRef.current > 0) {
              goToChapter(chapterIndexRef.current - 1);
            }
          }
          break;
        case "N":
          if (e.shiftKey) {
            e.preventDefault();
            if (
              manifestRef.current &&
              chapterIndexRef.current < manifestRef.current.chapters.length - 1
            ) {
              goToChapter(chapterIndexRef.current + 1);
            }
          }
          break;
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [goToChapter]);

  return {
    manifest,
    isLoading,
    error,
    currentChapter,
    currentChapterIndex,
    isPlaying,
    currentTime,
    duration,
    bufferedPercentage,
    playbackRate,
    formattedCurrentTime,
    formattedDuration,
    progressPercentage,
    play,
    pause,
    togglePlay,
    seek,
    seekByPercentage,
    skipForward,
    skipBackward,
    nextChapter,
    prevChapter,
    goToChapter,
    setPlaybackRate,
    hasNextChapter,
    hasPrevChapter,
  };
}
