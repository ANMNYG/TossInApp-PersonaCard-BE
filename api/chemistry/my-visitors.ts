import type { VercelRequest, VercelResponse } from "@vercel/node";
import { setCorsHeaders } from "../../lib/cors";
import { getSupabaseClient, SupabaseConfigError } from "../../lib/supabase";
import { calculateCompatibility } from "../../lib/compatibility";
import { maskNickname } from "../../lib/nickname";

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

  const rawCode = req.query.code;
  const sharerCode = Array.isArray(rawCode) ? rawCode[0] : rawCode;

  if (typeof sharerCode !== "string" || sharerCode.trim().length === 0) {
    res.status(400).json({ error: "code 쿼리 파라미터는 필수입니다." });
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

  const { data: sharer, error: sharerError } = await supabase
    .from("sharers")
    .select("type, nickname")
    .eq("code", sharerCode)
    .maybeSingle();

  if (sharerError) {
    console.error("Supabase select error in my-visitors handler:", sharerError);
    res.status(502).json({ error: `공유 코드 조회에 실패했습니다: ${sharerError.message}` });
    return;
  }

  if (!sharer) {
    res.status(404).json({ error: `존재하지 않는 공유 코드입니다: ${sharerCode}` });
    return;
  }

  const sharerType = sharer.type as string;
  const sharerNickname = sharer.nickname as string | null;

  const { data: visits, error: visitsError } = await supabase
    .from("visits")
    .select("visitor_type, visitor_nickname, created_at")
    .eq("sharer_code", sharerCode)
    .order("created_at", { ascending: false });

  if (visitsError) {
    console.error("Supabase select error in my-visitors handler:", visitsError);
    res.status(502).json({ error: `방문 기록 조회에 실패했습니다: ${visitsError.message}` });
    return;
  }

  const visitors = (visits ?? []).map((visit) => {
    const visitorType = visit.visitor_type as string;
    const visitorNickname = visit.visitor_nickname as string | null;
    return {
      visitorType,
      nickname: visitorNickname ? maskNickname(visitorNickname) : null,
      visitedAt: visit.created_at as string,
      compatibility: calculateCompatibility(sharerType, visitorType),
    };
  });

  res.status(200).json({
    sharerCode,
    sharerType,
    sharerNickname: sharerNickname ? maskNickname(sharerNickname) : null,
    visitorCount: visitors.length,
    visitors,
  });
}
