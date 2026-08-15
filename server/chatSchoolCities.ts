/** 채팅방 설문 — 도시만 선택(시군구·학교 없음) 시 rosterRowId 접두사 */
export const CHAT_CITY_ONLY_PREFIX = "city-only:";

export const CHAT_SURVEY_CITIES = [
  "서울특별시",
  "부산광역시",
  "대구광역시",
  "인천광역시",
  "광주광역시",
  "대전광역시",
  "울산광역시",
  "세종특별자치시",
  "경기도",
  "강원특별자치도",
  "충청북도",
  "충청남도",
  "전라북도",
  "전라남도",
  "경상북도",
  "경상남도",
  "제주특별자치도",
] as const;

export function parseChatCityOnlyId(rosterRowId: string): string | null {
  if (!rosterRowId.startsWith(CHAT_CITY_ONLY_PREFIX)) return null;
  const city = rosterRowId.slice(CHAT_CITY_ONLY_PREFIX.length).trim();
  if (!city) return null;
  if (!(CHAT_SURVEY_CITIES as readonly string[]).includes(city)) return null;
  return city;
}
