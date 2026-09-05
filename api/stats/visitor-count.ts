import type { VercelRequest, VercelResponse } from "@vercel/node";
import { setCorsHeaders } from "../../lib/cors";
import { getSupabaseClient, SupabaseConfigError } from "../../lib/supabase";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  setCorsHeaders(res, "GET, OPTIONS");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "GET") {
    res.status(405).json({ error: "지원하지 않는 메서드입니다. GET을 사용해주세요." });
    return;
  }

  let supabase;
  try {
    supabase = getSupabaseClient();
  } catch (err) {
    if (err instanceof SupabaseConfigError) {
      res.status(500).json({ error: err.message });
      return;
    }
    throw err;
  }

  const [sharersResult, visitsResult] = await Promise.all([
    supabase.from("sharers").select("*", { count: "exact", head: true }),
    supabase.from("visits").select("*", { count: "exact", head: true }),
  ]);

  if (sharersResult.error) {
    console.error("Supabase count error (sharers) in visitor-count handler:", sharersResult.error);
    res.status(502).json({ error: `방문자 수 조회에 실패했습니다: ${sharersResult.error.message}` });
    return;
  }

  if (visitsResult.error) {
    console.error("Supabase count error (visits) in visitor-count handler:", visitsResult.error);
    res.status(502).json({ error: `방문자 수 조회에 실패했습니다: ${visitsResult.error.message}` });
    return;
  }

  const count = (sharersResult.count ?? 0) + (visitsResult.count ?? 0);

  res.status(200).json({ count });
}
