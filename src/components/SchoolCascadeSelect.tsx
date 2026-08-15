import { useEffect, useState } from "react";
import {
  getSchoolCities,
  getSchoolDistricts,
  getSchoolList,
  type RosterRow,
} from "../lib/api";
import {
  CHAT_SURVEY_CITIES,
  chatCityOnlyId,
  isChatFullSchoolCity,
} from "../lib/chatSchoolCities";

type Props = {
  disabled?: boolean;
  selectedRow: RosterRow | null;
  onSelect: (row: RosterRow | null) => void;
  onAvailability?: (hasData: boolean) => void;
  /** 학교 정보 미입력 여부 */
  onSkipChange?: (skipped: boolean) => void;
  /**
   * roster: 조짜기 — 엑셀에 있는 도시만
   * chat: 채팅방 — 전국 17개 도시, 대전·대구만 시군구·학교 선택
   */
  regionMode?: "roster" | "chat";
};

export function SchoolCascadeSelect({
  disabled,
  selectedRow,
  onSelect,
  onAvailability,
  onSkipChange,
  regionMode = "roster",
}: Props) {
  const isChat = regionMode === "chat";
  const [cities, setCities] = useState<string[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [schools, setSchools] = useState<
    {
      id: string;
      school: string;
      label: string;
      cells?: Record<string, string>;
    }[]
  >([]);
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [skipped, setSkipped] = useState(false);
  const [loadingCities, setLoadingCities] = useState(true);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingSchools, setLoadingSchools] = useState(false);
  const [error, setError] = useState("");

  const fullCascade = !isChat || isChatFullSchoolCity(city);
  const cityOnlyMode = isChat && !!city && !isChatFullSchoolCity(city);
  const selectsDisabled = disabled || skipped;
  const districtSchoolDisabled = selectsDisabled || !city || cityOnlyMode;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoadingCities(true);
      setError("");
      try {
        if (isChat) {
          if (cancelled) return;
          setCities([...CHAT_SURVEY_CITIES]);
          onAvailability?.(true);
        } else {
          const { cities: list } = await getSchoolCities();
          if (cancelled) return;
          setCities(list);
          onAvailability?.(list.length > 0);
        }
      } catch (e) {
        if (cancelled) return;
        setCities([]);
        onAvailability?.(false);
        setError(e instanceof Error ? e.message : "도시 목록을 불러오지 못했습니다.");
      } finally {
        if (!cancelled) setLoadingCities(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [onAvailability, isChat]);

  useEffect(() => {
    if (!city || skipped || !fullCascade) {
      setDistricts([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoadingDistricts(true);
      setError("");
      try {
        const { districts: list } = await getSchoolDistricts(city);
        if (cancelled) return;
        setDistricts(list);
      } catch (e) {
        if (cancelled) return;
        setDistricts([]);
        setError(e instanceof Error ? e.message : "시군구 목록을 불러오지 못했습니다.");
      } finally {
        if (!cancelled) setLoadingDistricts(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [city, skipped, fullCascade]);

  useEffect(() => {
    if (!city || !district || skipped || !fullCascade) {
      setSchools([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoadingSchools(true);
      setError("");
      try {
        const { schools: list } = await getSchoolList(city, district);
        if (cancelled) return;
        setSchools(list);
      } catch (e) {
        if (cancelled) return;
        setSchools([]);
        setError(e instanceof Error ? e.message : "학교 목록을 불러오지 못했습니다.");
      } finally {
        if (!cancelled) setLoadingSchools(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [city, district, skipped, fullCascade]);

  function clearCascade() {
    setCity("");
    setDistrict("");
    setSchools([]);
    onSelect(null);
  }

  function toggleSkip() {
    const next = !skipped;
    setSkipped(next);
    onSkipChange?.(next);
    if (next) {
      clearCascade();
    }
  }

  function selectCityOnly(nextCity: string) {
    onSelect({
      id: chatCityOnlyId(nextCity),
      label: nextCity,
      cells: {
        도시명: nextCity,
      },
    });
  }

  function resetFromCity(nextCity: string) {
    setCity(nextCity);
    setDistrict("");
    setSchools([]);
    if (!nextCity) {
      onSelect(null);
      return;
    }
    if (isChat && !isChatFullSchoolCity(nextCity)) {
      selectCityOnly(nextCity);
    } else {
      onSelect(null);
    }
  }

  function resetFromDistrict(nextDistrict: string) {
    setDistrict(nextDistrict);
    onSelect(null);
  }

  function pickSchool(schoolId: string) {
    const found = schools.find((s) => s.id === schoolId);
    if (!found) {
      onSelect(null);
      return;
    }
    onSelect({
      id: found.id,
      label: found.label || found.school,
      cells: {
        도시명: city,
        시군구: district,
        학교명: found.school,
        ...(found.cells ?? {}),
      },
    });
  }

  if (selectedRow && !skipped) {
    const isCityOnlySelection =
      isChat && selectedRow.id.startsWith("city-only:");
    // 채팅방·도시만 선택: 시군구/학교 비활성 상태를 그대로 보여 줌
    if (!isCityOnlySelection) {
      const cityLabel = selectedRow.cells["도시명"] || city;
      const districtLabel = selectedRow.cells["시군구"] || district;
      const schoolLabel = selectedRow.cells["학교명"] || selectedRow.label;
      return (
        <div className="roster-pick-section">
          <h2 className="section-title">학교 선택</h2>
          <div className="roster-selected-box">
            <span className="roster-selected-label">선택됨</span>
            <strong>
              {cityLabel} · {districtLabel} · {schoolLabel}
            </strong>
            <button
              type="button"
              className="btn btn-sm"
              disabled={disabled}
              onClick={() => {
                onSelect(null);
                setCity("");
                setDistrict("");
                setSchools([]);
              }}
            >
              다시 선택
            </button>
          </div>
        </div>
      );
    }
  }

  return (
    <div className="roster-pick-section">
      <h2 className="section-title">학교 선택</h2>
      <p className={`api-banner-detail ${isChat ? "school-cascade-hint" : ""}`}>
        {isChat
          ? "도시명을 선택해 주세요. 대전·대구는 시군구 → 학교명까지 선택합니다."
          : "도시명 → 시군구 → 학교명 순으로 선택해 주세요."}
      </p>

      <button
        type="button"
        className={`btn btn-sm school-skip-btn ${skipped ? "is-active" : ""}`}
        disabled={disabled}
        onClick={toggleSkip}
      >
        {skipped ? "학교 정보 다시 입력할래요" : "학교 정보 미입력할래요"}
      </button>

      {skipped && (
        <p className="api-banner-detail school-skip-hint">
          학교 정보를 입력하지 않습니다. 아래 이름만 작성해 주세요.
        </p>
      )}

      <div className="field">
        <label className="label" htmlFor="school-city">
          도시명
        </label>
        <select
          id="school-city"
          className="input"
          value={city}
          disabled={selectsDisabled || loadingCities}
          onChange={(e) => resetFromCity(e.target.value)}
        >
          <option value="">
            {loadingCities ? "불러오는 중..." : "도시 선택"}
          </option>
          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label className="label" htmlFor="school-district">
          시군구
        </label>
        <select
          id="school-district"
          className="input"
          value={district}
          disabled={districtSchoolDisabled || loadingDistricts}
          onChange={(e) => resetFromDistrict(e.target.value)}
        >
          <option value="">
            {cityOnlyMode
              ? "이 지역은 선택 불가"
              : !city
                ? "도시를 먼저 선택"
                : loadingDistricts
                  ? "불러오는 중..."
                  : "시군구 선택"}
          </option>
          {districts.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label className="label" htmlFor="school-name">
          학교명
        </label>
        <select
          id="school-name"
          className="input"
          value=""
          disabled={districtSchoolDisabled || !district || loadingSchools}
          onChange={(e) => pickSchool(e.target.value)}
        >
          <option value="">
            {cityOnlyMode
              ? "이 지역은 선택 불가"
              : !district
                ? "시군구를 먼저 선택"
                : loadingSchools
                  ? "불러오는 중..."
                  : schools.length
                    ? "학교 선택"
                    : "학교 없음"}
          </option>
          {schools.map((s) => (
            <option key={s.id} value={s.id}>
              {s.school}
            </option>
          ))}
        </select>
      </div>

      {cityOnlyMode && (
        <p className="api-banner-detail school-cascade-hint">
          선택하신 지역은 시군구·학교명 데이터가 없어 도시명만 저장됩니다.
        </p>
      )}

      {error && <p className="error-msg">{error}</p>}
    </div>
  );
}
