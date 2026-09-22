import type { Metadata } from "next";
import { Faq, FinalCta, LandingFooter } from "@/components/landing/closing";
import { Features } from "@/components/landing/features";
import { LandingHeader } from "@/components/landing/header";
import { Hero } from "@/components/landing/hero";
import { Pricing } from "@/components/landing/pricing";
import { Setup } from "@/components/landing/setup";
import { FAQS, PLANS } from "@/lib/landing";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: SITE_TITLE },
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: { card: "summary_large_image", title: SITE_TITLE, description: SITE_DESCRIPTION },
};

function StructuredData() {
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        name: SITE_NAME,
        url: SITE_URL,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        description: SITE_DESCRIPTION,
        offers: PLANS.map((p) => ({
          "@type": "Offer",
          name: p.name,
          price: p.price.replace("$", ""),
          priceCurrency: "USD",
        })),
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQS.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };
  // Escape "<" so the JSON can never close the script tag.
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}

export default function LandingPage() {
  return (
    <>
      <StructuredData />
      <LandingHeader />
      <main>
        <Hero />
        <Setup />
        <Features />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <LandingFooter />
    </>
  );
}
