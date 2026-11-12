import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMovieFactForUser } from "@/lib/fact-service";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      favoriteMovie: true,
    },
  });

  if (!user?.favoriteMovie) {
    return NextResponse.json(
      { error: "Please set a favorite movie before asking for a fact." },
      { status: 400 },
    );
  }

  const result = await getMovieFactForUser(session.user.id, user.favoriteMovie);

  return NextResponse.json(result);
}
