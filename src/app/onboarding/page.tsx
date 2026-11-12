import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MovieForm } from "@/components/onboarding/MovieForm";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { favoriteMovie: true },
  });

  if (user?.favoriteMovie) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-6 py-12">
      <div className="w-full max-w-2xl space-y-6 text-center">
        <div className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
            Welcome
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">
            Tell us your favorite movie
          </h1>
        </div>

        <MovieForm />
      </div>
    </main>
  );
}
