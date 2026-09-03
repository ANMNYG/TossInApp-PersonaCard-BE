import type { VercelRequest, VercelResponse } from "@vercel/node";
import { customAlphabet } from "nanoid";
import { setCorsHeaders } from "../../lib/cors";
import { getSupabaseClient, SupabaseConfigError } from "../../lib/supabase";

interface GenerateCodeRequestBody {
  sharerType: string;
  nickname: string | null;
}

// 혼동되기 쉬운 0/O, 1/I/L을 제외한 6자리 코드 (공유 링크에 넣기 좋은 형태)
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const CODE_LENGTH = 6;
const MAX_GENERATE_ATTEMPTS = 5;
const UNIQUE_VIOLATION = "23505";

const generateCode = customAlphabet(CODE_ALPHABET, CODE_LENGTH);

function validateBody(
  body: unknown
): { ok: true; data: GenerateCodeRequestBody } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "요청 본문이 올바른 JSON 객체가 아닙니다." };
  }

  const { sharerType, nickname } = body as Record<string, unknown>;

  if (typeof sharerType !== "string" || sharerType.trim().length === 0 || sharerType.length > 80) {
    return { ok: false, error: "sharerType은 1~80자의 문자열이어야 합니다." };
  }

  let trimmedNickname: string | null = null;
  if (nickname !== undefined && nickname !== null) {
    if (typeof nickname !== "string" || nickname.trim().length > 10) {
      return { ok: false, error: "nickname은 최대 10자의 문자열이어야 합니다." };
    }
    trimmedNickname = nickname.trim().length === 0 ? null : nickname.trim();
  }

  return { ok: true, data: { sharerType: sharerType.trim(), nickname: trimmedNickname } };
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

  const { sharerType, nickname } = validation.data;

  for (let attempt = 0; attempt < MAX_GENERATE_ATTEMPTS; attempt += 1) {
    const sharerCode = generateCode();
    const { error } = await supabase
      .from("sharers")
      .insert({ code: sharerCode, type: sharerType, nickname });

    if (!error) {
      res.status(200).json({ sharerCode, sharerType });
      return;
    }

    if (error.code !== UNIQUE_VIOLATION) {
      console.error("Supabase insert error in generate-code handler:", error);
      res.status(502).json({ error: `공유 코드 저장에 실패했습니다: ${error.message}` });
      return;
    }
    // 코드 중복(unique violation) — 새 코드로 재시도
  }

  res.status(500).json({ error: "고유한 공유 코드를 생성하지 못했습니다. 잠시 후 다시 시도해주세요." });
}
