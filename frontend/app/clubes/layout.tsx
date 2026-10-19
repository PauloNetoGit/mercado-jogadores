import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Clubes · Passe",
  description: "Clubes da liga: caixa, valor do elenco e patrimônio.",
};

export default function ClubesLayout({ children }: LayoutProps<"/clubes">) {
  return children;
}
