import type { VercelRequest, VercelResponse } from "@vercel/node";
import { setCorsHeaders } from "../../lib/cors";
import { getSupabaseClient, SupabaseConfigError } from "../../lib/supabase";
import { calculateCompatibility } from "../../lib/compatibility";
import { maskNickname } from "../../lib/nickname";

interface VisitRequestBody {
  sharerCode: string;
  visitorType: string;
  nickname: string | null;
}

function validateBody(
  body: unknown
): { ok: true; data: VisitRequestBody } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "요청 본문이 올바른 JSON 객체가 아닙니다." };
  }

  const { sharerCode, visitorType, nickname } = body as Record<string, unknown>;

  if (typeof sharerCode !== "string" || sharerCode.trim().length === 0) {
    return { ok: false, error: "sharerCode는 필수 문자열입니다." };
  }

  if (typeof visitorType !== "string" || visitorType.trim().length === 0 || visitorType.length > 80) {
    return { ok: false, error: "visitorType은 1~80자의 문자열이어야 합니다." };
  }

  let trimmedNickname: string | null = null;
  if (nickname !== undefined && nickname !== null) {
    if (typeof nickname !== "string" || nickname.trim().length > 10) {
      return { ok: false, error: "nickname은 최대 10자의 문자열이어야 합니다." };
    }
    trimmedNickname = nickname.trim().length === 0 ? null : nickname.trim();
  }

  return {
    ok: true,
    data: { sharerCode: sharerCode.trim(), visitorType: visitorType.trim(), nickname: trimmedNickname },
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  setCorsHeaders(res, "POST, OPTIONS");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "지원하지 않는 메서드입니다. POST를 사용해주세요." });
    return;
  }

  const validation = validateBody(req.body);
  if (!validation.ok) {
    res.status(400).json({ error: validation.error });
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

  const { sharerCode, visitorType, nickname } = validation.data;

  const { data: sharer, error: sharerError } = await supabase
    .from("sharers")
    .select("type, nickname")
    .eq("code", sharerCode)
    .maybeSingle();

  if (sharerError) {
    console.error("Supabase select error in visit handler:", sharerError);
    res.status(502).json({ error: `공유 코드 조회에 실패했습니다: ${sharerError.message}` });
    return;
  }

  if (!sharer) {
    res.status(404).json({ error: `존재하지 않는 공유 코드입니다: ${sharerCode}` });
    return;
  }

  const sharerType = sharer.type as string;
  const sharerNickname = sharer.nickname as string | null;

  const { error: insertError } = await supabase.from("visits").insert({
    sharer_code: sharerCode,
    sharer_type: sharerType,
    visitor_type: visitorType,
    visitor_nickname: nickname,
  });

  if (insertError) {
    console.error("Supabase insert error in visit handler:", insertError);
    res.status(502).json({ error: `방문 기록 저장에 실패했습니다: ${insertError.message}` });
    return;
  }

  const compatibility = calculateCompatibility(sharerType, visitorType);

  res.status(200).json({
    sharerCode,
    sharerType,
    visitorType,
    sharerNickname: sharerNickname ? maskNickname(sharerNickname) : null,
    compatibility,
  });
}
