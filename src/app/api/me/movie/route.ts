import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { favoriteMovieSchema } from "@/lib/validation";

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = favoriteMovieSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message ?? "Favorite movie is invalid.",
      },
      { status: 400 },
    );
  }

  const movie = parsed.data.movie;

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      favoriteMovie: movie,
    },
    select: {
      id: true,
      favoriteMovie: true,
    },
  });

  return NextResponse.json({ success: true, user });
}
