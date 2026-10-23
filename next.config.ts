import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /** Onglets supprimes au lot 5 : les anciens favoris menent a l'ecran qui a repris leur role. */
  async redirects() {
    return [
      { source: "/techniciens", destination: "/parametres?onglet=utilisateurs", permanent: false },
      { source: "/rapports", destination: "/", permanent: false },
      { source: "/assistance", destination: "/", permanent: false },
    ];
  },
};

export default nextConfig;
