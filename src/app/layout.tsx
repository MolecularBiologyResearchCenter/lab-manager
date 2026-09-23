import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { UserLanguageProvider } from "@/components/UserLanguageProvider"
import { getCurrentUser } from "@/app/actions"

export const metadata: Metadata = {
  title: "北里大学 医学部 分子生物実験センター",
  description: "Lab Management System for Kitasato University School of Medicine",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "分子生物実験センター",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className="flex flex-col min-h-screen antialiased"
      >
        <LayoutContent>{children}</LayoutContent>
      </body>
    </html>
  );
}

async function LayoutContent({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  const enabled = user?.role === 'USER'

  return (
    <UserLanguageProvider enabled={enabled}>
      <Header />
      <main className="page-container flex-1">
        {children}
      </main>
      <Footer />
      <Toaster />
    </UserLanguageProvider>
  )
}
