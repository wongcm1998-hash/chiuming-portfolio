'use client';

import { useEffect, useRef, useState } from 'react';

const SEEK_INTERVAL_MS = 1000 / 25;
const SEEK_EPSILON = 1 / 120;
const INITIAL_FRAME_TIME = 0.02;
const SCROLL_VIEWPORTS = 8;

const TIMELINE = {
  firstCopyRightExit: [0.04, 0.105],
  firstCopyLeftExit: [0.055, 0.13],
  firstToSecond: [0.08, 0.15],
  secondPlayback: [0.12, 0.53],
  workExperienceReveal: [
    [0.13, 0.21],
    [0.23, 0.31],
    [0.33, 0.41],
  ],
  workExperienceExit: [0.47, 0.54],
  secondToThird: [0.5, 0.57],
  thirdPlayback: [0.54, 0.84],
  worksTransition: [1 - 1 / (SCROLL_VIEWPORTS - 1), 1],
  thirdCopyReveal: [
    [0.57, 0.64],
    [0.61, 0.69],
    [0.67, 0.76],
    [0.72, 0.81],
  ],
} as const;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function isUsableDuration(duration: number) {
  return Number.isFinite(duration) && duration > 0;
}

function smoothstep(progress: number) {
  return progress * progress * (3 - 2 * progress);
}

function rangeProgress(
  progress: number,
  range: readonly [number, number],
) {
  const [start, end] = range;
  if (end <= start) return progress >= end ? 1 : 0;
  return clamp((progress - start) / (end - start), 0, 1);
}

type LiquidDistortionController = {
  dispose: () => void;
  requestFrame: () => void;
  resize: () => void;
  setActive: (active: boolean) => void;
  setPointer: (clientX: number, clientY: number) => void;
};

const LIQUID_VERTEX_SHADER = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  varying vec2 v_texCoord;

  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = a_texCoord;
  }
`;

const LIQUID_FRAGMENT_SHADER = `
  precision mediump float;

  uniform sampler2D u_texture;
  uniform vec2 u_pointer;
  uniform float u_time;
  uniform float u_strength;
  uniform float u_aspect;
  varying vec2 v_texCoord;

  void main() {
    vec2 delta = v_texCoord - u_pointer;
    vec2 metricDelta = vec2(delta.x * u_aspect, delta.y);
    float distanceToPointer = length(metricDelta);
    float envelope = exp(-distanceToPointer * 5.5);
    float wave = sin(distanceToPointer * 46.0 - u_time * 12.0);
    vec2 direction = normalize(delta + vec2(0.00001));
    vec2 ripple = direction * wave * envelope * u_strength * 1.6;
    vec2 lens = delta * envelope * u_strength * 1.2;
    vec2 refractedUv = clamp(v_texCoord + ripple - lens, 0.0, 1.0);

    gl_FragColor = texture2D(u_texture, refractedUv);
  }
