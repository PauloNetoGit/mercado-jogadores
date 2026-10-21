import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Partidas · Passe",
  description: "Partidas entre clubes, com placar e duelos.",
};

export default function PartidasLayout({ children }: LayoutProps<"/partidas">) {
  return children;
}
