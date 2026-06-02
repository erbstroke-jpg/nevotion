import { AVATAR_COLORS } from "@/lib/types";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    // for single names like "Ариет" use first 2 chars, "Азамат" -> "А"
    return name.slice(0, 1).toUpperCase();
  }
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function Avatar({
  name,
  color = "indigo",
  size = 28,
}: {
  name: string;
  color?: string;
  size?: number;
}) {
  const c = AVATAR_COLORS[color] ?? AVATAR_COLORS.indigo;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: c.bg,
        color: c.fg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.38,
        fontWeight: 600,
        flexShrink: 0,
      }}
    >
      {initials(name)}
    </div>
  );
}
