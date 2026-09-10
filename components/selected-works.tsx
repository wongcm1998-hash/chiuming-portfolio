'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, Volume2, VolumeX } from 'lucide-react';
import Image from 'next/image';

const FILTERS = ['全部', 'AIGC', '原生化', '效果广告', '真人实拍'] as const;
const GAME_AD_SUBTITLE = '广告创意 · 脚本 · 视频统筹';

type WorkFilter = (typeof FILTERS)[number];
type WorkCategory = Exclude<WorkFilter, '全部'>;
type WorkOrientation = 'landscape' | 'portrait' | 'square';

type WorkProject = {
  id: string;
  index: string;
  title: string;
  type: string;
  responsibilities: string;
  resultLabel: string;
  result: string;
  year: string;
  video: string;
  poster?: string;
  categories: WorkCategory[];
  wide?: boolean;
  isAigcAd?: boolean;
};

const PROJECTS: WorkProject[] = [
  {
    id: 'attack-on-titan-wedding',
    index: '01',
    title: '《进击的巨人》三笠 × 艾伦婚礼',
    type: 'AIGC剧情短片',
    responsibilities: 'AIGC创意 · 视频制作',
    resultLabel: '作品分类',
    result: 'AIGC',
    year: '2026',
    video: '/aigc-attack-on-titan-wedding.mp4',
    categories: ['AIGC'],
    wide: true,
  },
  {
    id: 'dragon-ball-frieza-krillin',
    index: '02',
    title: '《龙珠》弗利萨 × 克林',
    type: 'AIGC剧情短片',
    responsibilities: 'AIGC创意 · 视频制作',
    resultLabel: '作品分类',
    result: 'AIGC',
    year: '2026',
    video: '/aigc-dragon-ball-frieza-krillin.mp4',
    categories: ['AIGC'],
  },
  {
    id: 'dragon-ball-17-18',
    index: '03',
    title: '《龙珠》17号 × 18号',
    type: 'AIGC剧情短片',
    responsibilities: 'AIGC创意 · 视频制作',
    resultLabel: '作品分类',
    result: 'AIGC',
    year: '2026',
    video: '/aigc-dragon-ball-17-18.mp4',
    categories: ['AIGC'],
  },
  {
    id: 'demon-slayer-behind-scenes',
    index: '04',
    title: '《鬼灭之刃》拍摄花絮',
    type: 'AIGC剧情短片',
    responsibilities: 'AIGC创意 · 视频制作',
    resultLabel: '作品分类',
    result: 'AIGC',
    year: '2026',
    video: '/aigc-demon-slayer-behind-scenes.mp4',
    categories: ['AIGC'],
    wide: true,
  },
  {
    id: 'demon-slayer-muzan-reverse',
    index: '05',
    title: '《鬼灭之刃》无惨逆流',
    type: 'AIGC剧情短片',
    responsibilities: 'AIGC创意 · 视频制作',
    resultLabel: '作品分类',
    result: 'AIGC',
    year: '2026',
    video: '/aigc-demon-slayer-muzan-reverse.mp4',
    categories: ['AIGC'],
  },
  {
    id: 'face-revenge-vol-1',
    index: '06',
    title: '《抉择游戏之变脸复仇》AI广告 VOL.1',
    type: GAME_AD_SUBTITLE,
    responsibilities: 'AIGC创意 · 广告制作',
    resultLabel: '作品分类',
    result: 'AIGC AD',
    year: '2026',
    video: '/aigc-face-revenge-vol-1.mp4',
    categories: ['AIGC'],
    isAigcAd: true,
  },
  {
    id: 'face-revenge-vol-2',
    index: '07',
    title: '《抉择游戏之变脸复仇》AI广告 VOL.2',
    type: GAME_AD_SUBTITLE,
    responsibilities: 'AIGC创意 · 广告制作',
    resultLabel: '作品分类',
    result: 'AIGC AD',
    year: '2026',
    video: '/aigc-face-revenge-vol-2.mp4',
    categories: ['AIGC'],
    wide: true,
    isAigcAd: true,
  },
  {
    id: 'land-of-glory-aigc-vol-1',
    index: '08',
    title: '《率土之滨》AIGC广告 VOL.1',
    type: GAME_AD_SUBTITLE,
    responsibilities: 'AIGC创意 · 广告制作',
    resultLabel: '作品分类',
    result: 'AIGC AD',
    year: '2025',
    video: '/aigc-land-of-glory-vol-1.mp4',
    categories: ['AIGC'],
    isAigcAd: true,
  },
  {
    id: 'land-of-glory-native-vol-1',
    index: '09',
    title: '《率土之滨》原生化广告 VOL.1',
    type: GAME_AD_SUBTITLE,
    responsibilities: '广告创意 · 视频制作',
    resultLabel: '作品分类',
    result: '原生化',
    year: '—',
    video: '/native-land-of-glory-ad-vol-1.mp4',
    categories: ['原生化'],
  },
  {
    id: 'land-of-glory-native-vol-2',
    index: '10',
    title: '《率土之滨》原生化广告 VOL.2',
    type: GAME_AD_SUBTITLE,
    responsibilities: '广告创意 · 视频制作',
    resultLabel: '作品分类',
    result: '原生化',
    year: '—',
    video: '/native-land-of-glory-ad-vol-2.mp4',
    categories: ['原生化'],
  },
  {
    id: 'land-of-glory-native-vol-3',
    index: '11',
    title: '《率土之滨》原生化广告 VOL.3',
    type: GAME_AD_SUBTITLE,
    responsibilities: '广告创意 · 视频制作',
    resultLabel: '作品分类',
    result: '原生化',
    year: '—',
    video: '/native-land-of-glory-ad-vol-3.mp4',
    categories: ['原生化'],
  },
  {
    id: 'land-of-glory-native-vol-4',
    index: '12',
    title: '《率土之滨》原生化广告 VOL.4',
    type: GAME_AD_SUBTITLE,
    responsibilities: '广告创意 · 视频制作',
    resultLabel: '作品分类',
    result: '原生化',
    year: '—',
    video: '/native-land-of-glory-ad-vol-4.mp4',
    categories: ['原生化'],
  },
  {
    id: 'land-of-glory-native-vol-5',
    index: '13',
    title: '《率土之滨》原生化广告 VOL.5',
    type: GAME_AD_SUBTITLE,
    responsibilities: '广告创意 · 视频制作',
    resultLabel: '作品分类',
    result: '原生化',
    year: '—',
    video: '/native-land-of-glory-ad-vol-5.mp4',
    categories: ['原生化'],
  },
  {
    id: 'land-of-glory-performance-vol-1',
    index: '14',
    title: '《率土之滨》效果广告 VOL.1',
    type: GAME_AD_SUBTITLE,
    responsibilities: '效果创意 · 视频制作',
    resultLabel: '作品分类',
    result: '效果广告',
    year: '—',
    video: '/performance-land-of-glory-ad-vol-1.mp4',
    categories: ['效果广告'],
  },
  {
    id: 'land-of-glory-performance-vol-2',
    index: '15',
    title: '《率土之滨》效果广告 VOL.2',
    type: GAME_AD_SUBTITLE,
    responsibilities: '效果创意 · 视频制作',
    resultLabel: '作品分类',
    result: '效果广告',
    year: '—',
    video: '/performance-land-of-glory-ad-vol-2.mp4',
    categories: ['效果广告'],
  },
  {
    id: 'land-of-glory-performance-vol-3',
    index: '16',
    title: '《率土之滨》效果广告 VOL.3',
    type: GAME_AD_SUBTITLE,
    responsibilities: '效果创意 · 视频制作',
    resultLabel: '作品分类',
    result: '效果广告',
    year: '—',
    video: '/performance-land-of-glory-ad-vol-3.mp4',
    categories: ['效果广告'],
  },
  {
    id: 'land-of-glory-performance-vol-4',
    index: '17',
    title: '《率土之滨》效果广告 VOL.4',
    type: GAME_AD_SUBTITLE,
    responsibilities: '效果创意 · 视频制作',
    resultLabel: '作品分类',
    result: '效果广告',
    year: '—',
    video: '/performance-land-of-glory-ad-vol-4.mp4',
    categories: ['效果广告'],
  },
  {
    id: 'land-of-glory-performance-vol-5',
    index: '18',
    title: '《率土之滨》效果广告 VOL.5',
    type: GAME_AD_SUBTITLE,
    responsibilities: '效果创意 · 视频制作',
    resultLabel: '作品分类',
    result: '效果广告',
    year: '—',
    video: '/performance-land-of-glory-ad-vol-5.mp4',
    categories: ['效果广告'],
  },
  {
    id: 'land-of-glory-live-action-vol-1',
    index: '19',
    title: '《率土之滨》真人实拍广告 VOL.1',
    type: GAME_AD_SUBTITLE,
    responsibilities: '真人实拍 · 视频制作',
    resultLabel: '作品分类',
    result: '真人实拍',
    year: '—',
    video: '/live-action-land-of-glory-ad-vol-1.mp4',
    categories: ['真人实拍'],
  },
  {
    id: 'land-of-glory-live-action-vol-2',
    index: '20',
    title: '《率土之滨》真人实拍广告 VOL.2',
    type: GAME_AD_SUBTITLE,
    responsibilities: '真人实拍 · 视频制作',
    resultLabel: '作品分类',
    result: '真人实拍',
    year: '—',
    video: '/live-action-land-of-glory-ad-vol-2.mp4',
    categories: ['真人实拍'],
  },
  {
    id: 'land-of-glory-live-action-vol-3',
    index: '21',
    title: '《率土之滨》真人实拍广告 VOL.3',
    type: GAME_AD_SUBTITLE,
    responsibilities: '真人实拍 · 视频制作',
    resultLabel: '作品分类',
    result: '真人实拍',
    year: '—',
    video: '/live-action-land-of-glory-ad-vol-3.mp4',
    categories: ['真人实拍'],
  },
  {
    id: 'land-of-glory-live-action-vol-4',
    index: '22',
    title: '《率土之滨》真人实拍广告 VOL.4',
    type: GAME_AD_SUBTITLE,
    responsibilities: '真人实拍 · 视频制作',
    resultLabel: '作品分类',
    result: '真人实拍',
    year: '—',
    video: '/live-action-land-of-glory-ad-vol-4.mp4',
    categories: ['真人实拍'],
  },
];

