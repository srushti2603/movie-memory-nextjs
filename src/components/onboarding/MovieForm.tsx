"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function MovieForm() {
  const router = useRouter();
  const [movie, setMovie] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    const response = await fetch("/api/me/movie", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ movie }),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(payload.error ?? "Unable to save your movie right now.");
      setIsSubmitting(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-lg space-y-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <div className="space-y-2">
        <label htmlFor="favorite-movie" className="text-sm font-medium text-slate-700">
          Favorite movie
        </label>
        <input
          id="favorite-movie"
          name="movie"
          value={movie}
          onChange={(event) => setMovie(event.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
          placeholder="e.g. The Matrix"
          maxLength={120}
        />
      </div>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex w-full items-center justify-center rounded-lg bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Saving..." : "Continue to dashboard"}
      </button>
    </form>
  );
}
