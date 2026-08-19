-- 케미(궁합) 기능을 위한 sharers / visits 테이블 생성
-- Supabase 대시보드 > SQL Editor에 그대로 붙여넣어 실행하세요.

create extension if not exists "pgcrypto";

-- 카드를 완성하고 공유 코드를 발급받은 사람 (POST /api/chemistry/generate-code)
create table if not exists public.sharers (
  code text primary key,
  type text not null,
  created_at timestamptz not null default now()
);

-- 공유 링크(?ref=code)로 들어와서 자기 카드를 완성한 방문자 기록 (POST /api/chemistry/visit)
create table if not exists public.visits (
  id uuid primary key default gen_random_uuid(),
  sharer_code text not null references public.sharers (code) on delete cascade,
  sharer_type text not null,
  visitor_type text not null,
  created_at timestamptz not null default now()
);

-- GET /api/chemistry/my-visitors?code=... 에서 sharer_code 기준 최신순 조회에 사용
create index if not exists visits_sharer_code_created_at_idx
  on public.visits (sharer_code, created_at desc);

alter table public.sharers enable row level security;
alter table public.visits enable row level security;

-- 백엔드 API는 SUPABASE_SERVICE_ROLE_KEY로 접근하며, 서비스 롤은 RLS를 우회하므로
-- 별도 정책 없이도 동작합니다. SUPABASE_ANON_KEY를 사용할 계획이라면 아래 정책의
-- 주석을 해제해서 anon 역할에 필요한 권한을 부여하세요.
--
-- create policy "Allow anon insert on sharers" on public.sharers
--   for insert to anon with check (true);
-- create policy "Allow anon select on sharers" on public.sharers
--   for select to anon using (true);
-- create policy "Allow anon insert on visits" on public.visits
--   for insert to anon with check (true);
-- create policy "Allow anon select on visits" on public.visits
--   for select to anon using (true);
