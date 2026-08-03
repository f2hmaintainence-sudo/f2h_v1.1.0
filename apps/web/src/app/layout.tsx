import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Poppins, Inter, IBM_Plex_Mono, Fraunces } from "next/font/google";
import { AlertProvider } from "@/context/AlertContext";
import { ToastContainer } from "@/components/Toast";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  weight: ["300", "400", "500", "600", "700", "800"],
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

const poppins = Poppins({
  weight: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
  variable: "--font-poppins",
  display: "swap",
});

const inter = Inter({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  weight: ["500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
});

const fraunces = Fraunces({
  weight: ["500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "F2H — Farm to Home | Fresh Milk Delivery",
    template: "%s | F2H",
  },
  description:
    "Fresh, FSSAI-verified milk delivered to your doorstep every morning. Trusted by 10,000+ families.",
  keywords: [
    "fresh milk delivery",
    "milk subscription",
    "F2H",
    "Farm to Home",
    "daily milk",
    "Tirupati",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    title: "F2H — Farm to Home | Fresh Milk Delivery",
    description:
      "Fresh, FSSAI-verified milk delivered to your doorstep every morning. Trusted by 10,000+ families.",
    siteName: "F2H",
  },
  twitter: {
    card: "summary_large_image",
    title: "F2H — Farm to Home | Fresh Milk Delivery",
    description:
      "Fresh, FSSAI-verified milk delivered to your doorstep every morning. Trusted by 10,000+ families.",
  },
  icons: {
    icon: "/assets/log1.webp",
    shortcut: "/assets/log1.webp",
    apple: "/assets/log1.webp",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${plusJakarta.variable} ${poppins.variable} ${inter.variable} ${ibmPlexMono.variable} ${fraunces.variable}`}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        <AlertProvider>
          {children}
          <ToastContainer />
        </AlertProvider>
      </body>
    </html>
  );
}
