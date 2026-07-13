import { randomInt } from 'node:crypto';

export function weightedDraw(candidates, count) {
  const remaining = candidates.filter((c) => Number.isInteger(c.weight) && c.weight > 0);
  const winners = [];
  while (remaining.length && winners.length < count) {
    const pool = remaining.flatMap((candidate) => Array(candidate.weight).fill(candidate.userId));
    const chosenId = pool[randomInt(pool.length)];
    winners.push(chosenId);
    const index = remaining.findIndex((candidate) => candidate.userId === chosenId);
    remaining.splice(index, 1);
  }
  return winners;
}
