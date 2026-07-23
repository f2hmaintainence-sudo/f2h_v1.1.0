import { Suspense } from "react";
import dynamic from "next/dynamic";
import { Hero } from "@/components/landingf2h/Hero";

const Products = dynamic(
  () =>
    import("@/components/landingf2h/Products").then((m) => ({
      default: m.Products,
    })),
  { ssr: true }
);

const ProblemSolution = dynamic(
  () =>
    import("@/components/landingf2h/ProblemSolution").then((m) => ({
      default: m.ProblemSolution,
    })),
  { ssr: true }
);

const Offers = dynamic(
  () =>
    import("@/components/landingf2h/Offers").then((m) => ({
      default: m.Offers,
    })),
  { ssr: true }
);

const WhyChooseUs = dynamic(
  () =>
    import("@/components/landingf2h/WhyChooseUs").then((m) => ({
      default: m.WhyChooseUs,
    })),
  { ssr: true }
);
const HowItWorks = dynamic(
  () =>
    import("@/components/landingf2h/HowItWorks").then((m) => ({
      default: m.HowItWorks,
    })),
  { ssr: true }
);
// const Features = dynamic(
//   () =>
//     import("@/components/landingf2h/Features").then((m) => ({
//       default: m.Features,
//     })),
//   { ssr: true }
// );
const Delivery = dynamic(
  () =>
    import("@/components/landingf2h/Delivery").then((m) => ({
      default: m.Delivery,
    })),
  { ssr: true }
);
const ScaleVision = dynamic(
  () =>
    import("@/components/landingf2h/ScaleVision").then((m) => ({
      default: m.ScaleVision,
    })),
  { ssr: true }
);
const DeliveryBenefits = dynamic(
  () =>
    import("@/components/landingf2h/DeliveryBenefits").then((m) => ({
      default: m.DeliveryBenefits,
    })),
  { ssr: true }
);
const Testimonials = dynamic(
  () =>
    import("@/components/landingf2h/Testimonials").then((m) => ({
      default: m.Testimonials,
    })),
  { ssr: true }
);
const CustomerVideoReviews = dynamic(
  () =>
    import("@/components/landingf2h/CustomerVideoReviews").then((m) => ({
      default: m.CustomerVideoReviews,
    })),
  { ssr: true }
);
const FinalCTA = dynamic(
  () =>
    import("@/components/landingf2h/FinalCTA").then((m) => ({
      default: m.FinalCTA,
    })),
  { ssr: true }
);
const ContactUs = dynamic(
  () =>
    import("@/components/landingf2h/ContactUs").then((m) => ({
      default: m.ContactUs,
    })),
  { ssr: true }
);

function SectionPlaceholder() {
  return <div className="min-h-[200px]" aria-hidden="true" />;
}

export default function LandingPage() {
  return (
    <main className="min-h-screen">
      <Hero />
      <Suspense fallback={<SectionPlaceholder />}>
        <Products />
      </Suspense>
      <Suspense fallback={<SectionPlaceholder />}>
        <ProblemSolution />
      </Suspense>
      <Suspense fallback={<SectionPlaceholder />}>
        <Offers />
      </Suspense>
      <Suspense fallback={<SectionPlaceholder />}>
        <WhyChooseUs />
      </Suspense>
      <Suspense fallback={<SectionPlaceholder />}>
        <HowItWorks />
      </Suspense>
      {/* <Suspense fallback={<SectionPlaceholder />}>
        <Features />
      </Suspense> */}
      <Suspense fallback={<SectionPlaceholder />}>
        <Delivery />
      </Suspense>
      <Suspense fallback={<SectionPlaceholder />}>
        <ScaleVision />
      </Suspense>
      <Suspense fallback={<SectionPlaceholder />}>
        <DeliveryBenefits />
      </Suspense>
      <Suspense fallback={<SectionPlaceholder />}>
        <Testimonials />
      </Suspense>
       <Suspense fallback={<SectionPlaceholder />}>
        <CustomerVideoReviews />
      </Suspense>
      <Suspense fallback={<SectionPlaceholder />}>
        <FinalCTA />
      </Suspense>
      <Suspense fallback={<SectionPlaceholder />}>
        <ContactUs />
      </Suspense>
    </main>
  );
}
