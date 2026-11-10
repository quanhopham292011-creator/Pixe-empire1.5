import { useState, useRef, useCallback } from 'react';
import { MapDimension, WeatherType } from '../types';
import { soundManager } from '../utils/audio';
import { formatGameTime } from '../utils/constants';

export interface UseSeasonEventsParams {
  gameDataRef: React.MutableRefObject<any>;
  cameraRef: React.MutableRefObject<{ x: number; y: number; zoom: number }>;
  mapSize: MapDimension;
  initWeatherParticlesRef: React.MutableRefObject<((size: MapDimension, weather: WeatherType) => void) | null>;
  nextLightningTimeRef: React.MutableRefObject<number>;
}

export function useSeasonEvents({
  gameDataRef,
  cameraRef,
  mapSize,
  initWeatherParticlesRef,
  nextLightningTimeRef,
}: UseSeasonEventsParams) {
  const [weather, setWeatherState] = useState<WeatherType>('CLOUDY');
  const weatherRef = useRef<WeatherType>('CLOUDY');
  const [weatherEnabled, setWeatherEnabled] = useState<boolean>(true);
  const weatherEnabledRef = useRef<boolean>(true);

  const setWeather = useCallback((newWeather: WeatherType | ((prev: WeatherType) => WeatherType)) => {
    setWeatherState(prev => {
      const next = typeof newWeather === 'function' ? newWeather(prev) : newWeather;
      weatherRef.current = next;
      return next;
    });
  }, []);

  const cycleWeather = useCallback(() => {
    setWeatherState(prev => {
      const next: WeatherType = prev === 'CLEAR' ? 'CLOUDY' : prev === 'CLOUDY' ? 'RAIN' : 'CLEAR';
      weatherRef.current = next;
      if (initWeatherParticlesRef.current) {
        initWeatherParticlesRef.current(mapSize, next);
      }
      if (next === 'RAIN') {
        nextLightningTimeRef.current = performance.now() + 1500 + Math.random() * 2000;
      }
      soundManager.playClick();
      return next;
    });
  }, [mapSize, initWeatherParticlesRef, nextLightningTimeRef]);

  const toggleWeather = useCallback(() => {
    setWeatherEnabled(prev => {
      const next = !prev;
      weatherEnabledRef.current = next;
      soundManager.playClick();
      return next;
    });
  }, []);

  const updateSeasonEventsAndWeather = useCallback(() => {
    const data = gameDataRef.current;
    if (!data) return;

    // Kích hoạt Sự Kiện Ngẫu Nhiên & Thảm Họa Thiên Nhiên theo mùa mỗi 50 giây
    if (data.gameTimeSeconds > 0 && data.gameTimeSeconds % 50 === 0 && !data.activeSeasonEvent) {
      const eventTypes: Array<{ type: 'BLIZZARD' | 'PLAGUE' | 'GOLDEN_HARVEST' | 'DROUGHT'; name: string; duration: number; desc: string }> = [
        { type: 'BLIZZARD', name: '❄️ Bão Tuyết Càn Quét', duration: 20, desc: 'Bão tuyết cực đoan! Toàn bộ quân đội và đợt hành quân bị đóng băng tạm thời.' },
        { type: 'PLAGUE', name: '🦠 Đại Dịch Bùng Phát', duration: 15, desc: 'Dịch bệnh lan rộng! Lực lượng quân sự toàn cầu suy giảm 15% tạm thời.' },
        { type: 'GOLDEN_HARVEST', name: '🌾 Mùa Màng Bội Thu', duration: 25, desc: 'Thời tiết ôn hòa! Sản lượng thu nhập vàng toàn cầu được nhân đôi (+100%).' },
        { type: 'DROUGHT', name: '☀️ Hạn Hán Khắc Nghiệt', duration: 20, desc: 'Hạn hán kéo dài! Sản lượng thu nhập vàng suy giảm 50%.' },
      ];
      const chosen = eventTypes[Math.floor(Math.random() * eventTypes.length)];
      data.activeSeasonEvent = {
        type: chosen.type,
        name: chosen.name,
        remainingTime: chosen.duration,
        duration: chosen.duration,
        desc: chosen.desc,
      };

      if (chosen.type === 'PLAGUE') {
        data.nations.forEach((n: any) => {
          if (!n.isEliminated) {
            n.troops = Math.max(5, Math.floor(n.troops * 0.85));
          }
        });
      }

      soundManager.playThunder();
      data.events.unshift({
        id: Math.random().toString(),
        title: chosen.name,
        description: chosen.desc,
        type: chosen.type === 'GOLDEN_HARVEST' ? 'HARVEST' : chosen.type === 'DROUGHT' ? 'CROP_FAILURE' : 'PLAGUE',
        targetNationId: 0,
        timestamp: formatGameTime(data.gameTimeSeconds),
      });

      data.particles.push({
        x: (cameraRef.current.x * -1) / cameraRef.current.zoom + 120,
        y: (cameraRef.current.y * -1) / cameraRef.current.zoom + 120,
        color: chosen.type === 'GOLDEN_HARVEST' ? '#10b981' : chosen.type === 'BLIZZARD' ? '#38bdf8' : '#ef4444',
        size: 0, life: 50, maxLife: 50, vx: 0, vy: -0.7,
        type: 'FLOAT_TEXT',
        text: `⚠️ SỰ KIỆN: ${chosen.name}!`
      });
    }

    if (data.activeSeasonEvent) {
      data.activeSeasonEvent.remainingTime -= 1;
      if (data.activeSeasonEvent.remainingTime <= 0) {
        data.activeSeasonEvent = null;
      }
    }

    // Chu kỳ chuyển dịch thời tiết tự nhiên mỗi 80s (Nắng nhẹ -> Mây trôi -> Mưa lất phất)
    if (weatherEnabledRef.current && data.gameTimeSeconds > 0 && data.gameTimeSeconds % 80 === 0) {
      setWeatherState(prev => {
        const next: WeatherType = prev === 'CLEAR' ? 'CLOUDY' : prev === 'CLOUDY' ? 'RAIN' : 'CLEAR';
        weatherRef.current = next;
        if (initWeatherParticlesRef.current) {
          initWeatherParticlesRef.current(mapSize, next);
        }
        if (next === 'RAIN') {
          nextLightningTimeRef.current = performance.now() + 2000 + Math.random() * 3000;
        }
        return next;
      });
    }
  }, [gameDataRef, cameraRef, mapSize, initWeatherParticlesRef, nextLightningTimeRef]);

  return {
    weather,
    setWeather,
    weatherRef,
    weatherEnabled,
    setWeatherEnabled,
    weatherEnabledRef,
    cycleWeather,
    toggleWeather,
    updateSeasonEventsAndWeather,
  };
}
