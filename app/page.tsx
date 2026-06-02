export default function Home() {
  return (
    <main className="flex min-h-screen flex-col bg-slate-950 text-white">
      <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center gap-10 px-6 py-16">
        <div className="max-w-3xl">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
            PROCORDC IT Department
          </p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            Gestion de stock, suivi et inventaire IT
          </h1>
          <p className="mt-6 text-lg leading-8 text-slate-300">
            Une application Next.js pour centraliser les equipements, suivre les
            affectations et piloter les inventaires du departement IT de
            procordc.com.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold">Stock IT</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Visualiser les entrees, sorties, seuils critiques et categories
              de materiel informatique.
            </p>
          </article>
          <article className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold">Suivi</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Tracer les affectations aux agents, les mouvements et l&apos;historique
              de chaque equipement.
            </p>
          </article>
          <article className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold">Inventaire</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Preparer les controles periodiques et fiabiliser les donnees pour
              les audits internes.
            </p>
          </article>
        </div>
      </section>
    </main>
  );
}
