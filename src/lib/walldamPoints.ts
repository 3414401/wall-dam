/** 월담 포인트 — 지역 키 (지도 영역 id와 맞춤) */
export type WalldamRegionKey =
  | "seoulGyeonggi"
  | "busanUlsanGyeongnam"
  | "daeguGyeongbuk"
  | "gwangjuJeonnam"
  | "daejeonChungcheong"
  | "gangwon"
  | "jeonbuk"
  | "jeju";

export type WalldamPointKey = "total" | WalldamRegionKey;

export interface WalldamPoints {
  total: number;
  seoulGyeonggi: number;
  busanUlsanGyeongnam: number;
  daeguGyeongbuk: number;
  gwangjuJeonnam: number;
  daejeonChungcheong: number;
  gangwon: number;
  jeonbuk: number;
  jeju: number;
}

export const EMPTY_WALLDAM_POINTS: WalldamPoints = {
  total: 0,
  seoulGyeonggi: 0,
  busanUlsanGyeongnam: 0,
  daeguGyeongbuk: 0,
  gwangjuJeonnam: 0,
  daejeonChungcheong: 0,
  gangwon: 0,
  jeonbuk: 0,
  jeju: 0,
};

export const WALLDAM_REGION_META: {
  key: WalldamRegionKey;
  mapId: string;
  label: string;
  pointLabel: string;
}[] = [
  {
    key: "seoulGyeonggi",
    mapId: "seoul-gyeonggi",
    label: "서울/\n경기",
    pointLabel: "서울/경기 포인트",
  },
  {
    key: "gangwon",
    mapId: "gangwon",
    label: "강원",
    pointLabel: "강원 포인트",
  },
  {
    key: "daejeonChungcheong",
    mapId: "chungcheong",
    label: "대전/충남/\n충북",
    pointLabel: "대전/충남/충북 포인트",
  },
  {
    key: "daeguGyeongbuk",
    mapId: "daegu-gyeongbuk",
    label: "대구/경북",
    pointLabel: "대구/경북 포인트",
  },
  {
    key: "jeonbuk",
    mapId: "jeonbuk",
    label: "전북",
    pointLabel: "전북 포인트",
  },
  {
    key: "gwangjuJeonnam",
    mapId: "gwangju-jeonnam",
    label: "광주/\n전남",
    pointLabel: "광주/전남 포인트",
  },
  {
    key: "busanUlsanGyeongnam",
    mapId: "busan-ulsan-gyeongnam",
    label: "부산/울산/경남",
    pointLabel: "부산/울산/경남 포인트",
  },
  {
    key: "jeju",
    mapId: "jeju",
    label: "제주",
    pointLabel: "제주 포인트",
  },
];

/** 채도: 0점 → 0%, 20점 → 100% */
export const WALLDAM_SAT_MAX_POINTS = 20;

export function walldamSaturationPercent(points: number): number {
  const p = Math.max(0, Number(points) || 0);
  return Math.min(100, (p / WALLDAM_SAT_MAX_POINTS) * 100);
}

/** HSL 배경 (채도만 점수에 비례, 0점이면 회색) */
export function walldamRegionBackground(points: number): string {
  const sat = walldamSaturationPercent(points);
  if (sat <= 0) return "#bfbfbf";
  return `hsl(205, ${sat}%, 62%)`;
}

export function addWalldamPoints(a: WalldamPoints, b: WalldamPoints): WalldamPoints {
  return {
    total: a.total + b.total,
    seoulGyeonggi: a.seoulGyeonggi + b.seoulGyeonggi,
    busanUlsanGyeongnam: a.busanUlsanGyeongnam + b.busanUlsanGyeongnam,
    daeguGyeongbuk: a.daeguGyeongbuk + b.daeguGyeongbuk,
    gwangjuJeonnam: a.gwangjuJeonnam + b.gwangjuJeonnam,
    daejeonChungcheong: a.daejeonChungcheong + b.daejeonChungcheong,
    gangwon: a.gangwon + b.gangwon,
    jeonbuk: a.jeonbuk + b.jeonbuk,
    jeju: a.jeju + b.jeju,
  };
}
