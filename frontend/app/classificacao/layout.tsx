import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Classificação · Passe",
  description: "Classificação da liga: pontos, saldo de gols e posição.",
};

export default function ClassificacaoLayout({ children }: LayoutProps<"/classificacao">) {
  return children;
}
