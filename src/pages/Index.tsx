import Categories from "@/components/Categories";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import IOSInstallHint from "@/components/IOSInstallHint";
import Listings from "@/components/Listings";
import PromoBanner from "@/components/PromoBanner";
import TrustBar from "@/components/TrustBar";
import WhatsAppBar from "@/components/WhatsAppBar";

const Index = () => {
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
      <IOSInstallHint />
      <Footer />
    </div>
  );
};

export default Index;
