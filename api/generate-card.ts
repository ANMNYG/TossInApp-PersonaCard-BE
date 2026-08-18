import type { VercelRequest, VercelResponse } from "@vercel/node";

type Element = "fire" | "water" | "earth" | "air";

interface GenerateCardRequestBody {
  element: Element;
  personaTitle: string;
  colorPrimary: string;
  colorSecondary: string;
}

const VALID_ELEMENTS: Element[] = ["fire", "water", "earth", "air"];

// TODO: 프로덕션에서는 앱인토스 미니앱의 실제 origin으로 좁혀주세요.
// 예: process.env.ALLOWED_ORIGIN = "https://apps-in-toss.example.com"
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? "*";

const GEMINI_MODEL = "gemini-2.5-flash-image";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const GEMINI_TIMEOUT_MS = 45_000;

const ELEMENT_STYLE: Record<Element, string> = {
  fire: "blazing fire element, embers, flame aura, molten energy",
  water: "flowing water element, mist, waves, glowing liquid energy",
  earth: "sturdy earth element, stone, crystals, mossy natural energy",
  air: "swirling air element, wind currents, feathers, light airy energy",
};

function isValidHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value);
}

function validateBody(body: unknown): { ok: true; data: GenerateCardRequestBody } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "요청 본문이 올바른 JSON 객체가 아닙니다." };
  }

  const { element, personaTitle, colorPrimary, colorSecondary } = body as Record<string, unknown>;

  if (typeof element !== "string" || !VALID_ELEMENTS.includes(element as Element)) {
    return { ok: false, error: `element는 ${VALID_ELEMENTS.join(", ")} 중 하나여야 합니다.` };
  }

  if (typeof personaTitle !== "string" || personaTitle.trim().length === 0 || personaTitle.length > 80) {
    return { ok: false, error: "personaTitle은 1~80자의 문자열이어야 합니다." };
  }

  if (!isValidHexColor(colorPrimary)) {
    return { ok: false, error: "colorPrimary는 '#RRGGBB' 형식의 색상 코드여야 합니다." };
  }

  if (!isValidHexColor(colorSecondary)) {
    return { ok: false, error: "colorSecondary는 '#RRGGBB' 형식의 색상 코드여야 합니다." };
  }

  return {
    ok: true,
    data: {
      element: element as Element,
      personaTitle: personaTitle.trim(),
      colorPrimary,
      colorSecondary,
    },
  };
}

function buildPrompt({ element, personaTitle, colorPrimary, colorSecondary }: GenerateCardRequestBody): string {
  return [
    `A fantasy trading card illustration for a character named "${personaTitle}".`,
    `Element: ${element} — ${ELEMENT_STYLE[element]}.`,
    `Primary color: ${colorPrimary}, secondary color: ${colorSecondary}. Use these two colors prominently in the character's outfit, aura, and background lighting.`,
    "Style: highly detailed digital fantasy card art, dramatic lighting, portrait composition, vibrant colors, ornate card border, semi-realistic painterly style.",
    "No text, no watermark, no logo in the image.",
  ].join(" ");
}

function setCorsHeaders(res: VercelResponse): void {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");
}

interface GeminiInlineData {
  mimeType: string;
  data: string;
}

interface GeminiPart {
  inlineData?: GeminiInlineData;
  text?: string;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: GeminiPart[];
    };
    finishReason?: string;
  }>;
  promptFeedback?: {
    blockReason?: string;
  };
}

async function callGeminiImageApi(prompt: string, apiKey: string): Promise<GeminiInlineData> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new GeminiApiError("Gemini API 호출이 시간 초과되었습니다.", 504);
    }
    throw new GeminiApiError("Gemini API 호출 중 네트워크 오류가 발생했습니다.", 502);
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    let detail = "";
    try {
      const errBody = (await response.json()) as { error?: { message?: string } };
      detail = errBody?.error?.message ?? "";
    } catch {
      // 응답 본문이 JSON이 아닌 경우 무시
    }
    throw new GeminiApiError(
      `Gemini API 호출에 실패했습니다 (status: ${response.status}).${detail ? ` ${detail}` : ""}`,
      response.status === 401 || response.status === 403 ? 502 : response.status
    );
  }

  const data = (await response.json()) as GeminiResponse;

  if (data.promptFeedback?.blockReason) {
    throw new GeminiApiError(
      `요청이 안전 정책에 의해 차단되었습니다: ${data.promptFeedback.blockReason}`,
      422
    );
  }

  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((part) => part.inlineData?.data);

  if (!imagePart?.inlineData) {
    throw new GeminiApiError("Gemini API 응답에서 이미지를 찾을 수 없습니다.", 502);
  }

  return imagePart.inlineData;
}

class GeminiApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "GeminiApiError";
    this.status = status;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "지원하지 않는 메서드입니다. POST를 사용해주세요." });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "서버에 GEMINI_API_KEY가 설정되어 있지 않습니다." });
    return;
  }

  const validation = validateBody(req.body);
  if (!validation.ok) {
    res.status(400).json({ error: validation.error });
    return;
  }

  const prompt = buildPrompt(validation.data);

  try {
    const inlineData = await callGeminiImageApi(prompt, apiKey);
    res.status(200).json({
      image: {
        mimeType: inlineData.mimeType,
        base64: inlineData.data,
      },
      prompt,
    });
  } catch (err) {
    if (err instanceof GeminiApiError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error("Unexpected error in generate-card handler:", err);
    res.status(500).json({ error: "이미지 생성 중 알 수 없는 오류가 발생했습니다." });
  }
}
