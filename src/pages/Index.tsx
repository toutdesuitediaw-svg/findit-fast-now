import Categories from "@/components/Categories";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import Hero from "@/components/Hero";

import Listings from "@/components/Listings";
import PromoBanner from "@/components/PromoBanner";
import TrustBar from "@/components/TrustBar";
import WhatsAppBar from "@/components/WhatsAppBar";
import { useSEO, SITE_URL, DEFAULT_IMAGE } from "@/lib/seo";

const Index = () => {
  useSEO({
    title: "TOUT DE SUITE — Petites annonces au Sénégal : Dakar, Thiès, Saint-Louis",
    description:
      "Petites annonces gratuites au Sénégal : immobilier Dakar, voitures occasion, emploi Sénégal, électronique, services. Publiez et trouvez en quelques clics.",
    canonical: `${SITE_URL}/`,
    image: DEFAULT_IMAGE,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "TOUT DE SUITE",
      url: SITE_URL,
      logo: DEFAULT_IMAGE,
      areaServed: "SN",
    },
  });
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <Hero />
        <Categories />
        <Listings />
        <PromoBanner />
        <TrustBar />
      </main>
      <WhatsAppBar />
      <Footer />
    </div>
  );
};

export default Index;
