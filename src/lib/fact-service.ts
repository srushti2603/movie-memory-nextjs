import OpenAI from "openai";

import { prisma } from "@/lib/prisma";

const FACT_CACHE_WINDOW_MS = 60_000;

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
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

  if (fact.userId !== requesterUserId) {
    throw new Error("You are not allowed to view this fact.");
  }

  return fact;
}

export async function getMovieFactForUser(
  userId: string,
  movieTitle: string,
): Promise<FactResult> {
  const normalizedMovie = movieTitle.trim();

  const latestFact = await prisma.movieFact.findFirst({
    where: {
      userId,
      movieTitle: normalizedMovie,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (
    latestFact &&
    Date.now() - new Date(latestFact.createdAt).getTime() < FACT_CACHE_WINDOW_MS
  ) {
    return {
      factText: latestFact.factText,
      source: "cache",
      cached: true,
    };
  }

  const lockAcquired = await acquireFactGenerationLock(userId);
  if (!lockAcquired) {
    const fallback = await prisma.movieFact.findFirst({
      where: {
        userId,
        movieTitle: normalizedMovie,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return {
      factText:
        fallback?.factText ??
        "A fact is being generated right now. Please refresh in a moment.",
      source: fallback ? "cache" : "loading",
      cached: Boolean(fallback),
    };
  }

  try {
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
    const fallback = await prisma.movieFact.findFirst({
      where: {
        userId,
        movieTitle: normalizedMovie,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

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

async function acquireFactGenerationLock(userId: string): Promise<boolean> {
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

async function generateMovieFact(movieTitle: string): Promise<string> {
  if (!openai) {
    throw new Error("OpenAI is not configured. Add OPENAI_API_KEY to continue.");
  }

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.7,
    messages: [
      {
        role: "user",
        content: `Give me one short, fun, accurate fact about the movie ${movieTitle}. Keep it to one sentence and avoid hedging.`,
      },
    ],
  });

  const factText = response.choices[0]?.message?.content?.trim();
  if (!factText) {
    throw new Error("OpenAI returned no fact.");
  }

  return factText;
}
