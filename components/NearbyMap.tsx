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
  onDoubleClick?: (id: string) => void;
  onBoundsChanged?: (bounds: { sw: { lat: number; lng: number }; ne: { lat: number; lng: number } }) => void;
};

export default function NearbyMap({ userPos, clinics, selectedId, onSelect, onDoubleClick, onBoundsChanged }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const kakaoMapRef = useRef<any>(null);
  const overlaysRef = useRef<any[]>([]);
  const mapReadyRef = useRef(false);
  const onBoundsChangedRef = useRef(onBoundsChanged);
  const onDoubleClickRef = useRef(onDoubleClick);

  // Inject pulse animation styles
  useEffect(() => {
    const styleId = 'pulse-animation-style';
    if (document.getElementById(styleId)) return;
    
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @keyframes pulse {
        0% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.4); opacity: 0.6; }
        100% { transform: scale(1); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      const el = document.getElementById(styleId);
      if (el) el.remove();
    };
  }, []);

  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastClickTimeRef = useRef(0);

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
        const size = isSelected ? 22 : 20;

        // Create container for marker + label
        const container = document.createElement("div");
        container.style.cssText = "display:flex; flex-direction:column; align-items:center; cursor:pointer;";

        // Marker circle - red with pulse animation
        const marker = document.createElement("div");
        marker.style.cssText = [
          `width:${size}px`,
          `height:${size}px`,
          "background:#ef4444",
          "border-radius:50%",
          `border:${isSelected ? "3px" : "2px"} solid white`,
          "box-shadow:0 2px 6px rgba(0,0,0,0.3)",
          "animation:pulse 2s ease-in-out infinite",
        ].join(";");

        container.appendChild(marker);

        // Name label - show above marker when selected
        if (isSelected) {
          const label = document.createElement("div");
          label.style.cssText = [
            "position:absolute",
            "bottom:calc(100% + 8px)",
            "left:50%",
            "transform:translateX(-50%)",
            "padding:4px 10px",
            "background:white",
            "border-radius:6px",
            "font-size:12px",
            "color:#1f2937",
            "font-weight:600",
            "box-shadow:0 2px 8px rgba(0,0,0,0.15)",
            "white-space:nowrap",
            "max-width:160px",
            "overflow:hidden",
            "text-overflow:ellipsis",
            "text-align:center",
            "z-index:100",
          ].join(";");
          label.textContent = c.name;
          container.style.position = "relative";
          container.appendChild(label);
        }

        container.addEventListener("click", (e) => {
          e.stopPropagation();
          const now = Date.now();
          if (now - lastClickTimeRef.current < 300) {
            // Double click detected
            if (clickTimeoutRef.current) {
              clearTimeout(clickTimeoutRef.current);
              clickTimeoutRef.current = null;
            }
            lastClickTimeRef.current = 0;
            onDoubleClickRef.current?.(c.clinic_id);
          } else {
            lastClickTimeRef.current = now;
            clickTimeoutRef.current = setTimeout(() => {
              onSelectRef.current(c.clinic_id);
              clickTimeoutRef.current = null;
            }, 300);
          }
        });

        const overlay = new window.kakao.maps.CustomOverlay({
          position: new window.kakao.maps.LatLng(c.lat, c.lng),
          content: container,
          yAnchor: isSelected ? 0.8 : 0.7,
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
    map.setBounds(bounds, 20);
  }

  useEffect(() => {
    mapReadyRef.current = false;
    let destroyed = false;

    function createMap() {
      if (destroyed || !mapRef.current) return;
      window.kakao.maps.load(() => {
        if (destroyed || !mapRef.current) return;
        const userLat = userPosRef.current.lat;
        const userLng = userPosRef.current.lng;
        const delta = 1 / 111; // ~0.009 degrees = 1km radius
        const map = new window.kakao.maps.Map(mapRef.current, {
          center: new window.kakao.maps.LatLng(userLat, userLng)
        });
        // Set initial bounds to 5km radius
        const initBounds = new window.kakao.maps.LatLngBounds(
          new window.kakao.maps.LatLng(userLat - delta, userLng - delta),
          new window.kakao.maps.LatLng(userLat + delta, userLng + delta)
        );
        map.setBounds(initBounds, 0);
        kakaoMapRef.current = map;

        // Notify parent of bounds changes
        if (onBoundsChangedRef.current) {
          const notifyBounds = () => {
            const bounds = map.getBounds();
            if (bounds) {
              const sw = bounds.getSouthWest();
              const ne = bounds.getNorthEast();
              onBoundsChangedRef.current?.({
                sw: { lat: sw.getLat(), lng: sw.getLng() },
                ne: { lat: ne.getLat(), lng: ne.getLng() },
              });
            }
          };
          window.kakao.maps.event.addListener(map, "idle", notifyBounds);
          notifyBounds(); // Initial bounds
        }

        // 내 위치 파란 원
        const el = document.createElement("div");
        el.style.cssText = [
          "width:20px",
          "height:20px",
          "background:#3b82f6",
          "border-radius:50%",
          "border:3px solid white",
          "box-shadow:0 0 0 4px rgba(59,130,246,0.22)",
          "box-shadow:0 2px 8px rgba(0,0,0,0.3)",
        ].join(";");
        new window.kakao.maps.CustomOverlay({
          position: new window.kakao.maps.LatLng(userLat, userLng),
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
    if (kakaoMapRef.current && clinics.length > 0) {
      placeMarkers();
    }
  }, [clinics, selectedId]);

  return (
    <div
      ref={mapRef}
      className="w-full rounded-xl overflow-hidden"
      style={{ height: "200px" }}
    />
  );
}
