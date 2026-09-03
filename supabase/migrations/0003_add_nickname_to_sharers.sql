-- 공유자가 자신을 나타낼 닉네임을 선택적으로 남길 수 있도록 sharers 테이블에 컬럼 추가
-- Supabase 대시보드 > SQL Editor에 그대로 붙여넣어 실행하세요.

alter table public.sharers
  add column if not exists nickname text;
