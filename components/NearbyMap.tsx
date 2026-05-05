"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window { kakao: any; }
}

export type MapClinic = {
  clinic_id: string;
  name: string;
  lat: number;
  lng: number;
  color: string;
};

type Props = {
  userPos: { lat: number; lng: number };
  clinics: MapClinic[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export default function NearbyMap({ userPos, clinics, selectedId, onSelect }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const kakaoMapRef = useRef<any>(null);
  const overlaysRef = useRef<any[]>([]);
  const boundsFittedRef = useRef(false);

  const clinicsRef = useRef(clinics);
  const selectedIdRef = useRef(selectedId);
  const onSelectRef = useRef(onSelect);
  const userPosRef = useRef(userPos);
  clinicsRef.current = clinics;
  selectedIdRef.current = selectedId;
  onSelectRef.current = onSelect;
  userPosRef.current = userPos;

  function placeMarkers() {
    const map = kakaoMapRef.current;
    if (!map || !window.kakao?.maps?.LatLng) return;

    overlaysRef.current.forEach((o) => o.setMap(null));
    overlaysRef.current = [];

    clinicsRef.current
      .filter((c) => c.lat && c.lng)
      .forEach((c) => {
        const isSelected = c.clinic_id === selectedIdRef.current;
        const el = document.createElement("div");
        el.style.cssText = [
          `width:${isSelected ? 18 : 12}px`,
          `height:${isSelected ? 18 : 12}px`,
          `background:${c.color}`,
          "border-radius:50%",
          `border:${isSelected ? "3px" : "2px"} solid white`,
          "box-shadow:0 1px 4px rgba(0,0,0,0.4)",
          "cursor:pointer",
        ].join(";");
        el.addEventListener("click", () => onSelectRef.current(c.clinic_id));

        const overlay = new window.kakao.maps.CustomOverlay({
          position: new window.kakao.maps.LatLng(c.lat, c.lng),
          content: el,
          yAnchor: 0.5,
          xAnchor: 0.5,
          zIndex: isSelected ? 10 : 1,
        });
        overlay.setMap(map);
        overlaysRef.current.push(overlay);
      });
  }

  function fitBounds() {
    const map = kakaoMapRef.current;
    if (!map || !window.kakao?.maps?.LatLngBounds) return;
    const valid = clinicsRef.current.filter((c) => c.lat && c.lng);
    if (valid.length === 0) return;
    const bounds = new window.kakao.maps.LatLngBounds();
    bounds.extend(new window.kakao.maps.LatLng(userPosRef.current.lat, userPosRef.current.lng));
    valid.forEach((c) => bounds.extend(new window.kakao.maps.LatLng(c.lat, c.lng)));
    map.setBounds(bounds, 60);
  }

  useEffect(() => {
    boundsFittedRef.current = false;
    let destroyed = false;

    function createMap() {
      if (destroyed || !mapRef.current) return;
      window.kakao.maps.load(() => {
        if (destroyed || !mapRef.current) return;
        const center = new window.kakao.maps.LatLng(userPosRef.current.lat, userPosRef.current.lng);
        const map = new window.kakao.maps.Map(mapRef.current, { center, level: 6 });
        kakaoMapRef.current = map;

        // 내 위치 파란 원
        const el = document.createElement("div");
        el.style.cssText =
          "width:14px;height:14px;background:#3b82f6;border-radius:50%;" +
          "border:3px solid white;box-shadow:0 0 0 4px rgba(59,130,246,0.22);";
        new window.kakao.maps.CustomOverlay({
          position: center,
          content: el,
          yAnchor: 0.5,
          xAnchor: 0.5,
          zIndex: 99,
        }).setMap(map);

        placeMarkers();
      });
    }

    // 이미 스크립트가 로드됐으면 바로 초기화
    if (window.kakao) {
      createMap();
    } else {
      // 중복 스크립트 방지
      let script = document.querySelector<HTMLScriptElement>('script[src*="dapi.kakao.com/v2/maps"]');
      if (!script) {
        script = document.createElement("script");
        script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_JS_KEY}&autoload=false`;
        document.head.appendChild(script);
      }
      script.addEventListener("load", createMap);
    }

    return () => {
      destroyed = true;
      overlaysRef.current.forEach((o) => o.setMap(null));
      overlaysRef.current = [];
      kakaoMapRef.current = null;
    };
  }, [userPos.lat, userPos.lng]);

  useEffect(() => {
    if (!boundsFittedRef.current && clinics.length > 0) {
      fitBounds();
      boundsFittedRef.current = true;
    }
    placeMarkers();
  }, [clinics]);

  useEffect(() => {
    placeMarkers();
  }, [selectedId]);

  return (
    <div
      ref={mapRef}
      className="w-full rounded-xl overflow-hidden"
      style={{ height: "200px" }}
    />
  );
}
