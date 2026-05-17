'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

// Small delete control for each founder row on /app. Confirms first (native
// confirm; quick to ship, dark-aesthetic UI dialogs are post-hackathon).
// Hits DELETE /api/founders/[id], then refreshes the route so the server
// component re-fetches the list.

export function DeleteFounderButton({
  founderId,
  founderName,
}: {
  founderId: string;
  founderName: string;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function onDelete() {
    if (deleting) return;
    const confirmed = window.confirm(
      `Delete founder "${founderName}"? Voice profile, project link, and any cached state will be lost.`,
    );
    if (!confirmed) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/founders/${founderId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(`Delete failed: ${data.error ?? res.statusText}`);
        setDeleting(false);
        return;
      }
      router.refresh();
    } catch (err) {
      alert(`Delete failed: ${err instanceof Error ? err.message : 'unknown error'}`);
      setDeleting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onDelete}
      disabled={deleting}
      title={`Delete ${founderName}`}
      aria-label={`Delete ${founderName}`}
      className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/12 text-white/30 transition-colors hover:border-of-orange/60 hover:bg-of-orange/10 hover:text-of-orange disabled:opacity-40"
    >
      {deleting ? (
        <span className="block h-2 w-2 animate-pulse rounded-full bg-of-orange" />
      ) : (
        <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <line x1="3" y1="3" x2="9" y2="9" />
          <line x1="9" y1="3" x2="3" y2="9" />
        </svg>
      )}
    </button>
  );
}