`;

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
) {
  const shader = gl.createShader(type);
  if (!shader) return null;

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

function createLiquidDistortion(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  surface: HTMLElement,
  readyDatasetKey:
    | 'liquidOneReady'
    | 'liquidTwoReady'
    | 'liquidThreeReady',
): LiquidDistortionController | null {
  surface.dataset[readyDatasetKey] = 'false';
  const gl = canvas.getContext('webgl', {
    alpha: false,
    antialias: false,
    powerPreference: 'high-performance',
  });

  if (!gl) return null;

  const vertexShader = compileShader(
    gl,
    gl.VERTEX_SHADER,
    LIQUID_VERTEX_SHADER,
  );
  const fragmentShader = compileShader(
    gl,
    gl.FRAGMENT_SHADER,
    LIQUID_FRAGMENT_SHADER,
  );

  if (!vertexShader || !fragmentShader) {
    if (vertexShader) gl.deleteShader(vertexShader);
    if (fragmentShader) gl.deleteShader(fragmentShader);
    return null;
  }

  const program = gl.createProgram();
  if (!program) {
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    return null;
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    return null;
  }

  const buffer = gl.createBuffer();
  const texture = gl.createTexture();

  if (!buffer || !texture) {
    if (buffer) gl.deleteBuffer(buffer);
    if (texture) gl.deleteTexture(texture);
    gl.deleteProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    return null;
  }

  const vertices = new Float32Array([
    -1, -1, 0, 0,
    1, -1, 1, 0,
    -1, 1, 0, 1,
    -1, 1, 0, 1,
    1, -1, 1, 0,
    1, 1, 1, 1,
  ]);

  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

  const positionLocation = gl.getAttribLocation(program, 'a_position');
  const texCoordLocation = gl.getAttribLocation(program, 'a_texCoord');
  const stride = 4 * Float32Array.BYTES_PER_ELEMENT;

  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, stride, 0);
  gl.enableVertexAttribArray(texCoordLocation);
  gl.vertexAttribPointer(
    texCoordLocation,
    2,
    gl.FLOAT,
    false,
    stride,
    2 * Float32Array.BYTES_PER_ELEMENT,
  );

  const textureLocation = gl.getUniformLocation(program, 'u_texture');
  const pointerLocation = gl.getUniformLocation(program, 'u_pointer');
  const timeLocation = gl.getUniformLocation(program, 'u_time');
  const strengthLocation = gl.getUniformLocation(program, 'u_strength');
  const aspectLocation = gl.getUniformLocation(program, 'u_aspect');

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.uniform1i(textureLocation, 0);

  let active = true;
  let frameId: number | null = null;
  let pointerX = 0.5;
  let pointerY = 0.5;
  let targetPointerX = 0.5;
  let targetPointerY = 0.5;
  let strength = 0;
  let targetStrength = 0;
  let renderedOnce = false;
  let textureInitialized = false;

  const resize = () => {
    const surfaceWidth = surface.clientWidth;
    const surfaceHeight = surface.clientHeight;
    const videoWidth = video.videoWidth || 16;
    const videoHeight = video.videoHeight || 9;

    if (surfaceWidth <= 0 || surfaceHeight <= 0) return;

    const coverScale = Math.max(
      surfaceWidth / videoWidth,
      surfaceHeight / videoHeight,
    );
    const displayWidth = Math.ceil(videoWidth * coverScale);
    const displayHeight = Math.ceil(videoHeight * coverScale);
    const nativeScale = Math.min(
      1,
      videoWidth / displayWidth,
      videoHeight / displayHeight,
    );
    const renderWidth = Math.max(1, Math.round(displayWidth * nativeScale));
    const renderHeight = Math.max(1, Math.round(displayHeight * nativeScale));

    canvas.style.left = `${(surfaceWidth - displayWidth) / 2}px`;
    canvas.style.top = '0px';
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;

    if (canvas.width !== renderWidth || canvas.height !== renderHeight) {
      canvas.width = renderWidth;
      canvas.height = renderHeight;
      gl.viewport(0, 0, renderWidth, renderHeight);
    }
  };

  const draw = (timestamp: number) => {
    frameId = null;

    if (!active || document.visibilityState !== 'visible') return;
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;

    pointerX += (targetPointerX - pointerX) * 0.2;
    pointerY += (targetPointerY - pointerY) * 0.2;
    strength += (targetStrength - strength) * 0.16;
    targetStrength *= 0.95;

    gl.useProgram(program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);

    try {
      if (textureInitialized) {
        gl.texSubImage2D(
          gl.TEXTURE_2D,
          0,
          0,
          0,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          video,
        );
      } else {
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          video,
        );
        textureInitialized = true;
      }
    } catch {
      return;
    }

    gl.uniform2f(pointerLocation, pointerX, pointerY);
    gl.uniform1f(timeLocation, timestamp / 1000);
    gl.uniform1f(strengthLocation, strength);
    gl.uniform1f(aspectLocation, canvas.width / canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    if (!renderedOnce) {
      renderedOnce = true;
      surface.dataset[readyDatasetKey] = 'true';
    }

    const pointerIsMoving =
      Math.abs(targetPointerX - pointerX) > 0.0005 ||
      Math.abs(targetPointerY - pointerY) > 0.0005;

    if (
      pointerIsMoving ||
      strength > 0.00035 ||
      targetStrength > 0.00035 ||
      video.seeking
    ) {
      frameId = requestAnimationFrame(draw);
    }
  };

  const requestFrame = () => {
    if (active && frameId === null) {
      frameId = requestAnimationFrame(draw);
    }
  };

  const setPointer = (clientX: number, clientY: number) => {
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const nextX = clamp((clientX - rect.left) / rect.width, 0, 1);
    const nextY = clamp(1 - (clientY - rect.top) / rect.height, 0, 1);
    const velocity = Math.hypot(
      (nextX - targetPointerX) * (canvas.width / canvas.height),
      nextY - targetPointerY,
    );

    targetPointerX = nextX;
    targetPointerY = nextY;
    targetStrength = clamp(0.018 + velocity * 0.32, 0.018, 0.06);
    requestFrame();
  };

  const setActive = (nextActive: boolean) => {
    active = nextActive;

    if (!active && frameId !== null) {
      cancelAnimationFrame(frameId);
      frameId = null;
      return;
    }

    if (active) requestFrame();
  };

  const handleVideoFrame = () => {
    resize();
    requestFrame();
  };
  const handleContextLost = () => {
    surface.dataset[readyDatasetKey] = 'false';
    if (frameId !== null) cancelAnimationFrame(frameId);
    frameId = null;
  };

  video.addEventListener('loadeddata', handleVideoFrame);
  video.addEventListener('seeked', handleVideoFrame);
  canvas.addEventListener('webglcontextlost', handleContextLost);
  resize();
  requestFrame();

  return {
    dispose: () => {
      if (frameId !== null) cancelAnimationFrame(frameId);
      video.removeEventListener('loadeddata', handleVideoFrame);
      video.removeEventListener('seeked', handleVideoFrame);
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      surface.dataset[readyDatasetKey] = 'false';
      gl.deleteTexture(texture);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
    },
    requestFrame,
    resize: () => {
      resize();
      requestFrame();
    },
    setActive,
    setPointer,
  };
}

export function ScrubVideoHero() {
  const sectionRef = useRef<HTMLElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const bgmRef = useRef<HTMLAudioElement>(null);
  const bgmEnabledRef = useRef(false);
  const bgmInSequenceRef = useRef(true);
  const bgmPreferenceSetRef = useRef(false);
  const firstVideoRef = useRef<HTMLVideoElement>(null);
  const secondVideoRef = useRef<HTMLVideoElement>(null);
  const thirdVideoRef = useRef<HTMLVideoElement>(null);
  const firstLiquidCanvasRef = useRef<HTMLCanvasElement>(null);
  const secondLiquidCanvasRef = useRef<HTMLCanvasElement>(null);
  const thirdLiquidCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isBgmEnabled, setIsBgmEnabled] = useState(false);

  const handleBgmToggle = () => {
    const audio = bgmRef.current;
    if (!audio) return;

    const nextEnabled = !bgmEnabledRef.current;
    bgmPreferenceSetRef.current = true;
    bgmEnabledRef.current = nextEnabled;
    setIsBgmEnabled(nextEnabled);

    if (
      nextEnabled &&
      bgmInSequenceRef.current &&
      document.visibilityState === 'visible'
    ) {
      void audio.play().catch(() => undefined);
    } else {
      audio.pause();
    }
  };

  useEffect(() => {
    const section = sectionRef.current;
    const surface = surfaceRef.current;
    const audio = bgmRef.current;

    if (!section || !surface || !audio) return;

    audio.volume = 0.42;

    const syncBgmPlayback = () => {
      const shouldPlay =
        bgmEnabledRef.current &&
        bgmInSequenceRef.current &&
        document.visibilityState === 'visible';

      if (shouldPlay) {
        void audio.play().catch(() => undefined);
      } else {
        audio.pause();
      }
    };

    const enableFromFirstInteraction = (event: PointerEvent) => {
      if (
        bgmPreferenceSetRef.current ||
        !bgmInSequenceRef.current ||
        (event.target instanceof Element &&
          event.target.closest('.sequence-sound-toggle'))
      ) {
        return;
      }

      bgmPreferenceSetRef.current = true;
      bgmEnabledRef.current = true;
      setIsBgmEnabled(true);
      void audio.play().catch(() => undefined);
    };

    const enableFromKeyboard = () => {
      if (bgmPreferenceSetRef.current || !bgmInSequenceRef.current) return;

      bgmPreferenceSetRef.current = true;
      bgmEnabledRef.current = true;
      setIsBgmEnabled(true);
      void audio.play().catch(() => undefined);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        bgmInSequenceRef.current = entry.isIntersecting;
        syncBgmPlayback();
      },
      { threshold: 0.001 },
    );

    observer.observe(section);
    surface.addEventListener('pointerdown', enableFromFirstInteraction);
    window.addEventListener('keydown', enableFromKeyboard, { once: true });
    document.addEventListener('visibilitychange', syncBgmPlayback);
    audio.addEventListener('canplay', syncBgmPlayback);

    return () => {
      observer.disconnect();
      surface.removeEventListener('pointerdown', enableFromFirstInteraction);
      window.removeEventListener('keydown', enableFromKeyboard);
      document.removeEventListener('visibilitychange', syncBgmPlayback);
      audio.removeEventListener('canplay', syncBgmPlayback);
      audio.pause();
    };
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    const surface = surfaceRef.current;
    const videos = [
      firstVideoRef.current,
      secondVideoRef.current,
      thirdVideoRef.current,
    ];
    const liquidCanvases = [
      firstLiquidCanvasRef.current,
      secondLiquidCanvasRef.current,
      thirdLiquidCanvasRef.current,
    ];

    if (
      !section ||
      !surface ||
      videos.some((video) => !video) ||
      liquidCanvases.some((canvas) => !canvas)
    ) {
      return;
    }

    const media = videos as HTMLVideoElement[];
    const canvases = liquidCanvases as HTMLCanvasElement[];
    const readyDatasetKeys = [
      'liquidOneReady',
      'liquidTwoReady',
      'liquidThreeReady',
    ] as const;
    const liquidEffects: Array<LiquidDistortionController | null> = [
      null,
      null,
      null,
    ];
    const ensureLiquidEffect = (index: number) => {
      if (!liquidEffects[index]) {
        liquidEffects[index] = createLiquidDistortion(
          media[index],
          canvases[index],
          surface,
          readyDatasetKeys[index],
        );
      }

      return liquidEffects[index];
    };

    ensureLiquidEffect(0);
    const durations: Array<number | null> = [null, null, null];
    const targetTimes: Array<number | null> = [null, null, null];
    const metadataLoaded = [false, false, false];
    const fullPreloadRequested = [true, false, false];

    let scrollProgress = 0;
    let stageVisibilities = [1, 0, 0];
    let pointerProgress = 0;
    let hasPointerInput = false;
    let activePointerId: number | null = null;
    let seekFrameId: number | null = null;
    let scrollFrameId: number | null = null;
    let resizeFrameId: number | null = null;
    let lastSeekAt = -Infinity;
    let resizeObserver: ResizeObserver | null = null;
    let sectionObserver: IntersectionObserver | null = null;
    let isSectionVisible = true;

    const cancelSeekFrame = () => {
      if (seekFrameId !== null) {
        cancelAnimationFrame(seekFrameId);
        seekFrameId = null;
      }
    };

    const cancelScrollFrame = () => {
      if (scrollFrameId !== null) {
        cancelAnimationFrame(scrollFrameId);
        scrollFrameId = null;
      }
    };

    const cancelResizeFrame = () => {
      if (resizeFrameId !== null) {
        cancelAnimationFrame(resizeFrameId);
        resizeFrameId = null;
      }
    };

    const releasePointer = () => {
      const pointerId = activePointerId;
      activePointerId = null;

      if (pointerId !== null && surface.hasPointerCapture(pointerId)) {
        surface.releasePointerCapture(pointerId);
      }
    };

    const seekTick = (timestamp: number) => {
      seekFrameId = null;

      if (document.visibilityState !== 'visible') return;

      const intervalElapsed = timestamp - lastSeekAt >= SEEK_INTERVAL_MS;
      let attemptedSeek = false;

      if (intervalElapsed) {
        media.forEach((video, index) => {
          const duration = durations[index];
          const targetTime = targetTimes[index];

          if (duration === null || targetTime === null || video.seeking) return;

          const safeTarget = clamp(targetTime, 0, duration);
          if (Math.abs(video.currentTime - safeTarget) <= SEEK_EPSILON) return;

          try {
            video.currentTime = safeTarget;
            attemptedSeek = true;
          } catch {
            targetTimes[index] = null;
          }
        });

        if (attemptedSeek) lastSeekAt = timestamp;
      }

      let stillNeedsWork = false;

      media.forEach((video, index) => {
        const duration = durations[index];
        const targetTime = targetTimes[index];

        if (duration === null || targetTime === null) return;

        const safeTarget = clamp(targetTime, 0, duration);
        const isPending =
          video.seeking ||
          Math.abs(video.currentTime - safeTarget) > SEEK_EPSILON ||
          (attemptedSeek && timestamp - lastSeekAt < SEEK_INTERVAL_MS);

        if (isPending) {
          stillNeedsWork = true;
        } else {
          targetTimes[index] = null;
        }
      });

      if (stillNeedsWork) {
        seekFrameId = requestAnimationFrame(seekTick);
      }
    };

    const scheduleSeek = () => {
      if (
        seekFrameId === null &&
        targetTimes.some((targetTime) => targetTime !== null) &&
        document.visibilityState === 'visible'
      ) {
        seekFrameId = requestAnimationFrame(seekTick);
      }
    };

    const updateTimeline = () => {
      const firstCopyRightExit = smoothstep(
        rangeProgress(scrollProgress, TIMELINE.firstCopyRightExit),
      );
      const firstCopyLeftExit = smoothstep(
        rangeProgress(scrollProgress, TIMELINE.firstCopyLeftExit),
      );
      const firstToSecond = rangeProgress(
        scrollProgress,
        TIMELINE.firstToSecond,
      );
      const secondToThird = rangeProgress(
        scrollProgress,
        TIMELINE.secondToThird,
      );
      const secondProgress = rangeProgress(
        scrollProgress,
        TIMELINE.secondPlayback,
      );
      const thirdProgress = rangeProgress(
        scrollProgress,
        TIMELINE.thirdPlayback,
      );
      const workExperienceExit = smoothstep(
        rangeProgress(scrollProgress, TIMELINE.workExperienceExit),
      );
      const worksTransition = smoothstep(
        rangeProgress(scrollProgress, TIMELINE.worksTransition),
      );

      const timelineAudio = bgmRef.current;
      const bgmShouldPlay = isSectionVisible && worksTransition < 0.999;
      bgmInSequenceRef.current = bgmShouldPlay;

      if (timelineAudio) {
        timelineAudio.volume = 0.42 * (1 - worksTransition);

        if (
          bgmShouldPlay &&
          bgmEnabledRef.current &&
          document.visibilityState === 'visible'
        ) {
          void timelineAudio.play().catch(() => undefined);
        } else {
          timelineAudio.pause();
        }
      }

      stageVisibilities = [
        1 - firstToSecond,
        firstToSecond * (1 - secondToThird),
        secondToThird,
      ];

      surface.style.setProperty(
        '--stage-one-opacity',
        String(stageVisibilities[0]),
      );
      surface.style.setProperty(
        '--stage-two-opacity',
        String(stageVisibilities[1]),
      );
      surface.style.setProperty(
        '--stage-three-opacity',
        String(stageVisibilities[2]),
      );
      surface.style.setProperty(
        '--first-copy-right-exit',
        String(firstCopyRightExit),
      );
      surface.style.setProperty(
        '--first-copy-left-exit',
        String(firstCopyLeftExit),
      );
      surface.style.setProperty(
        '--experience-stack-shift',
        `${(0.5 - secondProgress) * 2.25}rem`,
      );

      TIMELINE.workExperienceReveal.forEach((range, index) => {
        const reveal = smoothstep(rangeProgress(scrollProgress, range));
        const visibility = reveal * (1 - workExperienceExit);
        const cardNumber = index + 1;

        surface.style.setProperty(
          `--experience-${cardNumber}-opacity`,
          String(visibility),
        );
        surface.style.setProperty(
          `--experience-${cardNumber}-x`,
          `${(1 - reveal) * 4}rem`,
        );
        surface.style.setProperty(
          `--experience-${cardNumber}-y`,
          `${(1 - reveal) * 1.1 - workExperienceExit * (1.8 + index * 0.45)}rem`,
        );
        surface.style.setProperty(
          `--experience-${cardNumber}-scale`,
          String(0.94 + reveal * 0.06),
        );
        surface.style.setProperty(
          `--experience-${cardNumber}-blur`,
          `${(1 - reveal) * 0.55 + workExperienceExit * 0.45}rem`,
        );
      });

      TIMELINE.thirdCopyReveal.forEach((range, index) => {
        const reveal = smoothstep(rangeProgress(scrollProgress, range));
        const partNumber = index + 1;

        surface.style.setProperty(
          `--third-copy-${partNumber}-opacity`,
          String(reveal),
        );
        surface.style.setProperty(
          `--third-copy-${partNumber}-y`,
          `${(1 - reveal) * 2.25}rem`,
        );
        surface.style.setProperty(
          `--third-copy-${partNumber}-blur`,
          `${(1 - reveal) * 0.5}rem`,
        );
      });

      const firstStageActive = scrollProgress < TIMELINE.firstToSecond[0];
      surface.dataset.firstStageActive = String(firstStageActive);
      stageVisibilities.forEach((visibility, index) => {
        if (visibility > 0.001 && isSectionVisible) {
          ensureLiquidEffect(index)?.setActive(true);
        } else {
          liquidEffects[index]?.setActive(false);
        }
      });
      if (!firstStageActive) releasePointer();

      if (scrollProgress >= 0.035 && !fullPreloadRequested[1]) {
        fullPreloadRequested[1] = true;
        media[1].preload = 'auto';
        media[1].load();
      }

      if (scrollProgress >= 0.42 && !fullPreloadRequested[2]) {
        fullPreloadRequested[2] = true;
        media[2].preload = 'auto';
        media[2].load();
      }

      const firstDuration = durations[0];
      if (firstDuration !== null) {
        const initialProgress = Math.min(INITIAL_FRAME_TIME / firstDuration, 1);
        const baseProgress = hasPointerInput ? pointerProgress : initialProgress;
        const firstProgress =
          baseProgress + (1 - baseProgress) * firstToSecond;
        targetTimes[0] = firstProgress * firstDuration;
      }

      if (durations[1] !== null) {
        targetTimes[1] = secondProgress * durations[1];
      }

      if (durations[2] !== null) {
        targetTimes[2] = thirdProgress * durations[2];
      }

      scheduleSeek();
    };

    const syncProgressFromScroll = () => {
      scrollFrameId = null;

      if (!isSectionVisible) return;

      const rect = section.getBoundingClientRect();
      const scrollDistance = section.scrollHeight - window.innerHeight;

      scrollProgress =
        Number.isFinite(scrollDistance) && scrollDistance > 0
          ? clamp(-rect.top / scrollDistance, 0, 1)
          : rect.top <= 0
            ? 1
            : 0;

      updateTimeline();
    };

    const scheduleProgressSync = () => {
      if (isSectionVisible && scrollFrameId === null) {
        scrollFrameId = requestAnimationFrame(syncProgressFromScroll);
      }
    };

    const updateViewportMetrics = () => {
      const viewportHeight = window.innerHeight;
      if (!Number.isFinite(viewportHeight) || viewportHeight <= 0) return;

      section.style.setProperty(
        '--sequence-scroll-height',
        `${viewportHeight * SCROLL_VIEWPORTS}px`,
      );
      section.style.setProperty(
        '--sequence-viewport-height',
        `${viewportHeight}px`,
      );
      liquidEffects.forEach((effect) => effect?.resize());
      scheduleProgressSync();
    };

    const scheduleViewportUpdate = () => {
      if (resizeFrameId === null) {
        resizeFrameId = requestAnimationFrame(() => {
          resizeFrameId = null;
          updateViewportMetrics();
        });
      }
    };

    const syncDuration = (index: number) => {
      const video = media[index];
      video.pause();

      if (!isUsableDuration(video.duration)) {
        durations[index] = null;
        targetTimes[index] = null;
        return;
      }

      durations[index] = video.duration;
      updateTimeline();
    };

    const metadataHandlers = media.map((_, index) => () => {
      metadataLoaded[index] = true;
      syncDuration(index);
      scheduleProgressSync();
    });

    const durationHandlers = media.map((_, index) => () => {
      if (metadataLoaded[index]) syncDuration(index);
    });

    const errorHandlers = media.map((_, index) => () => {
      durations[index] = null;
      targetTimes[index] = null;
    });

    const updateLiquidFromPointer = (clientX: number, clientY: number) => {
      if (document.visibilityState !== 'visible') return;

      liquidEffects.forEach((effect, index) => {
        if (stageVisibilities[index] > 0.001) {
          effect?.setPointer(clientX, clientY);
        }
      });
    };

    const updateFirstVideoFromPointer = (clientX: number) => {
      if (
        scrollProgress >= TIMELINE.firstToSecond[0] ||
        document.visibilityState !== 'visible'
      ) {
        return;
      }

      const rect = surface.getBoundingClientRect();
      if (!Number.isFinite(rect.width) || rect.width <= 0) return;

      pointerProgress = clamp((clientX - rect.left) / rect.width, 0, 1);
      hasPointerInput = true;
      updateTimeline();
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (!event.isPrimary) return;

      updateLiquidFromPointer(event.clientX, event.clientY);

      if (
        activePointerId !== null ||
        scrollProgress >= TIMELINE.firstToSecond[0] ||
        durations[0] === null
      ) {
        return;
      }

      activePointerId = event.pointerId;
      surface.setPointerCapture(event.pointerId);
      event.preventDefault();
      updateFirstVideoFromPointer(event.clientX);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!event.isPrimary) return;

      updateLiquidFromPointer(event.clientX, event.clientY);

      if (durations[0] === null) return;

      const isActiveDrag = activePointerId === event.pointerId;
      const isMouseHover =
        event.pointerType === 'mouse' && activePointerId === null;

      if (!isActiveDrag && !isMouseHover) return;
      if (isActiveDrag) event.preventDefault();
      updateFirstVideoFromPointer(event.clientX);
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (!event.isPrimary) return;

      updateLiquidFromPointer(event.clientX, event.clientY);
      if (activePointerId !== event.pointerId) return;
      updateFirstVideoFromPointer(event.clientX);
      releasePointer();
    };

    const handlePointerCancel = (event: PointerEvent) => {
      if (activePointerId === event.pointerId) releasePointer();
    };

    const handlePointerLeave = (event: PointerEvent) => {
      if (
        activePointerId === event.pointerId &&
        !surface.hasPointerCapture(event.pointerId)
      ) {
        releasePointer();
      }
    };

    const handleLostPointerCapture = (event: PointerEvent) => {
      if (activePointerId === event.pointerId) activePointerId = null;
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        scheduleProgressSync();
        return;
      }

      releasePointer();
      cancelScrollFrame();
      cancelSeekFrame();
      media.forEach((video) => video.pause());
    };

    const handlePageShow = () => {
      scheduleViewportUpdate();
    };

    const handleSectionVisibility = (
      entries: IntersectionObserverEntry[],
    ) => {
      const entry = entries[0];
      if (!entry) return;

      isSectionVisible = entry.isIntersecting;

      if (isSectionVisible) {
        scheduleViewportUpdate();
        return;
      }

      releasePointer();
      cancelScrollFrame();
      cancelSeekFrame();
      targetTimes.fill(null);
      liquidEffects.forEach((effect) => effect?.setActive(false));
    };

    media.forEach((video, index) => {
      video.addEventListener('loadedmetadata', metadataHandlers[index]);
      video.addEventListener('durationchange', durationHandlers[index]);
      video.addEventListener('error', errorHandlers[index]);
    });
    surface.addEventListener('pointerdown', handlePointerDown);
    surface.addEventListener('pointermove', handlePointerMove, { passive: false });
    surface.addEventListener('pointerup', handlePointerUp);
    surface.addEventListener('pointercancel', handlePointerCancel);
    surface.addEventListener('pointerleave', handlePointerLeave);
    surface.addEventListener('lostpointercapture', handleLostPointerCapture);
    window.addEventListener('scroll', scheduleProgressSync, { passive: true });
    window.addEventListener('resize', scheduleViewportUpdate, { passive: true });
    window.addEventListener('pageshow', handlePageShow);
    window.visualViewport?.addEventListener('resize', scheduleViewportUpdate, {
      passive: true,
    });
    document.addEventListener('visibilitychange', handleVisibilityChange);

    if ('IntersectionObserver' in window) {
      sectionObserver = new IntersectionObserver(handleSectionVisibility, {
        threshold: 0.001,
      });
      sectionObserver.observe(section);
    }

    if (window.ResizeObserver) {
      resizeObserver = new ResizeObserver(scheduleProgressSync);
      resizeObserver.observe(section);
    }

    updateViewportMetrics();
    scheduleProgressSync();

    media.forEach((video, index) => {
      if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
        metadataHandlers[index]();
      }
    });

    return () => {
      releasePointer();
      cancelScrollFrame();
      cancelSeekFrame();
      cancelResizeFrame();
      liquidEffects.forEach((effect) => effect?.dispose());
      resizeObserver?.disconnect();
      sectionObserver?.disconnect();
      media.forEach((video, index) => {
        video.pause();
        video.removeEventListener('loadedmetadata', metadataHandlers[index]);
        video.removeEventListener('durationchange', durationHandlers[index]);
        video.removeEventListener('error', errorHandlers[index]);
      });
      surface.removeEventListener('pointerdown', handlePointerDown);
      surface.removeEventListener('pointermove', handlePointerMove);
      surface.removeEventListener('pointerup', handlePointerUp);
      surface.removeEventListener('pointercancel', handlePointerCancel);
      surface.removeEventListener('pointerleave', handlePointerLeave);
      surface.removeEventListener('lostpointercapture', handleLostPointerCapture);
      window.removeEventListener('scroll', scheduleProgressSync);
      window.removeEventListener('resize', scheduleViewportUpdate);
      window.removeEventListener('pageshow', handlePageShow);
      window.visualViewport?.removeEventListener(
        'resize',
        scheduleViewportUpdate,
      );
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return (
    <section ref={sectionRef} className="sequence-story">
        <div
          ref={surfaceRef}
          className="sequence-surface"
          data-first-stage-active="true"
          aria-label="三段连续的交互视频画面"
        >
          <audio ref={bgmRef} src="/bgm.mp3" preload="metadata" loop />
          <button
            className="sequence-sound-toggle"
            type="button"
            data-active={isBgmEnabled}
            aria-pressed={isBgmEnabled}
            aria-label={isBgmEnabled ? '关闭背景音乐' : '开启背景音乐'}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={handleBgmToggle}
          >
            <span className="sequence-sound-bars" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span>SOUND</span>
            <span className="sequence-sound-state">
              {isBgmEnabled ? 'ON' : 'OFF'}
            </span>
          </button>
          <video
            ref={firstVideoRef}
            className="sequence-video sequence-video-one"
            src="/head-turn.mp4"
            poster="/head-turn-poster.jpg"
            muted
            playsInline
            preload="auto"
            controls={false}
            draggable={false}
            aria-label="第一段画面，可通过横向移动控制"
          />
          <canvas
            ref={firstLiquidCanvasRef}
            className="liquid-distortion-canvas liquid-distortion-canvas-one"
            aria-hidden="true"
          />
          <video
            ref={secondVideoRef}
            className="sequence-video sequence-video-two"
            src="/sequence-stage-2.mp4"
            poster="/sequence-stage-2-poster.jpg"
            muted
            playsInline
            preload="none"
            controls={false}
            draggable={false}
            aria-label="第二段滚动画面"
          />
          <canvas
            ref={secondLiquidCanvasRef}
            className="liquid-distortion-canvas liquid-distortion-canvas-two"
            aria-hidden="true"
          />
          <video
            ref={thirdVideoRef}
            className="sequence-video sequence-video-three"
            src="/sequence-stage-3.mp4"
            poster="/sequence-stage-3-poster.jpg"
            muted
            playsInline
            preload="none"
            controls={false}
            draggable={false}
            aria-label="第三段滚动画面"
          />
          <canvas
            ref={thirdLiquidCanvasRef}
            className="liquid-distortion-canvas liquid-distortion-canvas-three"
            aria-hidden="true"
          />
          <section
            className="second-stage-experience"
            aria-label="工作经历"
          >
            <div className="experience-panel">
              <header className="experience-heading">
                <p className="experience-kicker">EXPERIENCE</p>
                <h2 className="experience-title">工作经历</h2>
              </header>
              <ol className="experience-list">
                <li className="experience-card experience-card-one">
                  <span className="experience-index" aria-hidden="true">
                    01
                  </span>
                  <div className="experience-entry-copy">
                    <h3 className="experience-company">网易游戏</h3>
                    <p className="experience-period">2021.07—2024.08</p>
                    <p className="experience-role">游戏营销</p>
                  </div>
                </li>
                <li className="experience-card experience-card-two">
                  <span className="experience-index" aria-hidden="true">
                    02
                  </span>
                  <div className="experience-entry-copy">
                    <h3 className="experience-company">鎏漩影创</h3>
                    <p className="experience-period">2025.10—2026.02</p>
                    <p className="experience-role">广告内容生产主管</p>
                  </div>
                </li>
                <li className="experience-card experience-card-three">
                  <span className="experience-index" aria-hidden="true">
                    03
                  </span>
                  <div className="experience-entry-copy">
                    <h3 className="experience-company">皮匹缇贸易</h3>
                    <p className="experience-period">2026.04—2026.08</p>
                    <p className="experience-role">电商运营</p>
                  </div>
                </li>
              </ol>
            </div>
          </section>
          <section className="third-stage-copy" aria-label="社媒内容能力">
            <p className="third-stage-copy-part third-stage-eyebrow">
              SOCIAL NATIVE
            </p>
            <h2 className="third-stage-copy-part third-stage-heading">
              <span>我熟悉的不是平台，</span>
              <span>而是平台里的内容语言。</span>
            </h2>
            <p className="third-stage-copy-part third-stage-description">
              长期活跃于抖音、B站、YouTube、Instagram
              等国内外主流社媒，理解不同平台的用户行为、内容节奏与传播机制。能够从产品核心卖点出发，根据平台语境制定差异化内容策略。
            </p>
            <p className="third-stage-copy-part third-stage-keywords">
              <span>用户洞察</span>
              <span aria-hidden="true">·</span>
              <span>平台语境</span>
              <span aria-hidden="true">·</span>
              <span className="third-stage-keyword-accent">内容策略</span>
              <span aria-hidden="true">·</span>
              <span>传播转化</span>
            </p>
          </section>
          <div className="first-stage-copy" aria-label="个人介绍">
            <div className="first-stage-copy-column">
              <div className="first-stage-copy-slot first-stage-copy-slot-left">
                <h1 className="first-stage-heading">
                  <span className="first-stage-greeting">HI, I’M</span>
                  <span className="first-stage-name">CHIU MING</span>
                </h1>
              </div>
              <div className="first-stage-copy-slot first-stage-copy-slot-right">
                <p className="first-stage-roleline">
                  GAME MARKETING ·{' '}
                  <span className="first-stage-accent">AIGC</span> · CONTENT
                  GROWTH
                </p>
                <p className="first-stage-intro">
                  <span className="first-stage-intro-lead">
                    4年游戏营销与买量创意经验，具备内容策略、团队管理与AIGC实战能力。
                  </span>
                  <span>
                    深耕用户洞察、创意策划与素材生产，擅长将
                    <strong className="first-stage-accent">
                      AI工作流 × 增长方法论
                    </strong>
                  </span>
                  <span>落地到实际业务，推动内容效率与商业转化。</span>
                </p>
              </div>
            </div>
          </div>
        </div>
    </section>
  );
}