const PORTRAIT_PROJECT_IDS = new Set([
  'face-revenge-vol-1',
  'face-revenge-vol-2',
  'land-of-glory-performance-vol-5',
  'land-of-glory-live-action-vol-2',
]);

const ORIGINAL_VIDEO_PROJECT_IDS = new Set([
  'land-of-glory-native-vol-2',
  'land-of-glory-performance-vol-3',
  'land-of-glory-live-action-vol-1',
  'land-of-glory-live-action-vol-2',
]);

function getProjectOrientation(project: WorkProject): WorkOrientation {
  return PORTRAIT_PROJECT_IDS.has(project.id) ? 'portrait' : 'landscape';
}

function getProjectPoster(project: WorkProject) {
  return (
    project.poster ?? project.video.replace(/\.mp4$/i, '-poster.webp')
  );
}

function getProjectVideo(project: WorkProject) {
  if (ORIGINAL_VIDEO_PROJECT_IDS.has(project.id)) {
    return project.video;
  }

  return project.video.replace(/^\//, '/optimized-videos/');
}

type WorkLayoutGroup = {
  kind: 'mixed' | 'landscape-row' | 'portrait-row' | 'single';
  projects: WorkProject[];
};

function buildWorkLayout(
  projects: WorkProject[],
  orientations: Record<string, WorkOrientation>,
) {
  const portraits: WorkProject[] = [];
  const landscapes: WorkProject[] = [];

  projects.forEach((project) => {
    const orientation =
      orientations[project.id] ?? getProjectOrientation(project);

    if (orientation === 'portrait') {
      portraits.push(project);
    } else {
      landscapes.push(project);
    }
  });

  const groups: WorkLayoutGroup[] = [];

  while (portraits.length > 0 && landscapes.length >= 2) {
    groups.push({
      kind: 'mixed',
      projects: [landscapes.shift()!, landscapes.shift()!, portraits.shift()!],
    });
  }

  while (landscapes.length > 0) {
    const row = landscapes.splice(0, 2);
    groups.push({
      kind: row.length === 2 ? 'landscape-row' : 'single',
      projects: row,
    });
  }

  while (portraits.length > 0) {
    const row = portraits.splice(0, 2);
    groups.push({
      kind: row.length === 2 ? 'portrait-row' : 'single',
      projects: row,
    });
  }

  return groups;
}

function WorkCard({
  project,
  featured = false,
  orientation,
  onOrientationChange,
}: {
  project: WorkProject;
  featured?: boolean;
  orientation: WorkOrientation;
  onOrientationChange: (id: string, orientation: WorkOrientation) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressTimerRef = useRef<number | null>(null);
  const progressFillRef = useRef<HTMLSpanElement>(null);
  const previewRequestRef = useRef(0);
  const fullscreenRef = useRef(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSoundOn, setIsSoundOn] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const poster = getProjectPoster(project);
  const videoSource = getProjectVideo(project);

  const cancelProgressTimer = useCallback(() => {
    if (progressTimerRef.current !== null) {
      window.clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }, []);

  const startProgressLoop = useCallback(() => {
    cancelProgressTimer();

    const tick = () => {
      const video = videoRef.current;

      if (!video || video.paused) {
        if (progressTimerRef.current !== null) {
          window.clearInterval(progressTimerRef.current);
          progressTimerRef.current = null;
        }
        return;
      }

      if (
        Number.isFinite(video.duration) &&
        video.duration > 0
      ) {
        const progress = Math.min(
          Math.max(video.currentTime / video.duration, 0),
          1,
        );
        progressFillRef.current?.style.setProperty(
          'transform',
          `scaleX(${progress})`,
        );
      }
    };

    tick();
    progressTimerRef.current = window.setInterval(tick, 1000 / 25);
  }, [cancelProgressTimer]);

  const ensureVideoSource = useCallback(
    (preload: 'metadata' | 'auto' = 'auto') => {
      const video = videoRef.current;

      if (!video) {
        return null;
      }

      video.preload = preload;

      if (!video.hasAttribute('src')) {
        video.src = videoSource;
        video.load();
      }

      return video;
    },
    [videoSource],
  );

  const startPreview = useCallback((withSound = false) => {
    const video = ensureVideoSource('auto');

    if (!video) {
      return;
    }

    video.muted = !withSound;
    setIsSoundOn(withSound);
    const requestId = ++previewRequestRef.current;

    if (!video.paused) {
      setIsPreviewing(true);
      if (progressTimerRef.current === null) {
        startProgressLoop();
      }
      return;
    }

    video
      .play()
      .then(() => {
        if (requestId !== previewRequestRef.current) {
          video.pause();
          return;
        }

        setIsPreviewing(true);
        startProgressLoop();
      })
      .catch(() => {
        if (requestId === previewRequestRef.current) {
          setIsPreviewing(false);
        }
      });
  }, [ensureVideoSource, startProgressLoop]);

  const stopPreview = useCallback(() => {
    const video = videoRef.current;

    previewRequestRef.current += 1;
    cancelProgressTimer();

    if (video) {
      video.pause();
      video.muted = true;
      if (video.readyState > 0) {
        video.currentTime = 0;
      }
    }

    progressFillRef.current?.style.setProperty('transform', 'scaleX(0)');
    setIsPreviewing(false);
    setIsSoundOn(false);
  }, [cancelProgressTimer]);

  const handleMediaClick = () => {
    const video = ensureVideoSource('auto');
    if (!video) return;

    if (video.paused) {
      startPreview(true);
      return;
    }

    const nextSoundOn = video.muted;
    video.muted = !nextSoundOn;
    setIsSoundOn(nextSoundOn);
  };

  const handleFullscreen = async () => {
    const video = ensureVideoSource('auto');

    if (!video) {
      return;
    }

    const fullscreenVideo = video as HTMLVideoElement & {
      webkitEnterFullscreen?: () => void;
    };

    fullscreenRef.current = true;
    setIsFullscreen(true);
    video.controls = true;
    startPreview(true);

    try {
      if (video.requestFullscreen) {
        await video.requestFullscreen();
      } else if (fullscreenVideo.webkitEnterFullscreen) {
        fullscreenVideo.webkitEnterFullscreen();
      } else {
        throw new Error('Fullscreen video is not supported in this browser.');
      }
    } catch {
      fullscreenRef.current = false;
      setIsFullscreen(false);
      video.controls = false;
      stopPreview();
    }
  };

  useEffect(() => {
    const video = videoRef.current;

    if (!video) {
      return stopPreview;
    }

    const finishFullscreen = () => {
      if (!fullscreenRef.current) {
        return;
      }

      fullscreenRef.current = false;
      setIsFullscreen(false);
      video.controls = false;
      stopPreview();
    };

    const handleFullscreenChange = () => {
      if (fullscreenRef.current && document.fullscreenElement !== video) {
        finishFullscreen();
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    video.addEventListener('webkitendfullscreen', finishFullscreen);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      video.removeEventListener('webkitendfullscreen', finishFullscreen);
      fullscreenRef.current = false;
      video.controls = false;
      stopPreview();
      video.removeAttribute('src');
      video.load();
    };
  }, [stopPreview]);

  return (
    <article
      className={`work-card${featured ? ' work-card-featured' : ''}${project.wide ? ' work-card-wide' : ''}`}
      data-previewing={isPreviewing}
      data-sound={isSoundOn}
      data-fullscreen={isFullscreen}
      data-orientation={orientation}
      onPointerEnter={(event) => {
        if (event.pointerType !== 'touch') {
          startPreview(false);
        }
      }}
      onPointerLeave={(event) => {
        if (event.pointerType !== 'touch' && !fullscreenRef.current) {
          stopPreview();
        }
      }}
      onFocusCapture={() => startPreview(false)}
      onBlurCapture={(event) => {
        if (
          !fullscreenRef.current &&
          !event.currentTarget.contains(event.relatedTarget)
        ) {
          stopPreview();
        }
      }}
    >
      <div className="work-media">
        <video
          ref={videoRef}
          className="work-video"
          poster={poster}
          muted
          playsInline
          loop
          preload="none"
          controls={isFullscreen}
          tabIndex={-1}
          aria-hidden={!isFullscreen}
          onVolumeChange={(event) => {
            const video = event.currentTarget;
            setIsSoundOn(!video.muted && video.volume > 0);
          }}
          onLoadedMetadata={(event) => {
            const video = event.currentTarget;
            const ratio = video.videoWidth / video.videoHeight;

            if (Number.isFinite(ratio) && ratio > 0) {
              onOrientationChange(
                project.id,
                ratio < 0.82
                  ? 'portrait'
                  : ratio < 1.2
                    ? 'square'
                    : 'landscape',
              );
            }

          }}
        />
        <Image
          className="work-poster"
          src={poster}
          alt=""
          fill
          sizes={
            featured
              ? '(max-width: 980px) 100vw, 67vw'
              : '(max-width: 620px) 100vw, 50vw'
          }
          unoptimized
          loading={featured ? 'eager' : 'lazy'}
          fetchPriority={featured ? 'high' : 'low'}
          decoding="async"
        />
        <span className="work-media-index">{project.index}</span>
        <span className="work-media-hint">
          {featured ? 'FEATURED VIDEO' : 'HOVER TO PLAY'}
        </span>
        <span className="work-media-controls">
          <button
            className="work-media-control work-sound-button"
            type="button"
            aria-label={
              isSoundOn
                ? `关闭${project.title}原声`
                : `${isPreviewing ? '开启' : '播放'}${project.title}原声`
            }
            aria-pressed={isSoundOn}
            onClick={handleMediaClick}
          >
            {isSoundOn ? <Volume2 /> : <VolumeX />}
          </button>
          <button
            className="work-media-control work-fullscreen-button"
            type="button"
            aria-label={`全屏播放${project.title}`}
            title="全屏播放"
            onClick={handleFullscreen}
          >
            <Maximize2 />
          </button>
        </span>
        <span className="work-progress" aria-hidden="true">
          <span ref={progressFillRef} />
        </span>
      </div>

      <div className="work-details">
        <div className="work-details-main">
          <p className="work-type">{project.type}</p>
          <h3 className="work-title">{project.title}</h3>
          <p className="work-responsibilities">{project.responsibilities}</p>
        </div>
        <div className="work-outcome">
          <p>{project.resultLabel}</p>
          <strong>{project.result}</strong>
          <time>{project.year}</time>
        </div>
      </div>
    </article>
  );
}

export function SelectedWorks() {
  const pageRef = useRef<HTMLElement>(null);
  const [activeFilter, setActiveFilter] = useState<WorkFilter>('全部');
  const [projectOrientations, setProjectOrientations] = useState<
    Record<string, WorkOrientation>
  >({});

  const handleOrientationChange = useCallback(
    (id: string, orientation: WorkOrientation) => {
      setProjectOrientations((current) =>
        current[id] === orientation
          ? current
          : { ...current, [id]: orientation },
      );
    },
    [],
  );

  useEffect(() => {
    const page = pageRef.current;
    if (!page) return;

    let frameId: number | null = null;

    const clampProgress = (value: number) => Math.min(Math.max(value, 0), 1);
    const smoothstep = (value: number) => value * value * (3 - 2 * value);
    const rangeProgress = (value: number, start: number, end: number) =>
      smoothstep(clampProgress((value - start) / (end - start)));

    const syncTransition = () => {
      frameId = null;

      const viewportHeight =
        window.visualViewport?.height ?? window.innerHeight;
      if (!Number.isFinite(viewportHeight) || viewportHeight <= 0) return;

      const rect = page.getBoundingClientRect();
      const progress = clampProgress(
        (viewportHeight - rect.top) / viewportHeight,
      );
      const copyReveal = rangeProgress(progress, 0.28, 0.82);
      const featuredReveal = rangeProgress(progress, 0.14, 0.76);
      const edgeOpacity = Math.min(progress * 5, (1 - progress) * 7, 1);

      page.style.setProperty('--works-overlap-height', `${viewportHeight}px`);
      page.style.setProperty('--works-transition-progress', String(progress));
      page.style.setProperty('--works-copy-reveal', String(copyReveal));
      page.style.setProperty('--works-featured-reveal', String(featuredReveal));
      page.style.setProperty(
        '--works-edge-opacity',
        String(Math.max(edgeOpacity, 0)),
      );
    };

    const scheduleTransitionSync = () => {
      if (frameId === null) {
        frameId = requestAnimationFrame(syncTransition);
      }
    };

    const handlePageShow = () => scheduleTransitionSync();

    window.addEventListener('scroll', scheduleTransitionSync, { passive: true });
    window.addEventListener('resize', scheduleTransitionSync, { passive: true });
    window.addEventListener('pageshow', handlePageShow);
    window.visualViewport?.addEventListener('resize', scheduleTransitionSync, {
      passive: true,
    });
    syncTransition();

    return () => {
      if (frameId !== null) cancelAnimationFrame(frameId);
      window.removeEventListener('scroll', scheduleTransitionSync);
      window.removeEventListener('resize', scheduleTransitionSync);
      window.removeEventListener('pageshow', handlePageShow);
      window.visualViewport?.removeEventListener(
        'resize',
        scheduleTransitionSync,
      );
    };
  }, []);

  const visibleProjects = useMemo(
    () =>
      activeFilter === '全部'
        ? PROJECTS
        : PROJECTS.filter((project) =>
            project.categories.includes(activeFilter),
          ),
    [activeFilter],
  );

  const featuredProject = visibleProjects[0] ?? PROJECTS[0];
  const workLayout = useMemo(() => {
    if (activeFilter !== 'AIGC') {
      return buildWorkLayout(visibleProjects, projectOrientations);
    }

    const nonAdProjects = visibleProjects.filter(
      (project) => !project.isAigcAd,
    );
    const adProjects = visibleProjects.filter((project) => project.isAigcAd);

    return [
      ...buildWorkLayout(nonAdProjects, projectOrientations),
      ...buildWorkLayout(adProjects, projectOrientations),
    ];
  }, [activeFilter, projectOrientations, visibleProjects]);

  return (
    <section ref={pageRef} className="works-page" aria-label="视频作品">
      <section className="works-hero" aria-labelledby="works-title">
        <div className="works-hero-copy">
          <p className="works-kicker">SELECTED WORKS</p>
          <h2 id="works-title" className="works-hero-title">
            视频作品
          </h2>
          <p className="works-description">买量广告 · AIGC · 原生化内容 · 真人实拍</p>

          <nav className="works-filter" aria-label="作品类型筛选">
            {FILTERS.map((filter) => (
              <button
                key={filter}
                type="button"
                className={filter === activeFilter ? 'is-active' : undefined}
                aria-pressed={filter === activeFilter}
                onClick={() => setActiveFilter(filter)}
              >
                {filter}
              </button>
            ))}
          </nav>
        </div>

        <WorkCard
          key={`featured-${featuredProject.id}`}
          project={featuredProject}
          featured
          orientation={
            projectOrientations[featuredProject.id] ??
            getProjectOrientation(featuredProject)
          }
          onOrientationChange={handleOrientationChange}
        />
      </section>

      <section className="works-archive" aria-labelledby="works-archive-title">
        <header className="works-archive-header">
          <h2 id="works-archive-title">PROJECT INDEX</h2>
          <span aria-live="polite">
            {String(visibleProjects.length).padStart(2, '0')} WORKS
          </span>
        </header>

        <div className="works-grid">
          {workLayout.map((group) => {
            const groupKey = `${group.kind}-${group.projects.map((project) => project.id).join('-')}`;

            if (group.kind === 'mixed') {
              const [firstLandscape, secondLandscape, portrait] = group.projects;

              return (
                <div
                  key={groupKey}
                  className="works-layout-group works-layout-mixed"
                >
                  <div className="works-layout-stack">
                    {[firstLandscape, secondLandscape].map((project) => (
                      <WorkCard
                        key={project.id}
                        project={project}
                        orientation={
                          projectOrientations[project.id] ??
                          getProjectOrientation(project)
                        }
                        onOrientationChange={handleOrientationChange}
                      />
                    ))}
                  </div>
                  <WorkCard
                    project={portrait}
                    orientation={
                      projectOrientations[portrait.id] ??
                      getProjectOrientation(portrait)
                    }
                    onOrientationChange={handleOrientationChange}
                  />
                </div>
              );
            }

            return (
              <div
                key={groupKey}
                className={`works-layout-group works-layout-${group.kind}`}
              >
                {group.projects.map((project) => (
                  <WorkCard
                    key={project.id}
                    project={project}
                    orientation={
                      projectOrientations[project.id] ??
                      getProjectOrientation(project)
                    }
                    onOrientationChange={handleOrientationChange}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </section>

      <footer className="site-contact" aria-labelledby="contact-title">
        <p id="contact-title" className="site-contact-kicker">
          CONTACT
        </p>

        <div className="site-contact-list">
          <a href="mailto:huangcm1998@163.com" className="site-contact-item">
            <span>Email</span>
            <strong>huangcm1998@163.com</strong>
          </a>

          <div className="site-contact-item">
            <span>Wechat</span>
            <strong>Wong_ChiuMing</strong>
          </div>
        </div>
      </footer>
    </section>
  );
}
