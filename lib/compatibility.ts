export type Element = "fire" | "water" | "earth" | "air";

const ELEMENTS: Element[] = ["fire", "water", "earth", "air"];

// 원소 간 상성 점수 (0~100). 대각선은 동일 원소 공명, 나머지는 상생/상극 관계를 반영한다.
const ELEMENT_AFFINITY: Record<Element, Record<Element, number>> = {
  fire: { fire: 95, water: 30, earth: 60, air: 85 },
  water: { fire: 30, water: 95, earth: 85, air: 55 },
  earth: { fire: 60, water: 85, earth: 95, air: 35 },
  air: { fire: 85, water: 55, earth: 35, air: 95 },
};

export interface CompatibilityResult {
  score: number;
  description: string;
}

// "fire-water", "fire_water", "Fire Water" 등 원소 이름이 포함된 타입 문자열에서
// 알려진 원소들을 추출한다. 알 수 없는 값이 섞여 있어도 무시하고 진행한다.
function parseElements(type: string): Element[] {
  const tokens = type.toLowerCase().split(/[^a-z]+/).filter(Boolean);
  return tokens.filter((token): token is Element => (ELEMENTS as string[]).includes(token));
}

function describeScore(score: number): string {
  if (score >= 85) return "천생연분! 서로의 에너지가 완벽하게 공명하는 케미예요.";
  if (score >= 65) return "손발이 잘 맞는 좋은 궁합이에요.";
  if (score >= 45) return "무난하게 어울리는 케미예요.";
  if (score >= 30) return "정반대의 매력! 다르기에 더 특별한 케미예요.";
  return "극과 극이지만, 그래서 더 흥미로운 조합이에요.";
}

export function calculateCompatibility(typeA: string, typeB: string): CompatibilityResult {
  const elementsA = parseElements(typeA);
  const elementsB = parseElements(typeB);

  if (elementsA.length === 0 || elementsB.length === 0) {
    const score = 50;
    return { score, description: describeScore(score) };
  }

  let total = 0;
  let count = 0;
  for (const a of elementsA) {
    for (const b of elementsB) {
      total += ELEMENT_AFFINITY[a][b];
      count += 1;
    }
  }

  const score = Math.round(total / count);
  return { score, description: describeScore(score) };
}
