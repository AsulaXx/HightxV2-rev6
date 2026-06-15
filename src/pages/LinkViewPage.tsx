import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ExternalLink, ArrowLeft, Play, Pause, Volume2, VolumeX, ChevronDown, Music } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, updateDoc, increment } from "firebase/firestore";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";

interface LinkItem {
  title: string;
  url: string;
  icon?: string;
  iconUrl?: string;
  enabled: boolean;
}

interface LinkPageData {
  title: string;
  description: string;
  slug: string;
  links: LinkItem[];
  ownerId?: string;
  ownerName: string;
  published: boolean;
  avatarUrl?: string;
  avatarBorderColor?: string;
  avatarBorderWidth?: number;
  avatarBorderStyle?: string;
  avatarGlow?: boolean;
  avatarGlowColor?: string;
  avatarShape?: string;
  typingEffect?: boolean;
  typingLoop?: boolean;
  particleMode?: string;
  titleGradientFrom?: string;
  titleGradientTo?: string;
  themeColor?: string;
  themeBg?: string;
  themeBgImage?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  bgMusicUrl?: string;
  bgMusicCoverUrl?: string;
  bgMusicTitle?: string;
  bgMusicArtist?: string;
  bgMusicStartTime?: number;
  bgMusicAutoPlay?: boolean;
}

// Typewriter effect component with optional loop
const TypewriterTitle = ({ text, loop, className, style }: { text: string; loop?: boolean; className?: string; style?: React.CSSProperties }) => {
  const [displayText, setDisplayText] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDisplayText("");
    setDone(false);
    let i = 0;
    let deleting = false;
    let timeout: ReturnType<typeof setTimeout>;

    const tick = () => {
      if (!deleting) {
        i++;
        setDisplayText(text.slice(0, i));
        if (i >= text.length) {
          setDone(true);
          if (loop) {
            timeout = setTimeout(() => {
              deleting = true;
              setDone(false);
              tick();
            }, 2000);
            return;
          }
          return;
        }
      } else {
        i--;
        setDisplayText(text.slice(0, i));
        if (i <= 0) {
          deleting = false;
          timeout = setTimeout(tick, 500);
          return;
        }
      }
      timeout = setTimeout(tick, deleting ? 40 : 80);
    };

    timeout = setTimeout(tick, 80);
    return () => clearTimeout(timeout);
  }, [text, loop]);

  return (
    <h1 className={className} style={style}>
      {displayText}
      {(!done || loop) && (
        <motion.span
          animate={{ opacity: [1, 0] }}
          transition={{ repeat: Infinity, duration: 0.6 }}
          className="inline-block ml-0.5"
          style={{ color: style?.color }}
        >
          |
        </motion.span>
      )}
    </h1>
  );
};

// Mini particle canvas for linktree page
const LinkParticles = ({ mode, color }: { mode: string; color?: string }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const particleColor = color || "#ffffff";
    const count = mode === "stars" ? 60 : mode === "snow" ? 50 : mode === "bubbles" ? 30 : 40;

    interface P { x: number; y: number; vx: number; vy: number; size: number; opacity: number; phase: number; }
    const particles: P[] = [];
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * (mode === "snow" ? 0.3 : 0.5),
        vy: mode === "snow" ? Math.random() * 0.8 + 0.2 : mode === "bubbles" ? -(Math.random() * 0.5 + 0.2) : (Math.random() - 0.5) * 0.5,
        size: mode === "bubbles" ? Math.random() * 6 + 2 : mode === "stars" ? Math.random() * 2 + 1 : Math.random() * 3 + 1,
        opacity: Math.random() * 0.5 + 0.2,
        phase: Math.random() * Math.PI * 2,
      });
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const time = Date.now() * 0.001;
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -10) p.x = canvas.width + 10;
        if (p.x > canvas.width + 10) p.x = -10;
        if (p.y < -10) p.y = canvas.height + 10;
        if (p.y > canvas.height + 10) p.y = -10;

        const flicker = mode === "stars" ? Math.abs(Math.sin(time * 2 + p.phase)) : 1;
        ctx.globalAlpha = p.opacity * flicker;
        ctx.fillStyle = particleColor;

        if (mode === "bubbles") {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.strokeStyle = particleColor;
          ctx.lineWidth = 0.5;
          ctx.stroke();
          ctx.globalAlpha = p.opacity * 0.15;
          ctx.fill();
        } else if (mode === "stars") {
          ctx.beginPath();
          const s = p.size;
          for (let j = 0; j < 5; j++) {
            const angle = (j * 4 * Math.PI) / 5 - Math.PI / 2;
            const method = j === 0 ? "moveTo" : "lineTo";
            ctx[method](p.x + s * Math.cos(angle), p.y + s * Math.sin(angle));
          }
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      animRef.current = requestAnimationFrame(animate);
    };

    animate();
    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [mode, color]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0 pointer-events-none"
      style={{ opacity: 0.6 }}
    />
  );
};

