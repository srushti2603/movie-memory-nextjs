import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { SignInButton } from "@/components/auth/SignInButton";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  if (session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { favoriteMovie: true },
    });

    if (!user?.favoriteMovie) {
      redirect("/onboarding");
    }

    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-6 py-12">
      <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <p className="text-sm font-medium uppercase tracking-[0.25em] text-slate-500">Movie Memory</p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-900">
          Keep track of the movies that shaped your life.
        </h1>
        <p className="mt-4 text-lg text-slate-600">
          Sign in to save your favorite movie and get a fun fact about it.
        </p>
        <div className="mt-8 flex justify-center">
          <SignInButton />
        </div>
      </div>
    </main>
  );
}
