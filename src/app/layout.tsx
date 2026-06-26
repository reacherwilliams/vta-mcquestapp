import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SafeAreaProvider } from "@/components/native/SafeArea";
import { RevenueCatInit } from "@/components/native/RevenueCatInit";
import { auth } from "@/lib/auth";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "MCQ MasterLoop — MCQ practice for IGCSE, A-Level, IB, AP",
    template: "%s | MCQ MasterLoop",
  },
  description:
    "Practice past-paper-style MCQs across IGCSE, AS, A2, IB, and AP. Wrong-only retry, exam mode, gamified for teen learners.",
  applicationName: "MCQ MasterLoop",
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth()
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SafeAreaProvider />
        <RevenueCatInit userId={session?.user?.id} />
        {children}
      </body>
    </html>
  );
}
