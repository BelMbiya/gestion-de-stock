import { SettingsContent } from "@/components/settings-content";

type PageProps = { searchParams: Promise<{ onglet?: string }> };

/** `?onglet=utilisateurs` ouvre directement la gestion des comptes (ancien lien /techniciens). */
export default async function ParametresPage({ searchParams }: PageProps) {
  const { onglet } = await searchParams;
  return <SettingsContent initialTab={onglet === "utilisateurs" ? "users" : "referentials"} />;
}
