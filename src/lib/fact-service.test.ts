import { beforeEach, describe, expect, it, vi } from "vitest";

const openaiCreateMock = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  movieFact: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  user: {
    updateMany: vi.fn(),
  },
}));

vi.mock("openai", () => ({
  default: class OpenAI {
    chat = {
      completions: {
        create: openaiCreateMock,
      },
    };
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

import { getFactByIdForUser, getMovieFactForUser } from "@/lib/fact-service";

describe("fact cache logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a cached fact when the previous result is newer than 60 seconds", async () => {
    prismaMock.movieFact.findFirst.mockResolvedValue({
      id: "fact-1",
      userId: "user-1",
      movieTitle: "The Matrix",
      factText: "Cached fact",
      createdAt: new Date(Date.now() - 30_000),
    });

    const result = await getMovieFactForUser("user-1", "The Matrix");

    expect(result).toMatchObject({
      factText: "Cached fact",
      source: "cache",
      cached: true,
    });
    expect(openaiCreateMock).not.toHaveBeenCalled();
  });

  it("returns a loading fallback when another generation is already in progress", async () => {
    prismaMock.movieFact.findFirst.mockResolvedValue(null);
    prismaMock.user.updateMany.mockResolvedValue({ count: 0 });

    const result = await getMovieFactForUser("user-1", "The Matrix");

    expect(result).toMatchObject({
      source: "loading",
      cached: false,
    });
    expect(openaiCreateMock).not.toHaveBeenCalled();
  });
});

describe("authorization", () => {
  it("prevents a user from viewing another user's fact", async () => {
    prismaMock.movieFact.findUnique.mockResolvedValue({
      id: "fact-2",
      userId: "other-user",
      movieTitle: "Inception",
      factText: "Secret fact",
      createdAt: new Date(),
    });

    await expect(getFactByIdForUser("fact-2", "user-1")).rejects.toThrow(
      "You are not allowed to view this fact.",
    );
  });
});
