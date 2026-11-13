import OpenAI from "openai";

import { prisma } from "@/lib/prisma";

// Reusing a fact for a short window keeps repeated refreshes fast without stale data living too long.
const FACT_CACHE_WINDOW_MS = 60_000;
// A short external call timeout prevents the dashboard from hanging on a slow or blocked OpenAI request.
const OPENAI_TIMEOUT_MS = 10_000;

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: OPENAI_TIMEOUT_MS,
      maxRetries: 1,
    })
  : null;

export type FactResult = {
  factText: string;
  source: "cache" | "generated" | "loading" | "error";
  cached: boolean;
};

export async function getFactByIdForUser(factId: string, requesterUserId: string) {
  const fact = await prisma.movieFact.findUnique({
    where: { id: factId },
  });

  if (!fact) {
    throw new Error("Fact not found.");
  }

  // Fact IDs are not ownership tokens; this block prevents one user from reading another user's cached record.
  if (fact.userId !== requesterUserId) {
    throw new Error("You are not allowed to view this fact.");
  }

  return fact;
}

async function findLatestFact(userId: string, movieTitle: string) {
  return prisma.movieFact.findFirst({
    where: {
      userId,
      movieTitle,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

function isFresh(createdAt: Date): boolean {
  return Date.now() - new Date(createdAt).getTime() < FACT_CACHE_WINDOW_MS;
}

export async function getMovieFactForUser(
  userId: string,
  movieTitle: string,
): Promise<FactResult> {
  const normalizedMovie = movieTitle.trim();

  // 1. Fast path: a fact younger than 60 seconds is returned as-is.
  const latestFact = await findLatestFact(userId, normalizedMovie);

  if (latestFact && isFresh(latestFact.createdAt)) {
    return {
      factText: latestFact.factText,
      source: "cache",
      cached: true,
    };
  }

  // A compare-and-set lock prevents duplicate fact generation when the same user refreshes or clicks quickly.
  const lockAcquired = await acquireFactGenerationLock(userId);
  if (!lockAcquired) {
    // Another request is already generating. Serve what we have.
    const fallback = await findLatestFact(userId, normalizedMovie);

    return {
      factText:
        fallback?.factText ??
        "A fact is being generated right now. Please refresh in a moment.",
      source: fallback ? "cache" : "loading",
      cached: Boolean(fallback),
    };
  }

  try {
    // Re-checking after the lock avoids racing with another request that finished generating in the gap.
    const recheck = await findLatestFact(userId, normalizedMovie);
    if (recheck && isFresh(recheck.createdAt)) {
      return {
        factText: recheck.factText,
        source: "cache",
        cached: true,
      };
    }

    // 4. Generate, store, and return a new fact.
    const factText = await generateMovieFact(normalizedMovie);
    const savedFact = await prisma.movieFact.create({
      data: {
        userId,
        movieTitle: normalizedMovie,
        factText,
      },
    });

    return {
      factText: savedFact.factText,
      source: "generated",
      cached: false,
    };
  } catch (error) {
    // Falling back to the latest cached fact keeps the dashboard useful when a transient API issue interrupts generation.
    const fallback = await findLatestFact(userId, normalizedMovie);

    if (fallback) {
      return {
        factText: fallback.factText,
        source: "cache",
        cached: true,
      };
    }

    return {
      factText: "We couldn't generate a movie fact right now. Please try again in a moment.",
      source: "error",
      cached: false,
    };
  } finally {
    await prisma.user.updateMany({
      where: {
        id: userId,
        factGenerationInProgress: true,
      },
      data: {
        factGenerationInProgress: false,
      },
    });
  }
}

// Atomic compare-and-set: only one request can flip the flag from false to true.
async function acquireFactGenerationLock(userId: string): Promise<boolean> {
  // This updateMany compare-and-set serializes generation attempts by flipping the flag only when it is currently false.
  const result = await prisma.user.updateMany({
    where: {
      id: userId,
      factGenerationInProgress: false,
    },
    data: {
      factGenerationInProgress: true,
    },
  });

  return result.count === 1;
}

const MOCK_FACTS = [
  (movie: string) => `${movie} has a loyal fan base that still discusses its details years after release.`,
  (movie: string) => `The production of ${movie} involved months of planning before cameras ever rolled.`,
  (movie: string) => `${movie} is often cited by fans as one of their go-to movies to rewatch.`,
];

async function generateMovieFact(movieTitle: string): Promise<string> {
  // Dev/test stand-in because no OpenAI credits were available; the real OpenAI call below is implemented but untested live.
  if (process.env.MOCK_OPENAI === "true") {
    const pick = MOCK_FACTS[Math.floor(Math.random() * MOCK_FACTS.length)];
    return pick(movieTitle);
  }

  if (!openai) {
    throw new Error("OpenAI is not configured. Add OPENAI_API_KEY to continue.");
  }

  const response = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    temperature: 0.7,
    messages: [
      {
        role: "user",
        //content: `Give me one short, fun, accurate fact about the movie ${movieTitle}. Keep it to one sentence and avoid hedging.`,
        content: `Give me one surprising, lighthearted fun fact about the movie ${movieTitle}. Keep it to one sentence, make it specific and accurate, and don't invent details you aren't sure of.`,
      },
    ],
  });

  const factText = response.choices[0]?.message?.content?.trim();
  if (!factText) {
    throw new Error("OpenAI returned no fact.");
  }

  return factText;
}