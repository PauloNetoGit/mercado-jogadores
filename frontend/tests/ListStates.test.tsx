import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  ErrorCard,
  LoadingLabel,
  NETWORK_MESSAGE,
  describeLoadError,
} from "@/src/components/ListStates";

describe("describeLoadError", () => {
  it("usa o texto de conexão quando a requisição nem chegou à API", () => {
    expect(describeLoadError(new TypeError("Failed to fetch"))).toBe(NETWORK_MESSAGE);
  });

  it("mostra a mensagem que a API devolveu", () => {
    expect(describeLoadError(new Error("Clube não encontrado"))).toBe("Clube não encontrado");
  });
});

describe("ErrorCard", () => {
  it("mostra o título e chama a nova tentativa ao clicar", async () => {
    const onRetry = vi.fn();
    render(<ErrorCard what="os jogadores" message="Falhou" onRetry={onRetry} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível carregar os jogadores");
    await userEvent.click(screen.getByRole("button", { name: /tentar de novo/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("desabilita o botão enquanto tenta de novo", () => {
    render(<ErrorCard what="o histórico" message="x" onRetry={() => {}} retrying />);
    expect(screen.getByRole("button")).toBeDisabled();
  });
});

describe("LoadingLabel", () => {
  it("anuncia o carregamento como status", () => {
    render(<LoadingLabel label="Carregando jogadores…" />);
    expect(screen.getByRole("status")).toHaveTextContent("Carregando jogadores…");
  });
});
