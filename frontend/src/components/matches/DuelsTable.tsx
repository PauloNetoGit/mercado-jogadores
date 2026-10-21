"use client";

import { Avatar } from "@/src/components/players/Avatar";
import { ATTRIBUTE_LABEL, SoccerBall } from "@/src/components/matches/MatchField";
import { AcronymTag } from "@/src/components/matches/MatchesShared";
import type { Duelo, PartidaDetalhe } from "@/src/services/matches";

/** "ATA, 4º de linha": a posição na linha vai do 1º (mais recuado) ao 4º (mais avançado). */
function lineLabel(position: string, line: number) {
  return `${position}, ${line}º de linha`;
}

export function DuelsTable({
  match,
  acronyms,
}: {
  match: PartidaDetalhe;
  acronyms: Map<number, string>;
}) {
  const clubName = (id: number) => (id === match.home.club_id ? match.home.club_name : match.away.club_name);
  const acronym = (id: number) => acronyms.get(id) ?? clubName(id).slice(0, 3).toUpperCase();

  const groups = [
    { club: match.home, role: "mandante", duels: match.duels.filter((duel) => duel.attacking_club_id === match.home.club_id) },
    { club: match.away, role: "visitante", duels: match.duels.filter((duel) => duel.attacking_club_id === match.away.club_id) },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-[13px]">
        <thead>
          <tr className="border-y border-neutral-200 bg-neutral-50 text-left text-[13px] text-neutral-600">
            <th className="px-5 py-3 font-medium">Duelo</th>
            <th className="px-3 py-3 font-medium">Atacante</th>
            <th className="px-3 py-3 font-medium">Ataque</th>
            <th className="px-3 py-3 font-medium">Defensor</th>
            <th className="px-3 py-3 font-medium">Defesa</th>
            <th className="px-5 py-3 font-medium">Resultado</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => {
            const goals = group.duels.filter((duel) => duel.goal).length;
            return (
              <GroupRows
                key={group.club.club_id}
                title={`Ataques do ${group.club.club_name} (${group.role})`}
                acronym={acronym(group.club.club_id)}
                goals={goals}
                duels={group.duels}
                clubName={clubName}
                defendingClubId={(duel) =>
                  duel.attacking_club_id === match.home.club_id ? match.away.club_id : match.home.club_id
                }
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function GroupRows({
  title,
  acronym,
  goals,
  duels,
  clubName,
  defendingClubId,
}: {
  title: string;
  acronym: string;
  goals: number;
  duels: Duelo[];
  clubName: (id: number) => string;
  defendingClubId: (duel: Duelo) => number;
}) {
  return (
    <>
      <tr className="border-b border-neutral-200 bg-neutral-50">
        <td colSpan={6} className="px-5 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[13px]">
              <AcronymTag>{acronym}</AcronymTag>
              <span className="font-medium">{title}</span>
            </div>
            <span className="text-[13px] text-neutral-600">
              {goals} {goals === 1 ? "gol" : "gols"}
            </span>
          </div>
        </td>
      </tr>

      {duels.map((duel) => {
        // Ordem dentro do time: 1º duelo = 4º de linha ataca o goleiro; 2º = 3º ataca o 1º; 3º = 2º ataca o 2º.
        const slot = (duel.order - 1) % 3;
        const attackerLine = 4 - slot;
        const defender = duel.defender;
        return (
          <tr key={duel.order} className="border-b border-neutral-200">
            <td className="px-5 py-3.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-neutral-100 text-[12px] font-medium">
                {duel.order}
              </span>
            </td>
            <td className="px-3 py-3.5">
              <div className="flex items-center gap-3">
                <Avatar id={duel.attacker.player_id} name={duel.attacker.player_name} size={36} />
                <div>
                  <p className="text-[14px] font-semibold">{duel.attacker.player_name}</p>
                  <p className="text-[12px] text-neutral-500">
                    {lineLabel(duel.attacker.position, attackerLine)} · {clubName(duel.attacking_club_id)}
                  </p>
                </div>
              </div>
            </td>
            <td className="whitespace-nowrap px-3 py-3.5 tabular-nums">
              <span className="text-neutral-500">{ATTRIBUTE_LABEL[duel.attacker.attribute]}</span>{" "}
              <span className="text-[15px] font-semibold">{duel.attacker.value}</span>
            </td>
            <td className="px-3 py-3.5">
              <div className="flex items-center gap-3">
                <Avatar id={defender.player_id} name={defender.player_name} size={36} />
                <div>
                  <p className="text-[14px] font-semibold">{defender.player_name}</p>
                  <p className="text-[12px] text-neutral-500">
                    {defender.position === "GOL" ? "Goleiro" : lineLabel(defender.position, slot)} ·{" "}
                    {clubName(defendingClubId(duel))}
                  </p>
                </div>
              </div>
            </td>
            <td className="whitespace-nowrap px-3 py-3.5 tabular-nums">
              <span className="text-neutral-500">Defesa</span>{" "}
              <span className="text-[15px] font-semibold">{defender.value}</span>
            </td>
            <td className="px-5 py-3.5">
              {duel.goal ? (
                <span className="inline-flex items-center gap-1.5 rounded-md border border-green-200 bg-green-50 px-2 py-0.5 text-[12px] font-medium text-green-700">
                  <SoccerBall size={12} />
                  Gol
                </span>
              ) : (
                <span className="inline-flex items-center rounded-md border border-neutral-200 bg-white px-2 py-0.5 text-[12px] font-medium text-neutral-800 shadow-sm">
                  Sem gol
                </span>
              )}
            </td>
          </tr>
        );
      })}
    </>
  );
}
