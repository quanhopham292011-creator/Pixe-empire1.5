import React, { useCallback } from 'react';
import { MapDimension } from '../types';
import { TILE_PIXEL_SIZE } from '../utils/constants';
import { soundManager } from '../utils/audio';

interface UseMapCameraParams {
  mapSize: MapDimension;
  cameraRef: React.MutableRefObject<{ x: number; y: number; zoom: number }>;
  cameraAnimRef: React.MutableRefObject<any>;
  viewportSizeRef: React.MutableRefObject<{ width: number; height: number; dpr: number }>;
  canvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  pointersMapRef: React.MutableRefObject<Map<number, { id: number; x: number; y: number }>>;
  pointerStartRef: React.MutableRefObject<{ id: number; x: number; y: number; time: number } | null>;
  startCamRef: React.MutableRefObject<{ x: number; y: number; zoom: number }>;
  lastPinchDistRef: React.MutableRefObject<number | null>;
  lastPinchMidRef: React.MutableRefObject<{ x: number; y: number } | null>;
  isDraggingRef: React.MutableRefObject<boolean>;
  isMultiTouchActiveRef: React.MutableRefObject<boolean>;
  totalDragDistRef: React.MutableRefObject<number>;
  gameDataRef: React.MutableRefObject<any>;
  nationCentersRef: React.MutableRefObject<Record<number, { px: number; py: number }>>;
  handleMapTap: (mapX: number, mapY: number, clientX: number, clientY: number) => void;
}

