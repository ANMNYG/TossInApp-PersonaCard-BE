import { createClient, SupabaseClient } from "@supabase/supabase-js";

export class SupabaseConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupabaseConfigError";
  }
}

let cachedClient: SupabaseClient | null = null;

// 서비스 롤 키가 있으면 우선 사용(RLS 우회, 서버 전용). 없으면 anon 키로 폴백.
export function getSupabaseClient(): SupabaseClient {
  if (cachedClient) {
    return cachedClient;
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new SupabaseConfigError(
      "Supabase 연결 설정이 누락되었습니다. SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY(또는 SUPABASE_ANON_KEY) 환경변수를 설정해주세요."
    );
  }

  cachedClient = createClient(url, key, {
    auth: { persistSession: false },
  });
  return cachedClient;
}
