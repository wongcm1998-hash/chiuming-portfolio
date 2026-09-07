'use client';

import { useEffect, useRef } from 'react';

const SEEK_INTERVAL_MS = 1000 / 25;
const INITIAL_FRAME_TIME = 0.02;
const SEEK_EPSILON = 1 / 120;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function isUsableDuration(duration: number) {
  return Number.isFinite(duration) && duration > 0;
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';

  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes}:${remainder.toString().padStart(2, '0')}`;
}

export function ScrubVideoHero() {
  const heroRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLProgressElement>(null);
  const percentageRef = useRef<HTMLOutputElement>(null);
  const timeRef = useRef<HTMLOutputElement>(null);

  useEffect(() => {
    const hero = heroRef.current;
    const video = videoRef.current;
    const progress = progressRef.current;
    const percentage = percentageRef.current;
    const time = timeRef.current;

    if (!hero || !video || !progress || !percentage || !time) return;

    let animationFrameId: number | null = null;
    let activePointerId: number | null = null;
    let duration: number | null = null;
    let targetTime: number | null = null;
    let lastSeekAt = -Infinity;
    let intersectsViewport = false;
    let metadataLoaded = false;
    let observer: IntersectionObserver | null = null;

    const isViewportActive = () =>
      intersectsViewport && document.visibilityState === 'visible';

    const cancelAnimationLoop = () => {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
    };

    const releasePointer = () => {
      if (
        activePointerId !== null &&
        hero.hasPointerCapture(activePointerId)
      ) {
        hero.releasePointerCapture(activePointerId);
      }
      activePointerId = null;
      hero.dataset.scrubbing = 'false';
    };

    const stopInteraction = (discardTarget = true) => {
      releasePointer();
      if (discardTarget) targetTime = null;
      cancelAnimationLoop();
      video.pause();
    };

    const tick = (timestamp: number) => {
      animationFrameId = null;

      if (!isViewportActive() || targetTime === null || duration === null) {
        return;
      }

      const safeTarget = clamp(targetTime, 0, duration);
      const farFromTarget =
        Math.abs(video.currentTime - safeTarget) > SEEK_EPSILON;
      const seekIntervalElapsed = timestamp - lastSeekAt >= SEEK_INTERVAL_MS;

      if (farFromTarget && !video.seeking && seekIntervalElapsed) {
        video.currentTime = safeTarget;
        lastSeekAt = timestamp;
      }

      const stillNeedsWork =
        video.seeking ||
        Math.abs(video.currentTime - safeTarget) > SEEK_EPSILON ||
        timestamp - lastSeekAt < SEEK_INTERVAL_MS;

      if (stillNeedsWork) {
        animationFrameId = requestAnimationFrame(tick);
      } else {
        targetTime = null;
      }
    };

    const scheduleAnimationLoop = () => {
      if (animationFrameId === null && isViewportActive()) {
        animationFrameId = requestAnimationFrame(tick);
      }
    };

    const updateFromClientX = (clientX: number) => {
      if (!isViewportActive() || duration === null) return;

      const rect = hero.getBoundingClientRect();
      if (!Number.isFinite(rect.width) || rect.width <= 0) return;

      const nextProgress = clamp(
        (clientX - rect.left) / rect.width,
        0,
        1,
      );

      targetTime = nextProgress * duration;
      hero.style.setProperty('--scrub-progress', String(nextProgress));
      progress.value = Math.round(nextProgress * 100);
      percentage.value = `${Math.round(nextProgress * 100)}%`;
      time.value = `${formatTime(targetTime)} / ${formatTime(duration)}`;
      scheduleAnimationLoop();
    };

    const readDurationAfterMetadata = () => {
      metadataLoaded = true;
      video.pause();

      if (!isUsableDuration(video.duration)) {
        duration = null;
        hero.dataset.ready = 'false';
        percentage.value = '—';
        time.value = '等待视频信息';
        return;
      }

      duration = video.duration;
      const initialTime = Math.min(
        INITIAL_FRAME_TIME,
        Math.max(0, duration - 0.001),
      );
      video.currentTime = initialTime;
      hero.dataset.ready = 'true';
      percentage.value = '0%';
      time.value = `0:00 / ${formatTime(duration)}`;
    };

    const handleDurationChange = () => {
      if (metadataLoaded) readDurationAfterMetadata();
    };

    const handleVideoError = () => {
      duration = null;
      targetTime = null;
      cancelAnimationLoop();
      hero.dataset.ready = 'false';
      percentage.value = '—';
      time.value = '视频载入失败';
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (!isViewportActive() || duration === null) return;

      activePointerId = event.pointerId;
      hero.dataset.scrubbing = 'true';
      hero.setPointerCapture(event.pointerId);
      event.preventDefault();
      updateFromClientX(event.clientX);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!isViewportActive() || duration === null) return;

      const isActiveDrag = activePointerId === event.pointerId;
      const isMouseHover = event.pointerType === 'mouse' && activePointerId === null;

      if (!isActiveDrag && !isMouseHover) return;
      if (isActiveDrag) event.preventDefault();
      updateFromClientX(event.clientX);
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (activePointerId !== event.pointerId) return;
      updateFromClientX(event.clientX);
      releasePointer();
    };

    const handlePointerCancel = (event: PointerEvent) => {
      if (activePointerId !== event.pointerId) return;
      targetTime = null;
      stopInteraction();
    };

    const handlePointerLeave = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' && activePointerId === null) {
        targetTime = null;
        cancelAnimationLoop();
      }
    };

    const handleLostPointerCapture = (event: PointerEvent) => {
      if (activePointerId === event.pointerId) releasePointer();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') stopInteraction();
    };

    const updateFallbackVisibility = () => {
      const rect = hero.getBoundingClientRect();
      const wasActive = intersectsViewport;
      intersectsViewport = rect.bottom > 0 && rect.top < window.innerHeight;
      if (wasActive && !intersectsViewport) stopInteraction();
    };

    video.addEventListener('loadedmetadata', readDurationAfterMetadata);
    video.addEventListener('durationchange', handleDurationChange);
    video.addEventListener('error', handleVideoError);
    hero.addEventListener('pointerdown', handlePointerDown);
    hero.addEventListener('pointermove', handlePointerMove, { passive: false });
    hero.addEventListener('pointerup', handlePointerUp);
    hero.addEventListener('pointercancel', handlePointerCancel);
    hero.addEventListener('pointerleave', handlePointerLeave);
    hero.addEventListener('lostpointercapture', handleLostPointerCapture);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const IntersectionObserverConstructor:
      | typeof IntersectionObserver
      | undefined = window.IntersectionObserver;

    if (IntersectionObserverConstructor) {
      observer = new IntersectionObserverConstructor(
        ([entry]) => {
          const wasActive = intersectsViewport;
          intersectsViewport = entry.isIntersecting && entry.intersectionRatio > 0;
          if (wasActive && !intersectsViewport) stopInteraction();
        },
        { threshold: [0, 0.01] },
      );
      observer.observe(hero);
    } else {
      updateFallbackVisibility();
      window.addEventListener('scroll', updateFallbackVisibility, { passive: true });
      window.addEventListener('resize', updateFallbackVisibility);
    }

    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
      readDurationAfterMetadata();
    }

    return () => {
      stopInteraction();
      observer?.disconnect();
      video.removeEventListener('loadedmetadata', readDurationAfterMetadata);
      video.removeEventListener('durationchange', handleDurationChange);
      video.removeEventListener('error', handleVideoError);
      hero.removeEventListener('pointerdown', handlePointerDown);
      hero.removeEventListener('pointermove', handlePointerMove);
      hero.removeEventListener('pointerup', handlePointerUp);
      hero.removeEventListener('pointercancel', handlePointerCancel);
      hero.removeEventListener('pointerleave', handlePointerLeave);
      hero.removeEventListener('lostpointercapture', handleLostPointerCapture);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('scroll', updateFallbackVisibility);
      window.removeEventListener('resize', updateFallbackVisibility);
    };
  }, []);

  return (
    <main>
      <section
        ref={heroRef}
        className="scrub-hero"
        data-ready="false"
        data-scrubbing="false"
        aria-labelledby="hero-title"
      >
        <video
          ref={videoRef}
          className="hero-video"
          src="/head-turn.mp4"
          poster="/head-turn-poster.jpg"
          muted
          playsInline
          preload="auto"
          controls={false}
          draggable={false}
          aria-label="人物转头动画，可通过横向移动指针控制画面"
        />

        <div className="hero-shade" aria-hidden="true" />

        <header className="hero-header">
          <a className="wordmark" href="#top" aria-label="FRAME 首页">
            FRAME <span>01</span>
          </a>
          <p>POINTER / TOUCH</p>
        </header>

        <div className="hero-copy" id="top">
          <p className="eyebrow">Interactive portrait</p>
          <h1 id="hero-title">
            MOVE TO
            <br />
            TURN TIME.
          </h1>
          <p className="hero-description">
            左右移动鼠标，或用手指横向拖动。
            <br />
            你的所在位置，就是这一刻的时间。
          </p>
        </div>

        <div className="scrub-console" aria-label="视频进度">
          <div className="scrub-meta">
            <span>DRAG / MOVE</span>
            <output ref={timeRef}>等待视频信息</output>
          </div>
          <progress
            ref={progressRef}
            className="sr-only"
            aria-label="视频进度"
            max={100}
            value={0}
          >
            0%
          </progress>
          <div
            className="scrub-track"
            aria-hidden="true"
          >
            <span className="scrub-fill" />
            <span className="scrub-knob" />
          </div>
          <div className="scrub-scale" aria-hidden="true">
            <span>00</span>
            <span>25</span>
            <span>50</span>
            <span>75</span>
            <span>100</span>
          </div>
          <output ref={percentageRef} className="scrub-percentage">
            —
          </output>
        </div>

        <div className="loading-note" aria-live="polite">
          正在准备画面…
        </div>
      </section>

      <section className="afterword" aria-labelledby="afterword-title">
        <p>FRAME 01 / END</p>
        <h2 id="afterword-title">时间不必只向前走。</h2>
        <div>
          <span>横向位置</span>
          <span>决定画面</span>
        </div>
      </section>
    </main>
  );
}
