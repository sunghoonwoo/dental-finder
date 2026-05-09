"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    kakao: any;
  }
}

type Props = { lat: number; lng: number; name: string };

export default function KakaoMap({ lat, lng, name }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;

    const initMap = () => {
      if (!mapRef.current) return;
      window.kakao.maps.load(() => {
        const center = new window.kakao.maps.LatLng(lat, lng);
        const map = new window.kakao.maps.Map(mapRef.current!, {
          center,
          level: 3,
        });
        new window.kakao.maps.Marker({ position: center }).setMap(map);
      });
    };

    if (window.kakao) {
      initMap();
    } else {
      const script = document.createElement("script");
      script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${key}&autoload=false`;
      script.onload = initMap;
      document.head.appendChild(script);
    }
  }, [lat, lng, name]);

  return (
    <div
      ref={mapRef}
      style={{ width: "100%", height: "200px" }}
      className="rounded-xl overflow-hidden"
    />
  );
}
