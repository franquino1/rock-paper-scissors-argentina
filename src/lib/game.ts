export type Choice = "piedra" | "papel" | "tijera";
export type Side = "p1" | "p2";
export type RoundResult = "p1" | "p2" | "empate";
export type MatchStatus =
  | "invited"
  | "waiting"
  | "in_progress"
  | "finished"
  | "cancelled"
  | "declined";

export interface Profile {
  id: string;
  username: string;
  status: string;
  last_seen: string;
  wins: number;
  puntos_totales: number;
  current_streak: number;
  best_streak: number;
}

export interface Achievement {
  code: string;
  title: string;
  description: string;
  icon: string;
  sort_order: number;
}

export const PROFILE_FIELDS =
  "id, username, status, last_seen, wins, puntos_totales, current_streak, best_streak";


export interface Match {
  id: string;
  player1: string;
  player2: string | null;
  vs_bot: boolean;
  is_random: boolean;
  mode: number;
  status: MatchStatus;
  p1_score: number;
  p2_score: number;
  winner_side: Side | null;
  created_at: string;
  updated_at: string;
}

export interface Round {
  id: string;
  match_id: string;
  round_number: number;
  p1_choice: Choice | null;
  p2_choice: Choice | null;
  result: RoundResult | null;
  created_at: string;
}

export const CHOICES: { value: Choice; label: string; icon: string }[] = [
  { value: "piedra", label: "Piedra", icon: "🪨" },
  { value: "papel", label: "Papel", icon: "📄" },
  { value: "tijera", label: "Tijera", icon: "✂️" },
];

export const CHOICE_ICON: Record<Choice, string> = {
  piedra: "🪨",
  papel: "📄",
  tijera: "✂️",
};

export const CHOICE_LABEL: Record<Choice, string> = {
  piedra: "Piedra",
  papel: "Papel",
  tijera: "Tijera",
};

export const MODES: { value: number; title: string; detail: string }[] = [
  { value: 1, title: "Una sola partida", detail: "Se define en una jugada" },
  { value: 3, title: "Mejor de 3", detail: "El primero en llegar a 2 puntos" },
  { value: 5, title: "Mejor de 5", detail: "El primero en llegar a 3 puntos" },
];

export function targetScore(mode: number): number {
  if (mode === 1) return 1;
  if (mode === 3) return 2;
  return 3;
}

export function modeLabel(mode: number): string {
  return MODES.find((m) => m.value === mode)?.title ?? `Mejor de ${mode}`;
}

export function randomChoice(): Choice {
  const list = CHOICES;
  return list[Math.floor(Math.random() * list.length)]!.value;
}

export function isOnline(profile: { status: string; last_seen: string }): boolean {
  if (profile.status === "offline") return false;
  return Date.now() - new Date(profile.last_seen).getTime() < 75_000;
}

export function whyWins(winner: Choice, loser: Choice): string {
  if (winner === "piedra" && loser === "tijera") return "La piedra rompe la tijera";
  if (winner === "tijera" && loser === "papel") return "La tijera corta el papel";
  if (winner === "papel" && loser === "piedra") return "El papel envuelve la piedra";
  return "";
}
