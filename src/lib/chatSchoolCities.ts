/** 채팅방 설문 도시명 선택지 (17개) */
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

/** 시군구·학교명까지 선택 가능한 도시 (엑셀 데이터 있음) */
export const CHAT_FULL_SCHOOL_CITIES = ["대전광역시", "대구광역시"] as const;

export type ChatSurveyCity = (typeof CHAT_SURVEY_CITIES)[number];

export function isChatFullSchoolCity(city: string): boolean {
  return (CHAT_FULL_SCHOOL_CITIES as readonly string[]).includes(city);
}

export function isChatCityOnlyId(rosterRowId: string | undefined): boolean {
  return !!rosterRowId?.startsWith("city-only:");
}

export function chatCityOnlyId(city: string): string {
  return `city-only:${city}`;
}

export function parseChatCityOnlyId(rosterRowId: string): string | null {
  if (!rosterRowId.startsWith("city-only:")) return null;
  return rosterRowId.slice("city-only:".length).trim() || null;
}
