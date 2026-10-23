const TONES = [
  { bg: "#DDF7F1", fg: "#0E9F7E" },
  { bg: "#EEE7FF", fg: "#7C3AED" },
  { bg: "#FFE6EF", fg: "#D6336C" },
  { bg: "#E1F0FF", fg: "#1C7ED6" },
  { bg: "#FFF1DC", fg: "#D9730D" },
  { bg: "#EEF0F5", fg: "#54596A" },
];

export function initialsOf(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

/** Iniciais sobre um fundo pastel, sempre o mesmo para o mesmo jogador. */
export function Avatar({ id, name, size = 32 }: { id: number; name: string; size?: number }) {
  const tone = TONES[id % TONES.length];
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full font-semibold"
      style={{
        width: size,
        height: size,
        background: tone.bg,
        color: tone.fg,
        fontSize: Math.round(size * 0.34),
      }}
    >
      {initialsOf(name)}
    </span>
  );
}