// Music player with compact pill UI, cover art, progress bar
const MusicPlayer = ({ url, themeColor, textColor, subtleTextColor, hasCustomTheme, coverUrl, title, artist, startTime, autoPlay }: {
  url: string;
  themeColor?: string;
  textColor?: string;
  subtleTextColor?: string;
  hasCustomTheme: boolean;
  coverUrl?: string;
  title?: string;
  artist?: string;
  startTime?: number;
  autoPlay?: boolean;
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [isMuted, setIsMuted] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showVolume, setShowVolume] = useState(false);
  const hasAutoPlayed = useRef(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);

  // Auto-play: try immediately, if blocked wait for user interaction
  useEffect(() => {
    if (!autoPlay || hasAutoPlayed.current) return;
    const audio = audioRef.current;
    if (!audio) return;

    const tryPlay = () => {
      if (startTime) audio.currentTime = startTime;
      audio.play().then(() => {
        setIsPlaying(true);
        hasAutoPlayed.current = true;
      }).catch(() => {
        // Browser blocked autoplay - listen for ANY user interaction
        const onInteraction = () => {
          if (hasAutoPlayed.current) return;
          if (startTime) audio.currentTime = startTime;
          audio.play().then(() => {
            setIsPlaying(true);
            hasAutoPlayed.current = true;
          }).catch(() => {});
          cleanup();
        };
        const cleanup = () => {
          ["click", "touchstart", "keydown", "scroll"].forEach(e =>
            document.removeEventListener(e, onInteraction)
          );
        };
        ["click", "touchstart", "keydown", "scroll"].forEach(e =>
          document.addEventListener(e, onInteraction, { once: true })
        );
      });
    };

    if (audio.readyState >= 2) {
      tryPlay();
    } else {
      audio.addEventListener("canplay", tryPlay, { once: true });
    }
  }, [autoPlay, startTime]);

  // Track progress
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setCurrentTime(audio.currentTime);
    const onMeta = () => setDuration(audio.duration);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      if (startTime && audio.currentTime === 0) audio.currentTime = startTime;
      audio.play().catch(() => {});
    }
    setIsPlaying(!isPlaying);
  };

  const seekTo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const t = parseFloat(e.target.value);
    audio.currentTime = t;
    setCurrentTime(t);
  };

  const formatTime = (s: number) => {
    if (!s || isNaN(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const displayTitle = title || url.split('/').pop()?.split('?')[0] || "เพลงพื้นหลัง";
  const accentColor = themeColor || (hasCustomTheme ? textColor : undefined);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="fixed bottom-4 right-4 z-50"
    >
      <audio ref={audioRef} src={url} loop preload="auto" />

      <AnimatePresence mode="wait">
        {!expanded ? (
          /* Compact pill - fixed on screen */
          <motion.button
            key="pill"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => setExpanded(true)}
            className="flex items-center gap-2.5 rounded-full px-3 py-2 shadow-lg backdrop-blur-xl border border-white/10"
            style={{ backgroundColor: "rgba(0,0,0,0.75)" }}
          >
            {coverUrl ? (
              <img src={coverUrl} alt="cover" className="w-8 h-8 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                <Volume2 size={14} className="text-white/70" />
              </div>
            )}
            <div className="flex items-center gap-2 max-w-[140px]">
              <span className="text-[10px] font-medium text-white/60 uppercase tracking-wider">Music</span>
              <span className="text-xs font-semibold text-white truncate">{displayTitle.length > 12 ? displayTitle.slice(0, 12) + "..." : displayTitle}</span>
            </div>
          </motion.button>
        ) : (
          /* Expanded player */
          <motion.div
            key="expanded"
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            className="w-[300px] rounded-2xl shadow-2xl backdrop-blur-xl border border-white/10 overflow-hidden"
            style={{ backgroundColor: "rgba(0,0,0,0.85)" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-3 pb-2">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isPlaying ? "bg-green-400 animate-pulse" : "bg-white/30"}`} />
                <span className="text-[10px] font-semibold text-white/50 uppercase tracking-widest">Now Playing</span>
              </div>
              <button onClick={() => setExpanded(false)} className="text-white/40 hover:text-white/70 transition-colors">
                <ChevronDown size={16} />
              </button>
            </div>

            {/* Cover + Info */}
            <div className="flex items-center gap-3 px-4 pb-3">
              {coverUrl ? (
                <img src={coverUrl} alt="cover" className="w-14 h-14 rounded-xl object-cover shrink-0 shadow-md" />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                  <Volume2 size={22} className="text-white/30" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-white truncate">{displayTitle}</p>
                {artist && <p className="text-[11px] text-white/40 truncate">{artist}</p>}
              </div>
            </div>

            {/* Progress */}
            <div className="px-4 pb-1">
              <input
                type="range"
                min={0}
                max={duration || 100}
                step={0.1}
                value={currentTime}
                onChange={seekTo}
                className="w-full h-1 appearance-none rounded-full cursor-pointer"
                style={{
                  background: `linear-gradient(to right, ${accentColor || "#fff"} ${(currentTime / (duration || 1)) * 100}%, rgba(255,255,255,0.15) ${(currentTime / (duration || 1)) * 100}%)`,
                  accentColor: accentColor || "#fff",
                }}
              />
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-white/30">{formatTime(currentTime)}</span>
                <span className="text-[10px] text-white/30">{formatTime(duration)}</span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between px-4 pb-4 pt-1">
              <div className="relative">
                <button
                  onClick={() => setShowVolume(!showVolume)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white/50 hover:text-white/80 transition-colors"
                >
                  {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>
                <AnimatePresence>
                  {showVolume && (
                    <motion.div
                      initial={{ opacity: 0, x: -5 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -5 }}
                      className="absolute bottom-full left-0 mb-2 px-3 py-2 rounded-xl backdrop-blur-xl border border-white/10"
                      style={{ backgroundColor: "rgba(0,0,0,0.9)" }}
                    >
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={isMuted ? 0 : volume}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          setVolume(v);
                          if (v > 0) setIsMuted(false);
                          else setIsMuted(true);
                        }}
                        className="w-24 h-1 appearance-none rounded-full cursor-pointer"
                        style={{ accentColor: accentColor || "#fff" }}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <button
                onClick={togglePlay}
                className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
              >
                {isPlaying ? (
                  <Pause size={20} className="text-black" />
                ) : (
                  <Play size={20} className="text-black ml-0.5" />
                )}
              </button>

              <div className="w-8" /> {/* spacer */}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const LinkViewPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const { settings } = useSiteSettings();
  const [page, setPage] = useState<LinkPageData | null>(null);
  const [pageDocId, setPageDocId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const trackClick = useCallback(async (linkIndex: number, _linkTitle: string, _linkUrl: string) => {
    if (!pageDocId) return;

    try {
      await updateDoc(doc(db, "linkPages", pageDocId), {
        [`clickCounts.${linkIndex}`]: increment(1),
        totalClicks: increment(1),
      });
    } catch (err) {
      console.error("Failed to track click:", err);
    }
  }, [pageDocId]);

  useEffect(() => {
    const load = async () => {
      if (!slug) { setNotFound(true); setLoading(false); return; }
      try {
        const q = query(collection(db, "linkPages"), where("slug", "==", slug), where("published", "==", true));
        const snap = await getDocs(q);
        if (snap.empty) { setNotFound(true); }
        else {
          const docSnap = snap.docs[0];
          const data = docSnap.data() as LinkPageData;
          setPage(data); setPageDocId(docSnap.id);
        }
      } catch (err) {
        console.error("Failed to load link page:", err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [slug]);

  // Apply OG meta tags for this link page
  useEffect(() => {
    if (!page) return;
    const ogTitle = page.ogTitle || page.title;
    const ogDesc = page.ogDescription || page.description;
    const ogImage = page.ogImage || page.avatarUrl || "";

    document.title = ogTitle;

    const setMeta = (property: string, content: string) => {
      if (!content) return;
      let el = document.querySelector(`meta[property="${property}"]`) || document.querySelector(`meta[name="${property}"]`);
      if (!el) {
        el = document.createElement("meta");
        if (property.startsWith("og:")) el.setAttribute("property", property);
        else el.setAttribute("name", property);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };

    setMeta("og:title", ogTitle);
    setMeta("og:description", ogDesc);
    setMeta("og:type", "website");
    setMeta("og:url", window.location.href);
    if (ogImage) {
      setMeta("og:image", ogImage);
      setMeta("twitter:image", ogImage);
    }
    setMeta("twitter:card", "summary_large_image");
    setMeta("description", ogDesc);

    return () => {
      document.title = settings.ogTitle || settings.brandName || "Dashboard";
    };
  }, [page, settings.brandName, settings.ogTitle]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (notFound || !page) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-muted-foreground text-lg">ไม่พบหน้าลิงก์นี้</p>
        <Link to="/" className="btn-glass px-4 py-2 text-sm flex items-center gap-2">
          <ArrowLeft size={16} /> กลับหน้าหลัก
        </Link>
      </div>
    );
  }

  const activeLinks = page.links.map((l, i) => ({ ...l, originalIndex: i })).filter((l) => l.enabled);
  const hasCustomTheme = page.themeColor || page.themeBg || page.themeBgImage;
  const hasGradientTitle = page.titleGradientFrom && page.titleGradientTo;

  // Determine text color based on background brightness
  const getTextColor = () => {
    if (!page.themeBg) return undefined;
    const hex = page.themeBg.replace("#", "");
    if (hex.length !== 6) return undefined;
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 128 ? "#1f2937" : "#f9fafb";
  };

  const textColor = getTextColor();
  const subtleTextColor = textColor === "#1f2937" ? "#6b7280" : "#9ca3af";

  // Title style with gradient support
  const getTitleStyle = (): React.CSSProperties => {
    if (hasGradientTitle) {
      return {
        background: `linear-gradient(135deg, ${page.titleGradientFrom}, ${page.titleGradientTo})`,
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
      };
    }
    if (hasCustomTheme) {
      return { color: page.themeColor || textColor };
    }
    return {};
  };

  const titleClassName = `font-heading text-3xl font-extrabold mb-2 ${!hasCustomTheme && !hasGradientTitle ? "gradient-text-primary" : ""}`;

  // Glow color with proper fallback chain
  const glowColor = page.avatarGlowColor || page.avatarBorderColor || page.themeColor || "#3b82f6";

  return (
    <div
      className="relative z-10 min-h-screen"
      style={{
        backgroundColor: page.themeBg || undefined,
      }}
    >
      {/* Particle effect */}
      {page.particleMode && (
        <LinkParticles mode={page.particleMode} color={page.themeColor || textColor || "#ffffff"} />
      )}

      {/* Background image overlay */}
      {page.themeBgImage && (
        <>
          <div
            className="fixed inset-0 z-0"
            style={{
              backgroundImage: `url(${page.themeBgImage})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
            }}
          />
          <div
            className="fixed inset-0 z-0"
            style={{
              backgroundColor: page.themeBg || "#000000",
              opacity: 0.75,
            }}
          />
        </>
      )}

      <div className="relative z-10 max-w-[520px] mx-auto px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8"
        >
          {/* Avatar */}
          {page.avatarUrl && (
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
              className="mb-4 flex justify-center"
            >
              {page.avatarShape === "hexagon" ? (
                /* Hexagon: use 2-layer approach so border & glow aren't clipped */
                <div
                  className="relative"
                  style={{
                    width: 102,
                    height: 102,
                    ...(page.avatarGlow ? {
                      animation: "avatarGlow 2s ease-in-out infinite alternate",
                      filter: `drop-shadow(0 0 12px ${glowColor}80) drop-shadow(0 0 24px ${glowColor}40)`,
                    } : {
                      filter: (page.avatarBorderColor || page.themeColor)
                        ? `drop-shadow(0 0 10px ${page.avatarBorderColor || page.themeColor}50)`
                        : undefined,
                    }),
                  }}
                >
                  {/* Border layer */}
                  <div
                    className="absolute inset-0"
                    style={{
                      clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
                      backgroundColor: page.avatarBorderColor || page.themeColor || "hsl(var(--primary))",
                    }}
                  />
                  {/* Image layer */}
                  <div
                    className="absolute overflow-hidden"
                    style={{
                      clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
                      top: `${page.avatarBorderWidth ?? 3}px`,
                      left: `${page.avatarBorderWidth ?? 3}px`,
                      right: `${page.avatarBorderWidth ?? 3}px`,
                      bottom: `${page.avatarBorderWidth ?? 3}px`,
                    }}
                  >
                    <img
                      src={page.avatarUrl}
                      alt={page.title}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                </div>
              ) : (
                /* Circle / Rounded / Square */
                <div
                  className={`relative w-24 h-24 ${
                    page.avatarShape === "rounded" ? "rounded-2xl" :
                    page.avatarShape === "square" ? "rounded-none" : "rounded-full"
                  } overflow-hidden`}
                  style={{
                    borderWidth: `${page.avatarBorderWidth ?? 3}px`,
                    borderStyle: page.avatarBorderStyle || "solid",
                    borderColor: page.avatarBorderColor || page.themeColor || "hsl(var(--primary))",
                    ...(page.avatarGlow ? {
                      animation: "avatarGlow 2s ease-in-out infinite alternate",
                      boxShadow: `0 0 15px ${glowColor}60, 0 0 30px ${glowColor}30, 0 0 45px ${glowColor}15`,
                    } : {
                      boxShadow: (page.avatarBorderColor || page.themeColor)
                        ? `0 0 20px ${page.avatarBorderColor || page.themeColor}40, 0 4px 16px ${page.avatarBorderColor || page.themeColor}20`
                        : undefined,
                    }),
                  }}
                >
                  <img
                    src={page.avatarUrl}
                    alt={page.title}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
              )}
            </motion.div>
          )}

          {page.typingEffect ? (
            <TypewriterTitle
              text={page.title}
              loop={page.typingLoop}
              className={titleClassName}
              style={getTitleStyle()}
            />
          ) : (
            <h1
              className={titleClassName}
              style={getTitleStyle()}
            >
              {page.title}
            </h1>
          )}
          {page.description && (
            <p
              className={!hasCustomTheme ? "text-sm text-muted-foreground" : "text-sm"}
              style={hasCustomTheme ? { color: subtleTextColor } : undefined}
            >
              {page.description}
            </p>
          )}
          <p
            className={`text-xs mt-2 ${!hasCustomTheme ? "text-muted-foreground opacity-60" : ""}`}
            style={hasCustomTheme ? { color: subtleTextColor, opacity: 0.6 } : undefined}
          >
            by {page.ownerName || "Unknown"}
          </p>
        </motion.div>

        <div className="space-y-3">
          {activeLinks.map((link, idx) => (
            <motion.a
              key={idx}
              href={link.url}
              onClick={() => trackClick(link.originalIndex, link.title, link.url)}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.08 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`group block rounded-2xl p-4 transition-all duration-200 ${
                !hasCustomTheme ? "glass-card hover:border-primary/50" : ""
              }`}
              style={hasCustomTheme ? {
                backgroundColor: page.themeColor ? `${page.themeColor}10` : "rgba(255,255,255,0.05)",
                border: `1px solid ${page.themeColor ? `${page.themeColor}30` : "rgba(255,255,255,0.1)"}`,
              } : undefined}
              onMouseEnter={(e) => {
                if (hasCustomTheme && page.themeColor) {
                  e.currentTarget.style.backgroundColor = `${page.themeColor}20`;
                  e.currentTarget.style.borderColor = `${page.themeColor}60`;
                }
              }}
              onMouseLeave={(e) => {
                if (hasCustomTheme && page.themeColor) {
                  e.currentTarget.style.backgroundColor = `${page.themeColor}10`;
                  e.currentTarget.style.borderColor = `${page.themeColor}30`;
                }
              }}
            >
              <div className="flex items-center gap-3">
                {link.iconUrl ? (
                  <img src={link.iconUrl} alt="" className="w-6 h-6 rounded object-cover shrink-0" referrerPolicy="no-referrer" />
                ) : (
                  <span className="text-xl shrink-0">{link.icon || "🔗"}</span>
                )}
                <span
                  className={`flex-1 font-semibold text-sm transition-colors ${
                    !hasCustomTheme ? "text-foreground group-hover:text-primary" : ""
                  }`}
                  style={hasCustomTheme ? { color: textColor || "#fff" } : undefined}
                >
                  {link.title}
                </span>
                <ExternalLink
                  size={16}
                  className={`shrink-0 transition-colors ${!hasCustomTheme ? "text-muted-foreground group-hover:text-primary" : ""}`}
                  style={hasCustomTheme ? { color: page.themeColor || subtleTextColor } : undefined}
                />
              </div>
            </motion.a>
          ))}
        </div>

        {activeLinks.length === 0 && (
          <div
            className={!hasCustomTheme ? "glass-card text-center py-12" : "text-center py-12 rounded-2xl"}
            style={hasCustomTheme ? {
              backgroundColor: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
            } : undefined}
          >
            <p style={hasCustomTheme ? { color: subtleTextColor } : undefined} className={!hasCustomTheme ? "text-muted-foreground" : ""}>
              ไม่มีลิงก์ในหน้านี้
            </p>
          </div>
        )}

        {/* Audio Player - rendered via portal to stay fixed */}

        <div className="text-center mt-10">
          <p
            className={`text-xs ${!hasCustomTheme ? "text-muted-foreground opacity-50" : ""}`}
            style={hasCustomTheme ? { color: subtleTextColor, opacity: 0.5 } : undefined}
          >
            {settings.brandName || "HightX"}
          </p>
        </div>
      </div>

      {/* Music Player via Portal - fixed position like cart FAB */}
      {page.bgMusicUrl && createPortal(
        <MusicPlayer
          url={page.bgMusicUrl}
          themeColor={page.themeColor}
          textColor={textColor}
          subtleTextColor={subtleTextColor}
          hasCustomTheme={!!hasCustomTheme}
          coverUrl={page.bgMusicCoverUrl}
          title={page.bgMusicTitle}
          artist={page.bgMusicArtist}
          startTime={page.bgMusicStartTime}
          autoPlay={page.bgMusicAutoPlay !== false}
        />,
        document.body
      )}
    </div>
  );
};

export default LinkViewPage;