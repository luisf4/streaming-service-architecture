"use client";

import Hls, { type ErrorData, type Level } from "hls.js";
import { useEffect, useRef, useState } from "react";
import styles from "./VideoPlayer.module.css";

export interface VideoPlayerProps {
  manifestUrl: string;
}

export function VideoPlayer({ manifestUrl }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [levels, setLevels] = useState<Level[]>([]);
  const [currentLevel, setCurrentLevel] = useState(-1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setError(null);

    if (Hls.isSupported()) {
      const hls = new Hls();
      hlsRef.current = hls;
      hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        setLevels(data.levels);
      });
      hls.on(Hls.Events.ERROR, (_event, data: ErrorData) => {
        if (data.fatal) {
          setError(`Playback error: ${data.details}`);
        }
      });
      hls.loadSource(manifestUrl);
      hls.attachMedia(video);
      return () => {
        hls.destroy();
        hlsRef.current = null;
      };
    }

    // Safari/iOS play HLS natively without hls.js.
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = manifestUrl;
    }
    return undefined;
  }, [manifestUrl]);

  function selectLevel(levelIndex: number): void {
    setCurrentLevel(levelIndex);
    if (hlsRef.current) {
      hlsRef.current.currentLevel = levelIndex;
    }
  }

  return (
    <div>
      <div className={styles.frame}>
        <video ref={videoRef} controls data-testid="video-player" className={styles.video} />
        {levels.length > 0 && (
          <div className={styles.controls}>
            <label className={styles.qualityLabel}>
              Quality
              <select
                aria-label="Quality"
                className={styles.qualitySelect}
                value={currentLevel}
                onChange={(event) => selectLevel(Number(event.target.value))}
              >
                <option value={-1}>Auto</option>
                {levels.map((level, index) => (
                  <option key={index} value={index}>
                    {level.height}p
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
      </div>
      {error && (
        <p role="alert" className={styles.alert}>
          {error}
        </p>
      )}
    </div>
  );
}
