import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, Volume2, VolumeX, ChevronDown, Music } from "lucide-react";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { useLocation } from "react-router-dom";

const GlobalMusicPlayer = () => {
  const { settings } = useSiteSettings();
  const location = useLocation();
  const isLinkViewPage = location.pathname.startsWith("/l/");
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const initializedVolume = useRef(false);
  const [isMuted, setIsMuted] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showVolume, setShowVolume] = useState(false);
  const hasAutoPlayed = useRef(false);

  const bgMusic = settings.bgMusic;
  const url = bgMusic?.url || "";
  const coverUrl = bgMusic?.coverUrl;
  const title = bgMusic?.title || "เพลงพื้นหลัง";
  const artist = bgMusic?.artist;
  const startTime = bgMusic?.startTime || 0;
  const autoPlay = bgMusic?.autoPlay !== false;
  const defaultVolume = typeof bgMusic?.defaultVolume === "number" ? Math.max(0, Math.min(1, bgMusic.defaultVolume)) : 0.5;
  const enabled = bgMusic?.enabled && !!url;

  useEffect(() => {
    if (initializedVolume.current) return;
    if (bgMusic && typeof bgMusic.defaultVolume === "number") {
      setVolume(Math.max(0, Math.min(1, bgMusic.defaultVolume)));
      initializedVolume.current = true;
    }
  }, [bgMusic, defaultVolume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);

  useEffect(() => {
    if (!enabled || !autoPlay || hasAutoPlayed.current) return;
    const audio = audioRef.current;
    if (!audio) return;

    const tryPlay = () => {
      if (startTime) audio.currentTime = startTime;
      audio.play().then(() => {
        setIsPlaying(true);
        hasAutoPlayed.current = true;
      }).catch(() => {
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

    if (audio.readyState >= 2) tryPlay();
    else audio.addEventListener("canplay", tryPlay, { once: true });
  }, [enabled, autoPlay, startTime]);

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

  if (!enabled || isLinkViewPage) return null;

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

  return createPortal(
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="fixed bottom-4 left-4 z-[9998]"
    >
      <audio ref={audioRef} src={url} loop preload="auto" />

      <AnimatePresence mode="wait">
        {!expanded ? (
          <motion.button
            key="pill"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => setExpanded(true)}
            className="flex items-center gap-2 rounded-full px-3 py-2 shadow-lg backdrop-blur-xl border border-border/30 bg-background/80"
          >
            {coverUrl ? (
              <img src={coverUrl} alt="cover" className="w-8 h-8 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Music size={14} className="text-primary" />
              </div>
            )}
            <div className="flex items-center gap-2 max-w-[120px]">
              <span className="text-xs font-semibold text-foreground truncate">{title.length > 12 ? title.slice(0, 12) + "..." : title}</span>
            </div>
            {isPlaying && (
              <div className="flex items-center gap-0.5">
                {[1, 2, 3].map(i => (
                  <motion.div
                    key={i}
                    className="w-0.5 bg-primary rounded-full"
                    animate={{ height: [4, 12, 4] }}
                    transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15 }}
                  />
                ))}
              </div>
            )}
          </motion.button>
        ) : (
          <motion.div
            key="expanded"
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            className="w-[280px] sm:w-[300px] rounded-2xl shadow-2xl backdrop-blur-xl border border-border/30 bg-background/95 overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 pt-3 pb-2">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isPlaying ? "bg-green-400 animate-pulse" : "bg-muted-foreground/30"}`} />
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Now Playing</span>
              </div>
              <button onClick={() => setExpanded(false)} className="text-muted-foreground/40 hover:text-foreground transition-colors">
                <ChevronDown size={16} />
              </button>
            </div>

            <div className="flex items-center gap-3 px-4 pb-3">
              {coverUrl ? (
                <img src={coverUrl} alt="cover" className="w-14 h-14 rounded-xl object-cover shrink-0 shadow-md" />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-primary/5 border border-border/30 flex items-center justify-center shrink-0">
                  <Music size={22} className="text-primary/30" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-foreground truncate">{title}</p>
                {artist && <p className="text-[11px] text-muted-foreground truncate">{artist}</p>}
              </div>
            </div>

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
                  background: `linear-gradient(to right, hsl(var(--primary)) ${(currentTime / (duration || 1)) * 100}%, hsl(var(--muted)) ${(currentTime / (duration || 1)) * 100}%)`,
                }}
              />
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-muted-foreground/50">{formatTime(currentTime)}</span>
                <span className="text-[10px] text-muted-foreground/50">{formatTime(duration)}</span>
              </div>
            </div>

            <div className="flex items-center justify-between px-4 pb-4 pt-1">
              <div className="relative">
                <button
                  onClick={() => setShowVolume(!showVolume)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                >
                  {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>
                <AnimatePresence>
                  {showVolume && (
                    <motion.div
                      initial={{ opacity: 0, x: -5 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -5 }}
                      className="absolute bottom-full left-0 mb-2 px-3 py-2 rounded-xl backdrop-blur-xl border border-border/30 bg-background/95"
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
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <button
                onClick={togglePlay}
                className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
              >
                {isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
              </button>

              <button
                onClick={() => { setIsMuted(!isMuted); }}
                className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              >
                {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>,
    document.body
  );
};

export default GlobalMusicPlayer;
