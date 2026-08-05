"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  MAX_NOTE_LENGTH,
  clearLocalNote,
  getLocalNote,
  setLocalNote,
  updateUserNote,
} from "@/utils/notesUtils";

export interface DashboardNoteTarget {
  slug: string;
  title: string;
}

interface DashboardNoteDialogProps {
  target: DashboardNoteTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSignedIn: boolean;
  /** Called after a successful local (and cloud, when signed in) write. */
  onNoteChange: (slug: string, note: string) => void;
}

type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * Body is mounted only while open so editor state is fresh each time
 * (and when switching problems) without a setState-in-effect reset.
 */
export function DashboardNoteDialog({
  target,
  open,
  onOpenChange,
  isSignedIn,
  onNoteChange,
}: DashboardNoteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && target ? (
        <DashboardNoteDialogBody
          key={target.slug}
          target={target}
          isSignedIn={isSignedIn}
          onNoteChange={onNoteChange}
        />
      ) : null}
    </Dialog>
  );
}

function DashboardNoteDialogBody({
  target,
  isSignedIn,
  onNoteChange,
}: {
  target: DashboardNoteTarget;
  isSignedIn: boolean;
  onNoteChange: (slug: string, note: string) => void;
}) {
  const [text, setText] = useState(() => getLocalNote(target.slug));
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const savingRef = useRef(false);
  const genRef = useRef(0);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    };
  }, []);

  const remaining = MAX_NOTE_LENGTH - text.length;
  const busy = saveState === "saving";
  const statusLabel =
    saveState === "saving"
      ? "Saving…"
      : saveState === "saved"
        ? "Saved"
        : saveState === "error"
          ? "Save failed"
          : null;

  const flashSaved = () => {
    setSaveState("saved");
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setSaveState("idle"), 1500);
  };

  const handleSave = async () => {
    if (savingRef.current) return;
    const gen = ++genRef.current;
    savingRef.current = true;
    setSaveState("saving");
    setLocalNote(target.slug, text);
    try {
      if (isSignedIn) {
        const ok = await updateUserNote(target.slug, text);
        if (gen !== genRef.current) return;
        if (!ok) {
          setSaveState("error");
          return;
        }
      }
      if (gen !== genRef.current) return;
      const stored = getLocalNote(target.slug);
      setText(stored);
      onNoteChange(target.slug, stored);
      flashSaved();
    } catch {
      if (gen === genRef.current) setSaveState("error");
    } finally {
      if (gen === genRef.current) savingRef.current = false;
    }
  };

  const handleClear = async () => {
    if (savingRef.current) return;
    const gen = ++genRef.current;
    savingRef.current = true;
    setSaveState("saving");
    const previous = getLocalNote(target.slug);
    clearLocalNote(target.slug);
    setText("");
    try {
      if (isSignedIn) {
        const ok = await updateUserNote(target.slug, "");
        if (gen !== genRef.current) return;
        if (!ok) {
          setLocalNote(target.slug, previous);
          setText(previous);
          setSaveState("error");
          return;
        }
      }
      if (gen !== genRef.current) return;
      onNoteChange(target.slug, "");
      flashSaved();
    } catch {
      if (gen === genRef.current) {
        setLocalNote(target.slug, previous);
        setText(previous);
        setSaveState("error");
      }
    } finally {
      if (gen === genRef.current) savingRef.current = false;
    }
  };

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle className="pr-6 text-base leading-snug">{target.title}</DialogTitle>
        <DialogDescription>
          Private revision notes for this problem
          {isSignedIn ? " · synced to your account" : " · saved on this device"}
        </DialogDescription>
      </DialogHeader>

      <textarea
        value={text}
        onChange={(e) => {
          const next = e.target.value;
          if (next.length <= MAX_NOTE_LENGTH) setText(next);
        }}
        placeholder="Patterns, edge cases, mistakes to avoid…"
        rows={6}
        maxLength={MAX_NOTE_LENGTH}
        disabled={busy}
        className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
        aria-label={`Personal note for ${target.title}`}
      />

      <DialogFooter className="flex-row items-center gap-2 sm:justify-between">
        <span className="text-xs text-muted-foreground tabular-nums">
          {statusLabel ? (
            <span
              className={
                saveState === "error"
                  ? "text-destructive"
                  : saveState === "saved"
                    ? "text-foreground"
                    : ""
              }
            >
              {statusLabel}
            </span>
          ) : (
            `${remaining} left`
          )}
        </span>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void handleClear()}
            disabled={busy || (!text && !getLocalNote(target.slug))}
          >
            Clear
          </Button>
          <Button type="button" size="sm" onClick={() => void handleSave()} disabled={busy}>
            Save note
          </Button>
        </div>
      </DialogFooter>
    </DialogContent>
  );
}
