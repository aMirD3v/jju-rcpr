import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { Header } from "@/components/site/header";
import { Footer } from "@/components/site/footer";
import { getPasswordChangeActor } from "@/lib/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Research Call and Peer Review | Jigjiga University",
    template: "%s | JJU-RCPR",
  },
  description: "Jigjiga University Research Call & Peer Review System.",
};
async function SessionHeader() {
  await connection();
  const actor = await getPasswordChangeActor();
  return <Header actor={actor} />;
}

async function SessionFooter() {
  const actor = await getPasswordChangeActor();
  return actor ? null : <Footer />;
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <Suspense fallback={<Header actor={null} />}>
          <SessionHeader />
        </Suspense>
        {children}
        <Suspense fallback={null}>
          <SessionFooter />
        </Suspense>
      </body>
    </html>
  );
}
