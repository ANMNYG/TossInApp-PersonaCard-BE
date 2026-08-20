// 방문자 닉네임을 표시용으로 마스킹한다.
// 1글자: 전부 마스킹. 2글자: 첫 글자만 노출. 3글자 이상: 첫/끝 글자만 노출하고 가운데는 전부 마스킹.
export function maskNickname(nickname: string): string {
  const length = nickname.length;

  if (length <= 1) {
    return "*".repeat(length);
  }

  if (length === 2) {
    return `${nickname[0]}*`;
  }

  return `${nickname[0]}${"*".repeat(length - 2)}${nickname[length - 1]}`;
}
