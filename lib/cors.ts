import type { VercelResponse } from "@vercel/node";

// TODO: 프로덕션에서는 앱인토스 미니앱의 실제 origin으로 좁혀주세요.
// 예: process.env.ALLOWED_ORIGIN = "https://apps-in-toss.example.com"
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? "*";

export function setCorsHeaders(res: VercelResponse, allowedMethods: string): void {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", allowedMethods);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");
}
