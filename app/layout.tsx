import type { Metadata } from "next";
import { connection } from "next/server";
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
export default async function RootLayout({ children }: LayoutProps<"/">) {
  await connection();
  const actor = await getPasswordChangeActor();
  return (
    <html lang="en">
      <body>
        <Header actor={actor} />
        {children}
        {!actor && <Footer />}
      </body>
    </html>
  );
}