export function useMapCamera({
  mapSize,
  cameraRef,
  cameraAnimRef,
  viewportSizeRef,
  canvasRef,
  pointersMapRef,
  pointerStartRef,
  startCamRef,
  lastPinchDistRef,
  lastPinchMidRef,
  isDraggingRef,
  isMultiTouchActiveRef,
  totalDragDistRef,
  gameDataRef,
  nationCentersRef,
  handleMapTap,
}: UseMapCameraParams) {
  // Giới hạn thu phóng mở rộng: Cho phép thu nhỏ bao quát toàn bộ thế giới và phóng to chi tiết
  const clampZoom = useCallback((targetZoom: number) => {
    const vpW = viewportSizeRef.current.width || 360;
    const vpH = viewportSizeRef.current.height || 560;
    const mapPx = mapSize * TILE_PIXEL_SIZE;
    // Fit zoom: mức zoom vừa vặn để thấy trọn vẹn toàn bộ bản đồ thế giới trong khung nhìn
    const fitZoom = Math.min(vpW / mapPx, vpH / mapPx);
    // Tăng giới hạn thu nhỏ (Zoom Out) để người chơi có thể bao quát toàn bộ thế giới kèm lề
    const minZ = Math.max(0.10, fitZoom * 0.88);
    // Cho phép phóng to đủ gần (Zoom In) để quan sát chi tiết lãnh thổ, công trình, quân lính
    const maxZ = 3.6;
    return Math.min(maxZ, Math.max(minZ, targetZoom));
  }, [mapSize, viewportSizeRef]);

  // Giới hạn camera cho phép khám phá toàn bản đồ, không bị kẹt ở phạm vi quá nhỏ
  const clampCamera = useCallback((camX: number, camY: number, zoom: number) => {
    const vpW = viewportSizeRef.current.width || 360;
    const vpH = viewportSizeRef.current.height || 560;
    const mapPxX = mapSize * TILE_PIXEL_SIZE * zoom;
    const mapPxY = mapSize * TILE_PIXEL_SIZE * zoom;

    let clampedX: number;
    if (mapPxX <= vpW) {
      clampedX = (vpW - mapPxX) / 2;
    } else {
      const margin = 200;
      clampedX = Math.min(margin, Math.max(vpW - mapPxX - margin, camX));
    }

    let clampedY: number;
    if (mapPxY <= vpH) {
      clampedY = (vpH - mapPxY) / 2;
    } else {
      const margin = 200;
      clampedY = Math.min(margin, Math.max(vpH - mapPxY - margin, camY));
    }

    return { x: clampedX, y: clampedY };
  }, [mapSize, viewportSizeRef]);

  // Hàm thu phóng quanh tâm chỉ định
  const zoomAroundPoint = useCallback((screenX: number, screenY: number, targetZoom: number) => {
    const curCam = cameraRef.current;
    const finalZoom = clampZoom(targetZoom);
    if (finalZoom === curCam.zoom) return;

    const worldX = (screenX - curCam.x) / curCam.zoom;
    const worldY = (screenY - curCam.y) / curCam.zoom;

    const newCamX = screenX - worldX * finalZoom;
    const newCamY = screenY - worldY * finalZoom;

    const clamped = clampCamera(newCamX, newCamY, finalZoom);
    cameraRef.current = { x: clamped.x, y: clamped.y, zoom: finalZoom };
  }, [clampZoom, clampCamera, cameraRef]);

  // Hàm di chuyển camera mượt mà đến tọa độ thế giới (Smooth Camera Pan Animation)
  const focusOnCoordinates = useCallback((worldX: number, worldY: number, targetZoom?: number, duration: number = 650) => {
    const vpW = viewportSizeRef.current.width || 360;
    const vpH = viewportSizeRef.current.height || 560;
    const finalZoom = targetZoom ? clampZoom(targetZoom) : Math.max(1.2, cameraRef.current.zoom);

    const rawX = vpW / 2 - worldX * finalZoom;
    const rawY = vpH / 2 - worldY * finalZoom;
    const clamped = clampCamera(rawX, rawY, finalZoom);

    cameraAnimRef.current = {
      startX: cameraRef.current.x,
      startY: cameraRef.current.y,
      startZoom: cameraRef.current.zoom,
      targetX: clamped.x,
      targetY: clamped.y,
      targetZoom: finalZoom,
      startTime: performance.now(),
      duration,
    };
  }, [clampCamera, clampZoom, cameraRef, cameraAnimRef, viewportSizeRef]);

  // Chức năng: Về Vương Quốc Của Tôi (Di chuyển camera mượt mà đến trung tâm lãnh thổ người chơi)
  const focusOnPlayerKingdom = useCallback(() => {
    const player = gameDataRef.current.nations[1];
    if (!player) return;

    // Ưu tiên tâm trung bình của toàn bộ lãnh thổ người chơi, nếu chưa có thì dùng Thủ đô
    const center = nationCentersRef.current[1];
    const targetWorldX = center ? center.px : player.capitalX * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2;
    const targetWorldY = center ? center.py : player.capitalY * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2;

    focusOnCoordinates(targetWorldX, targetWorldY, Math.max(1.25, cameraRef.current.zoom));
    soundManager.playClick();
  }, [focusOnCoordinates, gameDataRef, nationCentersRef, cameraRef]);

  // Chức năng: Di chuyển camera đến quốc gia chỉ định (dùng khi bấm vào bảng xếp hạng / ngoại giao)
  const focusOnNation = useCallback((nationId: number) => {
    const nation = gameDataRef.current.nations[nationId];
    if (!nation) return;

    const center = nationCentersRef.current[nationId];
    const targetWorldX = center ? center.px : nation.capitalX * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2;
    const targetWorldY = center ? center.py : nation.capitalY * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2;

    focusOnCoordinates(targetWorldX, targetWorldY, Math.max(1.2, cameraRef.current.zoom));
    soundManager.playClick();
  }, [focusOnCoordinates, gameDataRef, nationCentersRef, cameraRef]);

  // Pointer Handlers: Thu phóng và di chuyển mượt mà trên điện thoại, triệt tiêu chọn nhầm ô đất
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.target !== canvasRef.current) {
      return;
    }
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    cameraAnimRef.current = null;
    const map = pointersMapRef.current;
    map.set(e.pointerId, { id: e.pointerId, x: e.clientX, y: e.clientY });

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();

    if (map.size === 1) {
      pointerStartRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY, time: Date.now() };
      startCamRef.current = { ...cameraRef.current };
      isDraggingRef.current = false;
      isMultiTouchActiveRef.current = false;
      totalDragDistRef.current = 0;
      lastPinchDistRef.current = null;
      lastPinchMidRef.current = null;
    } else if (map.size >= 2) {
      isMultiTouchActiveRef.current = true;
      isDraggingRef.current = true;
      const pts = Array.from(map.values());
      lastPinchDistRef.current = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      lastPinchMidRef.current = {
        x: (pts[0].x + pts[1].x) / 2 - rect.left,
        y: (pts[0].y + pts[1].y) / 2 - rect.top,
      };
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const map = pointersMapRef.current;
    if (!map.has(e.pointerId)) return;
    map.set(e.pointerId, { id: e.pointerId, x: e.clientX, y: e.clientY });

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();

    if (map.size >= 2 && lastPinchDistRef.current !== null && lastPinchDistRef.current > 0) {
      isMultiTouchActiveRef.current = true;
      isDraggingRef.current = true;
      const pts = Array.from(map.values());
      const currentDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const currentMid = {
        x: (pts[0].x + pts[1].x) / 2 - rect.left,
        y: (pts[0].y + pts[1].y) / 2 - rect.top,
      };

      const prevDist = lastPinchDistRef.current;
      const prevMid = lastPinchMidRef.current || currentMid;

      if (prevDist > 0 && currentDist > 0) {
        const deltaDist = currentDist - prevDist;
        const zoomDamping = 0.50;
        const zoomMultiplier = 1 + (deltaDist / prevDist) * zoomDamping;

        const curCam = cameraRef.current;
        const targetZoom = clampZoom(curCam.zoom * zoomMultiplier);

        const worldX = (prevMid.x - curCam.x) / curCam.zoom;
        const worldY = (prevMid.y - curCam.y) / curCam.zoom;

        const newCamX = currentMid.x - worldX * targetZoom;
        const newCamY = currentMid.y - worldY * targetZoom;

        const clamped = clampCamera(newCamX, newCamY, targetZoom);
        cameraRef.current = { x: clamped.x, y: clamped.y, zoom: targetZoom };
      }

      lastPinchDistRef.current = currentDist;
      lastPinchMidRef.current = currentMid;
    } else if (map.size === 1 && pointerStartRef.current) {
      const dx = e.clientX - pointerStartRef.current.x;
      const dy = e.clientY - pointerStartRef.current.y;
      const dist = Math.hypot(dx, dy);

      totalDragDistRef.current += Math.hypot(e.movementX || 0, e.movementY || 0);

      if (dist > 8 || totalDragDistRef.current > 10) {
        isDraggingRef.current = true;
      }

      if (isDraggingRef.current) {
        const newX = startCamRef.current.x + dx;
        const newY = startCamRef.current.y + dy;
        const clamped = clampCamera(newX, newY, cameraRef.current.zoom);
        cameraRef.current = { ...cameraRef.current, x: clamped.x, y: clamped.y };
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
    const map = pointersMapRef.current;

    const canTap = map.size === 1 && 
      pointerStartRef.current && 
      pointerStartRef.current.id === e.pointerId && 
      !isDraggingRef.current && 
      !isMultiTouchActiveRef.current &&
      totalDragDistRef.current < 10;

    if (canTap && pointerStartRef.current) {
      const dx = e.clientX - pointerStartRef.current.x;
      const dy = e.clientY - pointerStartRef.current.y;
      const dist = Math.hypot(dx, dy);
      const duration = Date.now() - pointerStartRef.current.time;

      if (dist < 8 && duration < 280) {
        const canvas = canvasRef.current;
        if (canvas) {
          const rect = canvas.getBoundingClientRect();
          const screenX = e.clientX - rect.left;
          const screenY = e.clientY - rect.top;

          const curCam = cameraRef.current;
          const worldX = (screenX - curCam.x) / curCam.zoom;
          const worldY = (screenY - curCam.y) / curCam.zoom;

          const mapX = Math.floor(worldX / TILE_PIXEL_SIZE);
          const mapY = Math.floor(worldY / TILE_PIXEL_SIZE);

          const size = gameDataRef.current.tiles.length;
          if (mapX >= 0 && mapX < size && mapY >= 0 && mapY < size) {
            handleMapTap(mapX, mapY, e.clientX, e.clientY);
          }
        }
      }
    }

    map.delete(e.pointerId);

    if (map.size === 1) {
      const remaining = Array.from(map.values())[0];
      if (remaining) {
        pointerStartRef.current = {
          id: remaining.id,
          x: remaining.x,
          y: remaining.y,
          time: Date.now()
        };
        startCamRef.current = { ...cameraRef.current };
      }
      isDraggingRef.current = true;
      lastPinchDistRef.current = null;
      lastPinchMidRef.current = null;
    } else if (map.size === 0) {
      pointerStartRef.current = null;
      isDraggingRef.current = false;
      isMultiTouchActiveRef.current = false;
      totalDragDistRef.current = 0;
      lastPinchDistRef.current = null;
      lastPinchMidRef.current = null;
    }
  };

  const handlePointerLeave = (e: React.PointerEvent<HTMLDivElement>) => {
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
    const map = pointersMapRef.current;
    map.delete(e.pointerId);
    if (map.size === 0) {
      pointerStartRef.current = null;
      isDraggingRef.current = false;
      isMultiTouchActiveRef.current = false;
      totalDragDistRef.current = 0;
      lastPinchDistRef.current = null;
      lastPinchMidRef.current = null;
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.target !== canvasRef.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.08 : 0.92;
    zoomAroundPoint(screenX, screenY, cameraRef.current.zoom * factor);
  };

  return {
    clampZoom,
    clampCamera,
    zoomAroundPoint,
    focusOnCoordinates,
    focusOnPlayerKingdom,
    focusOnNation,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerLeave,
    handleWheel,
  };
}
