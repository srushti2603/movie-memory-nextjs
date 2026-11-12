import { getServerSession } from "next-auth";
import Image from "next/image";
import { redirect } from "next/navigation";

import { LogoutButton } from "@/components/auth/LogoutButton";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMovieFactForUser } from "@/lib/fact-service";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      favoriteMovie: true,
    },
  });

  if (!user) {
    redirect("/");
  }

  if (!user.favoriteMovie) {
    redirect("/onboarding");
  }

  const fact = await getMovieFactForUser(session.user.id, user.favoriteMovie);

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-12">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            {user.image ? (
              <Image
                src={user.image}
                alt={user.name ?? "User profile"}
                width={60}
                height={60}
                className="h-14 w-14 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-200 text-lg font-semibold text-slate-700">
                {user.name?.charAt(0)?.toUpperCase() ?? "U"}
              </div>
            )}

            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Profile</p>
              <h1 className="text-2xl font-bold text-slate-900">{user.name ?? "Movie fan"}</h1>
            </div>
          </div>

          <LogoutButton />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Account</p>
            <dl className="mt-4 space-y-3">
              <div>
                <dt className="text-sm text-slate-500">Name</dt>
                <dd className="text-lg font-semibold text-slate-900">{user.name ?? "Not provided"}</dd>
              </div>
              <div>
                <dt className="text-sm text-slate-500">Email</dt>
                <dd className="text-lg font-semibold text-slate-900">{user.email ?? "Not provided"}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Favorite movie</p>
            <p className="mt-4 text-3xl font-bold text-slate-900">{user.favoriteMovie}</p>
          </section>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Fun fact</p>
          <p className="mt-4 text-lg leading-8 text-slate-700">{fact.factText}</p>
          <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-400">
            Source: {fact.source}
          </p>
        </section>
      </div>
    </main>
  );
}
