export interface LevelInfo {
  level: number;
  title: string;
  emoji: string;
  nextAt: number;
  current: number;
}

const LEVELS = [
  { level: 1, title: 'Newbie', emoji: '🌱', nextAt: 10 },
  { level: 2, title: 'Explorer', emoji: '🔍', nextAt: 30 },
  { level: 3, title: 'Chatter', emoji: '💬', nextAt: 75 },
  { level: 4, title: 'Social Star', emoji: '⭐', nextAt: 150 },
  { level: 5, title: 'Lucky Legend', emoji: '🏆', nextAt: Infinity },
];

export function getUserLevel(totalChats: number = 0, totalMatches: number = 0): LevelInfo {
  const score = totalChats + totalMatches;
  let found = LEVELS[LEVELS.length - 1];
  for (const l of LEVELS) {
    if (score < l.nextAt) { found = l; break; }
  }
  return { ...found, current: score };
}

export function getLevelLabel(totalChats: number = 0, totalMatches: number = 0): string {
  const info = getUserLevel(totalChats, totalMatches);
  return `${info.emoji} ${info.title}`;
}
