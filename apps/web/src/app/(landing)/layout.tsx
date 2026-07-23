import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { ReactNode } from "react";
import "./globals.css";
import { Navbar } from "@/components/landingf2h/Navbar";
import { Footer } from "@/components/landingf2h/Footer";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "F2H — Farm to Home | Fresh Milk Delivery Subscription",
  description:
    "Subscribe once and get fresh, FSSAI-verified milk delivered to your doorstep every morning. Trusted by 10,000+ families in Tirupati. 2-hour refund guarantee.",
  keywords: [
    "fresh milk delivery",
    "milk subscription",
    "Tirupati",
    "F2H",
    "Farm to Home",
    "daily milk",
  ],
};

interface LandingLayoutProps {
  children: ReactNode;
}

export default function LandingLayout({ children }: LandingLayoutProps) {
  return (
    <div
      className={`${plusJakarta.variable} ${plusJakarta.className} min-h-screen antialiased`}
    >
      <Navbar />
      {children}
      <Footer />
    </div>
  );
}
