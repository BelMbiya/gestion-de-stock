/** Message d'erreur metier renvoye par l'API (`{ error }`), avec repli si la reponse n'est pas lisible. */
export async function readApiError(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error ?? fallback;
  } catch {
    return fallback;
  }
}

export function ErrorNotice({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="rounded-md border border-red-900/40 bg-red-950/30 px-3 py-2 text-sm text-red-200 md:col-span-2" role="alert">
      {message}
    </p>
  );
}
