"use client";

import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from "react";

declare global {
  interface Window { kakao: any; }
}

export type MapClinic = {
  clinic_id: string;
  name: string;
  lat: number;
  lng: number;
};

export type NearbyMapHandle = {
  getCenter: () => { lat: number; lng: number } | null;
  getBounds: () => { sw: { lat: number; lng: number }; ne: { lat: number; lng: number } } | null;
  panTo: (lat: number, lng: number) => void;
  getMap: () => any;
};

type Props = {
  userPos: { lat: number; lng: number };
  clinics: MapClinic[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDoubleClick?: (id: string) => void;
  onBoundsChange?: (bounds: { sw: { lat: number; lng: number }; ne: { lat: number; lng: number } }) => void;
};

const NearbyMap = forwardRef<NearbyMapHandle, Props>(function NearbyMap(
  { userPos, clinics, selectedId, onSelect, onDoubleClick, onBoundsChange },
  ref
) {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const overlaysRef = useRef<any[]>([]);
  const clustererRef = useRef<any>(null);
  const initRef = useRef(false);

  const clinicsRef = useRef(clinics);
  const selectedIdRef = useRef(selectedId);
  const onSelectRef = useRef(onSelect);
  const onDblClickRef = useRef(onDoubleClick);
  
  clinicsRef.current = clinics;
  selectedIdRef.current = selectedId;
  onSelectRef.current = onSelect;
  onDblClickRef.current = onDoubleClick;

  useImperativeHandle(ref, () => ({
    getCenter: () => {
      const m = mapRef.current;
      if (!m) return null;
      const c = m.getCenter();
      return { lat: c.getLat(), lng: c.getLng() };
    },
    getBounds: () => {
      const m = mapRef.current;
      if (!m) return null;
      const b = m.getBounds();
      if (!b) return null;
      return {
        sw: { lat: b.getSouthWest().getLat(), lng: b.getSouthWest().getLng() },
        ne: { lat: b.getNorthEast().getLat(), lng: b.getNorthEast().getLng() },
      };
    },
    panTo: (lat: number, lng: number) => {
      const m = mapRef.current;
      if (!m) return;
      m.panTo(new window.kakao.maps.LatLng(lat, lng));
    },
    getMap: () => mapRef.current,
  }));

  const [mapReady, setMapReady] = useState(false);

  const drawMarkers = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    overlaysRef.current.forEach(o => o.setMap(null));
    overlaysRef.current = [];

    if (clustererRef.current) {
      clustererRef.current.clear();
    }

    const markers: any[] = [];

    clinicsRef.current.forEach(c => {
      if (!c.lat || !c.lng) return;
      const isSelected = c.clinic_id === selectedIdRef.current;

      if (isSelected) {
        const container = document.createElement("div");
        container.style.cssText = "display:flex;flex-direction:column;align-items:center;cursor:pointer;position:relative;";

        const dot = document.createElement("div");
        dot.style.cssText = "width:22px;height:22px;background:#ef4444;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);";
        container.appendChild(dot);

        const label = document.createElement("div");
        label.style.cssText = "position:absolute;bottom:calc(100% + 8px);left:50%;transform:translateX(-50%);padding:4px 10px;background:white;border-radius:6px;font-size:12px;color:#1f2937;font-weight:600;box-shadow:0 2px 8px rgba(0,0,0,0.15);white-space:nowrap;max-width:160px;overflow:hidden;text-overflow:ellipsis;text-align:center;z-index:100;";
        label.textContent = c.name;
        container.appendChild(label);

        let overlayLast = 0;
        container.onclick = (e: any) => {
          e.stopPropagation();
          const now = Date.now();
          if (now - overlayLast < 350) {
            overlayLast = 0;
            onDblClickRef.current?.(c.clinic_id);
          } else {
            overlayLast = now;
            setTimeout(() => {
              if (overlayLast === now) {
                onSelectRef.current(c.clinic_id);
              }
            }, 350);
          }
        };

        const overlay = new window.kakao.maps.CustomOverlay({
          position: new window.kakao.maps.LatLng(c.lat, c.lng),
          content: container,
          yAnchor: 0.8,
          xAnchor: 0.5,
          zIndex: 10,
        });
        overlay.setMap(map);
        overlaysRef.current.push(overlay);
        return;
      }

      const size = 24;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d")!;
      const cx = size / 2, cy = size / 2, r = 9;
      ctx.shadowColor = "rgba(0,0,0,0.25)";
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = "#ef4444";
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "white";
      ctx.lineWidth = 2;
      ctx.stroke();

      const markerImage = new window.kakao.maps.MarkerImage(
        canvas.toDataURL(),
        new window.kakao.maps.Size(size, size),
        { offset: new window.kakao.maps.Point(cx, cy) }
      );

      const marker = new window.kakao.maps.Marker({
        position: new window.kakao.maps.LatLng(c.lat, c.lng),
        image: markerImage,
        zIndex: 1,
      });

      let lastClick = 0;
      window.kakao.maps.event.addListener(marker, "click", () => {
        const now = Date.now();
        if (now - lastClick < 350) {
          lastClick = 0;
          onDblClickRef.current?.(c.clinic_id);
        } else {
          lastClick = now;
          setTimeout(() => {
            if (lastClick === now) {
              onSelectRef.current(c.clinic_id);
            }
          }, 350);
        }
      });

      markers.push(marker);
    });

    if (markers.length > 0) {
      if (!clustererRef.current) {
        clustererRef.current = new window.kakao.maps.MarkerClusterer({
          map,
          markers,
          averageCenter: true,
          minClusterSize: 5,
          gridSize: 60,
          disableClickZoom: false,
          styles: [{
            width: "44px",
            height: "44px",
            background: "linear-gradient(135deg, #818CF8, #6366F1)",
            borderRadius: "22px",
            color: "#fff",
            textAlign: "center" as const,
            lineHeight: "44px",
            fontSize: "14px",
            fontWeight: "700",
            boxShadow: "0 3px 12px rgba(99,102,241,0.35)",
          }],
        });
      } else {
        clustererRef.current.addMarkers(markers);
      }
    }
  }, []);

  useEffect(() => {
    if (mapRef.current) drawMarkers();
  }, [clinics, selectedId, drawMarkers]);

  const initMap = useCallback(() => {
    if (!userPos) {
      console.warn("[NearbyMap] userPos not ready, retrying...");
      return;
    }

    const el = mapDivRef.current;
    if (!el) {
      console.error("[NearbyMap] Map container not found");
      return;
    }

    window.kakao.maps.load(() => {
      const map = new window.kakao.maps.Map(el, {
        center: new window.kakao.maps.LatLng(userPos.lat, userPos.lng),
        level: 4,
      });
      mapRef.current = map;
      setMapReady(true);
      console.log("[NearbyMap] Map initialized at:", userPos);

      // Notify parent of initial bounds
      if (onBoundsChange) {
        const b = map.getBounds();
        if (b) {
          onBoundsChange({
            sw: { lat: b.getSouthWest().getLat(), lng: b.getSouthWest().getLng() },
            ne: { lat: b.getNorthEast().getLat(), lng: b.getNorthEast().getLng() },
          });
        }
      }

      // User dot
      const dot = document.createElement("div");
      dot.style.cssText = "width:20px;height:20px;background:#3b82f6;border-radius:50%;border:3px solid white;box-shadow:0 0 0 4px rgba(59,130,246,0.22);";
      new window.kakao.maps.CustomOverlay({
        position: new window.kakao.maps.LatLng(userPos.lat, userPos.lng),
        content: dot,
        yAnchor: 0.5, xAnchor: 0.5, zIndex: 99,
      }).setMap(map);

      drawMarkers();
    });
  }, [userPos, drawMarkers, onBoundsChange]);

  useEffect(() => {
    const el = mapDivRef.current;
    if (!el) return;

    const key = process.env.NEXT_PUBLIC_KAKAO_JS_KEY || process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;
    if (!key) {
      console.error("[NearbyMap] KAKAO_JS_KEY or KAKAO_MAP_KEY not found");
      return;
    }

    const loadScript = () => {
      if (window.kakao) {
        initMap();
        return;
      }

      const script = document.createElement("script");
      script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${key}&libraries=clusterer&autoload=false`;
      script.async = true;
      script.onload = () => initMap();
      script.onerror = () => {
        console.error("[NearbyMap] Failed to load Kakao Maps SDK");
      };
      document.head.appendChild(script);
    };

    loadScript();

    return () => {
      overlaysRef.current.forEach(o => o.setMap(null));
      if (clustererRef.current) clustererRef.current.clear();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  // Re-initialize map when userPos becomes available after mount
  useEffect(() => {
    if (userPos && mapDivRef.current && !mapRef.current && window.kakao) {
      initMap();
    }
  }, [userPos, initMap]);

  // Notify parent of map bounds changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !onBoundsChange) return;

    const notifyBounds = () => {
      const b = map.getBounds();
      if (b) {
        onBoundsChange({
          sw: { lat: b.getSouthWest().getLat(), lng: b.getSouthWest().getLng() },
          ne: { lat: b.getNorthEast().getLat(), lng: b.getNorthEast().getLng() },
        });
      }
    };

    window.kakao.maps.event.addListener(map, 'idle', notifyBounds);
    window.kakao.maps.event.addListener(map, 'dragend', notifyBounds);
    window.kakao.maps.event.addListener(map, 'zoom_changed', notifyBounds);

    return () => {
      if (window.kakao) {
        window.kakao.maps.event.removeListener(map, 'idle', notifyBounds);
        window.kakao.maps.event.removeListener(map, 'dragend', notifyBounds);
        window.kakao.maps.event.removeListener(map, 'zoom_changed', notifyBounds);
      }
    };
  }, [onBoundsChange]);

  return (
    <div ref={mapDivRef} style={{ width: "100%", height: "100%", borderRadius: "32px", overflow: "hidden", position: "relative" }} />
  );
});

export default NearbyMap;
