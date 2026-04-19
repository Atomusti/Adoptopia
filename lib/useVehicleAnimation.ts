import { useState, useEffect, useRef } from 'react';
import { Position } from './gameData';

export function useVehicleAnimation(path: Position[], onComplete: () => void) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const onCompleteRef = useRef(onComplete);

  // Keep a fresh reference to preventing stale closures inside an active interval
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    // If the path is trivially small, instantly complete
    if (!path || path.length <= 1) {
      onCompleteRef.current?.();
      return;
    }

    const timer = setInterval(() => {
      setCurrentIndex((prev) => {
        const next = prev + 1;
        if (next >= path.length - 1) {
          clearInterval(timer); // stop looping when destination is reached
          setTimeout(() => onCompleteRef.current?.(), 50); // Fire completion right after render bounds
          return path.length - 1;
        }
        return next;
      });
    }, 400); // Specified vehicle step timeframe

    return () => clearInterval(timer);
  }, [path]);

  const safeIndex = Math.min(currentIndex, path.length - 1);
  const currentPosition = path[safeIndex] || { x: 0, y: 0 };
  const isMoving = currentIndex < path.length - 1;
  const progress = path.length > 1 ? (currentIndex / (path.length - 1)) * 100 : 100;

  return { currentPosition, isMoving, progress };
}
