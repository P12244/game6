/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, FormEvent } from "react";
import { 
  Shuffle, 
  Home, 
  Volume2, 
  VolumeX, 
  Plus, 
  Trash2, 
  Search, 
  Sparkles, 
  X, 
  ChevronLeft, 
  BookOpen, 
  Moon, 
  Sun,
  RotateCw,
  Info
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { loadWords, saveCustomWords, WordItem, getDefaultWords } from "./data/words";

// Preset gradients for randomized screen backgrounds in play mode
const WORD_GRADIENTS = [
  "from-rose-500 to-pink-600",
  "from-orange-500 to-amber-600",
  "from-emerald-500 to-teal-600",
  "from-cyan-500 to-blue-600",
  "from-indigo-500 to-violet-600",
  "from-purple-500 to-fuchsia-600",
  "from-fuchsia-500 to-pink-600",
  "from-sky-500 to-indigo-600",
  "from-teal-500 to-emerald-600",
  "from-red-500 to-orange-600",
  "from-violet-600 to-purple-800",
  "from-pink-500 to-rose-700"
];

// Helper to synthesize sounds via Web Audio API
class SoundSynthesizer {
  private ctx: AudioContext | null = null;
  public isMuted: boolean = false;

  private initCtx() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  playClick() {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = "sine";
      osc.frequency.setValueAtTime(450, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(150, this.ctx.currentTime + 0.08);
      
      gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start();
      osc.stop(this.ctx.currentTime + 0.08);
    } catch (e) {
      console.warn("Audio Context error: ", e);
    }
  }

  playShuffle() {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(180, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(950, this.ctx.currentTime + 0.22);

      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.22);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.22);
    } catch (e) {
      console.warn(e);
    }
  }

  playSuccess() {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;

      // Double tone chord
      const now = this.ctx.currentTime;
      [523.25, 659.25, 783.99].forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + idx * 0.05);

        gain.gain.setValueAtTime(0.08, now + idx * 0.05);
        gain.gain.linearRampToValueAtTime(0.001, now + idx * 0.05 + 0.2);

        osc.connect(gain);
        gain.connect(this.ctx!.destination);

        osc.start(now + idx * 0.05);
        osc.stop(now + idx * 0.05 + 0.2);
      });
    } catch (e) {
      console.warn(e);
    }
  }

  playReset() {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.setValueAtTime(392.00, now + 0.1);

      gain.gain.setValueAtTime(0.1, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.25);
    } catch (e) {
      console.warn(e);
    }
  }
}

const synth = new SoundSynthesizer();

export default function App() {
  // Themes and general settings
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [muted, setMuted] = useState<boolean>(false);
  const [mirrorMode, setMirrorMode] = useState<boolean>(false); // mirror text horizontally for front cams/mirrors

  // Navigation and Screens
  // 'home' | 'play' | 'words_manager' | 'info'
  const [screen, setScreen] = useState<"home" | "play" | "words_manager" | "info">("home");

  // Word Database states
  const [allWords, setAllWords] = useState<WordItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("สุ่มทุกหมวด");

  // Active word pools for random gameplay
  const [activeWords, setActiveWords] = useState<WordItem[]>([]);
  const [playedWordsCount, setPlayedWordsCount] = useState<number>(0);
  const [totalCategoryWordsCount, setTotalCategoryWordsCount] = useState<number>(0);
  const [currentWord, setCurrentWord] = useState<WordItem | null>(null);
  const [gradientIndex, setGradientIndex] = useState<number>(0);
  const [justResetPool, setJustResetPool] = useState<boolean>(false);

  // Search and custom additions in Words Manager
  const [managerSearch, setManagerSearch] = useState<string>("");
  const [managerCategoryFilter, setManagerCategoryFilter] = useState<string>("ทั้งหมด");
  const [newWordText, setNewWordText] = useState<string>("");
  const [newWordCategory, setNewWordCategory] = useState<string>("สัตว์");
  const [newWordEmoji, setNewWordEmoji] = useState<string>("🌟");

  // Category mapping with matching emojis and distinct colors for beautiful home grid
  const categoriesMap: { name: string; emoji: string; color: string }[] = [
    { name: "สัตว์", emoji: "🦁", color: "from-rose-500/20 to-pink-500/20 text-rose-400 border-rose-500/30" },
    { name: "อาหาร", emoji: "🍕", color: "from-orange-500/20 to-amber-500/20 text-orange-400 border-orange-500/30" },
    { name: "กีฬา", emoji: "⚽", color: "from-cyan-500/20 to-blue-500/20 text-cyan-400 border-cyan-500/30" },
    { name: "ประเทศ", emoji: "🇹🇭", color: "from-blue-500/20 to-indigo-500/20 text-indigo-400 border-indigo-500/30" },
    { name: "จังหวัด", emoji: "⛰️", color: "from-green-500/20 to-emerald-500/20 text-emerald-400 border-emerald-500/30" },
    { name: "บุคคล", emoji: "👑", color: "from-purple-500/20 to-violet-500/20 text-purple-400 border-purple-500/30" },
    { name: "สิ่งของ", emoji: "🎒", color: "from-slate-500/20 to-gray-500/20 text-slate-300 border-slate-500/30" },
    { name: "เทคโนโลยี", emoji: "🤖", color: "from-sky-500/20 to-blue-500/20 text-sky-400 border-sky-500/30" },
    { name: "ภาพยนตร์", emoji: "🎬", color: "from-fuchsia-500/20 to-rose-500/20 text-fuchsia-400 border-fuchsia-500/30" },
    { name: "การ์ตูน", emoji: "🍥", color: "from-violet-500/20 to-pink-500/20 text-pink-400 border-pink-500/30" },
    { name: "เกม", emoji: "🎮", color: "from-indigo-500/20 to-purple-500/20 text-indigo-400 border-indigo-500/30" },
    { name: "ฟุตบอล", emoji: "🏆", color: "from-emerald-500/20 to-teal-500/20 text-teal-400 border-emerald-500/30" },
    { name: "อาชีพ", emoji: "🩺", color: "from-teal-500/20 to-sky-500/20 text-sky-400 border-sky-500/30" },
  ];

  // Load words from default and localStorage once
  useEffect(() => {
    const loaded = loadWords();
    setAllWords(loaded);
  }, []);

  // Set initial mute preference in sound synthesiser
  useEffect(() => {
    synth.isMuted = muted;
  }, [muted]);

  // Action: Play click sound and toggle theme
  const toggleTheme = () => {
    synth.playClick();
    setTheme(theme === "dark" ? "light" : "dark");
  };

  // Action: Play click sound and toggle mute
  const toggleMute = () => {
    const newMuted = !muted;
    setMuted(newMuted);
    synth.isMuted = newMuted;
    if (!newMuted) {
      setTimeout(() => synth.playClick(), 50);
    }
  };

  // Start game with selected category
  const startGame = (category: string) => {
    synth.playShuffle();
    setSelectedCategory(category);
    
    // Filter words matching chosen category
    let pool = allWords.filter(w => category === "สุ่มทุกหมวด" || w.category === category);
    
    // If pool is empty, fall back to default words list of that category
    if (pool.length === 0) {
      pool = getDefaultWords().filter(w => category === "สุ่มทุกหมวด" || w.category === category);
    }

    // Shuffle pool completely
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    
    if (shuffled.length > 0) {
      const firstWord = shuffled[0];
      const remaining = shuffled.slice(1);
      
      setActiveWords(remaining);
      setPlayedWordsCount(1);
      setTotalCategoryWordsCount(shuffled.length);
      setCurrentWord(firstWord);
      setGradientIndex(Math.floor(Math.random() * WORD_GRADIENTS.length));
      setJustResetPool(false);
      setScreen("play");
    }
  };

  // Randomize next word
  const nextWord = () => {
    synth.playShuffle();
    setJustResetPool(false);

    // If active pool is exhausted, reset and load the entire category pool again
    if (activeWords.length === 0) {
      let pool = allWords.filter(w => selectedCategory === "สุ่มทุกหมวด" || w.category === selectedCategory);
      if (pool.length === 0) {
        pool = getDefaultWords().filter(w => selectedCategory === "สุ่มทุกหมวด" || w.category === selectedCategory);
      }
      
      const shuffled = [...pool].sort(() => Math.random() - 0.5);
      if (shuffled.length > 0) {
        const firstWord = shuffled[0];
        const remaining = shuffled.slice(1);
        
        setActiveWords(remaining);
        setPlayedWordsCount(1);
        setTotalCategoryWordsCount(shuffled.length);
        setCurrentWord(firstWord);
        setGradientIndex(Math.floor(Math.random() * WORD_GRADIENTS.length));
        setJustResetPool(true); // show brief notification that pool started over
        synth.playReset();
      }
      return;
    }

    // Normal play: take first from remaining active list
    const nextItem = activeWords[0];
    const newRemaining = activeWords.slice(1);
    
    setActiveWords(newRemaining);
    setPlayedWordsCount(prev => prev + 1);
    setCurrentWord(nextItem);
    setGradientIndex(Math.floor(Math.random() * WORD_GRADIENTS.length));
  };

  // Back to home
  const goHome = () => {
    synth.playClick();
    setScreen("home");
    setCurrentWord(null);
    setJustResetPool(false);
  };

  // Add custom word to current state and localStorage
  const handleAddWord = (e: FormEvent) => {
    e.preventDefault();
    if (!newWordText.trim()) return;

    const newWord: WordItem = {
      word: newWordText.trim(),
      category: newWordCategory,
      emoji: newWordEmoji.trim() || "⭐",
      isCustom: true
    };

    // Prevent perfect duplicate inside the same category
    const isDuplicate = allWords.some(
      w => w.word.toLowerCase() === newWord.word.toLowerCase() && w.category === newWord.category
    );

    if (isDuplicate) {
      alert("มีคำศัพท์นี้อยู่ในหมวดหมู่นี้แล้ว!");
      return;
    }

    const updated = [newWord, ...allWords];
    setAllWords(updated);
    
    // Save only custom words to localStorage
    const onlyCustoms = updated.filter(w => w.isCustom);
    saveCustomWords(onlyCustoms);

    // Reset inputs
    setNewWordText("");
    synth.playSuccess();
  };

  // Delete custom word
  const handleDeleteWord = (wordToDelete: WordItem) => {
    synth.playClick();
    const updated = allWords.filter(
      w => !(w.word === wordToDelete.word && w.category === wordToDelete.category && w.isCustom)
    );
    setAllWords(updated);
    const onlyCustoms = updated.filter(w => w.isCustom);
    saveCustomWords(onlyCustoms);
  };

  // Filter list for word manager screen
  const filteredManagerWords = allWords.filter(w => {
    const matchesSearch = w.word.toLowerCase().includes(managerSearch.toLowerCase());
    const matchesCategory = managerCategoryFilter === "ทั้งหมด" || w.category === managerCategoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className={`min-h-screen font-sans transition-colors duration-500 flex flex-col items-center justify-center p-0 md:p-6 select-none relative overflow-hidden ${
      theme === "dark" 
        ? "bg-[#0c0c14] text-white" 
        : "bg-slate-50 text-slate-900"
    }`}>
      
      {/* Background Ambience (Glows behind mockup on desktop as requested in theme) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className={`absolute top-[-100px] left-[-100px] w-[500px] h-[500px] rounded-full blur-[120px] transition-all duration-1000 ${
          theme === "dark" ? "bg-purple-600/15" : "bg-purple-500/10"
        }`} />
        <div className={`absolute bottom-[-50px] right-[-50px] w-[400px] h-[400px] rounded-full blur-[100px] transition-all duration-1000 ${
          theme === "dark" ? "bg-blue-600/15" : "bg-blue-500/10"
        }`} />
      </div>

      {/* Main Core Container: Styled as a premium desktop frame that scales on mobile */}
      <main id="app-container" className={`relative w-full max-w-md h-screen md:h-[840px] md:rounded-[40px] overflow-hidden shadow-2xl transition-all duration-500 z-10 flex flex-col ${
        theme === "dark"
          ? "bg-[#0c0c14]/90 border border-white/10 shadow-purple-950/20"
          : "bg-white/95 border border-slate-200 shadow-slate-200"
      } backdrop-blur-md`}>
        
        {/* Decorative Camera Notch for smartphone realism on desktop */}
        <div className="hidden md:flex absolute top-0 left-1/2 transform -translate-x-1/2 w-40 h-6 bg-slate-950 rounded-b-2xl z-50 items-center justify-center">
          <div className="w-3 h-3 bg-slate-800 rounded-full" />
          <div className="w-12 h-1 bg-slate-800 rounded-full ml-4" />
        </div>

        {/* Dynamic Nav Header */}
        <header className="px-5 pt-6 pb-4 flex items-center justify-between border-b shrink-0 z-20 transition-colors duration-500 border-slate-800/10 dark:border-white/5">
          <div className="flex items-center gap-2.5" id="game-logo-header">
            {/* Geometric balance logo with rotated pink/orange container */}
            <div className="w-9 h-9 bg-gradient-to-br from-pink-500 to-orange-400 rounded-xl rotate-12 flex items-center justify-center shadow-lg shadow-pink-500/20 shrink-0">
              <span className="text-xl rotate-[-12deg] select-none">🤫</span>
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-800 dark:text-white leading-none">คำต้องห้าม</h1>
              <p className="text-[9px] uppercase tracking-[0.2em] text-slate-400 dark:text-white/40 mt-1">Pro Edition • v2.4</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-1 rounded-2xl">
            {/* Mirror / Flip mode toggle (extremely useful when putting phone on forehead) */}
            {screen === "play" && (
              <button
                id="mirror-toggle-btn"
                onClick={() => { synth.playClick(); setMirrorMode(!mirrorMode); }}
                className={`p-2 rounded-xl transition-all duration-300 ${
                  mirrorMode 
                    ? "bg-amber-500/20 text-amber-500 dark:text-amber-400" 
                    : "hover:bg-slate-200 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400"
                }`}
                title="กลับด้านตัวอักษรสำหรับหน้าผาก"
              >
                <RotateCw className={`w-3.5 h-3.5 transition-transform duration-500 ${mirrorMode ? "rotate-180" : ""}`} />
              </button>
            )}

            {/* Info / Rules Screen button */}
            {screen === "home" && (
              <button
                id="rules-btn"
                onClick={() => { synth.playClick(); setScreen("info"); }}
                className="p-2 rounded-xl hover:bg-slate-200 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300 transition-all"
                title="วิธีเล่นเกม"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Manage custom words list button */}
            {screen === "home" && (
              <button
                id="manage-words-btn"
                onClick={() => { synth.playClick(); setScreen("words_manager"); }}
                className="p-2 rounded-xl hover:bg-slate-200 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300 transition-all flex items-center gap-1 text-xs font-semibold"
              >
                <BookOpen className="w-3.5 h-3.5 text-emerald-500" />
                <span className="hidden sm:inline">คลังคำ</span>
              </button>
            )}

            {/* Sound Toggle Button */}
            <button
              id="sound-toggle-btn"
              onClick={toggleMute}
              className="p-2 rounded-xl hover:bg-slate-200 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300 transition-all"
            >
              {muted ? <VolumeX className="w-3.5 h-3.5 text-rose-500" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-500" />}
            </button>

            {/* Theme Toggle Button */}
            <button
              id="theme-toggle-btn"
              onClick={toggleTheme}
              className="p-2 rounded-xl hover:bg-slate-200 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300 transition-all"
            >
              {theme === "dark" ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-indigo-500" />}
            </button>
          </div>
        </header>

        {/* Content Screens Container with AnimatePresence */}
        <div className="flex-1 overflow-y-auto relative p-5 flex flex-col justify-start z-10">
          <AnimatePresence mode="wait">
            
            {/* SCREEN 1: HOME */}
            {screen === "home" && (
              <motion.div
                key="home"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3 }}
                className="flex-1 flex flex-col justify-between gap-6"
                id="home-screen-content"
              >
                {/* Brand & Hero Logo */}
                <div className="text-center mt-3 mb-1 flex flex-col items-center">
                  <motion.div
                    initial={{ scale: 0.85 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 100 }}
                    className="relative w-20 h-20 rounded-[24px] bg-gradient-to-br from-pink-500 to-orange-400 flex items-center justify-center shadow-lg shadow-pink-500/20 mb-4 animate-float"
                  >
                    <span className="text-3xl select-none">🤫</span>
                    <div className="absolute -bottom-1 -right-1 bg-[#0c0c14] border-2 border-pink-500 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black tracking-tight text-pink-400 shadow-md">
                      PRO
                    </div>
                  </motion.div>
                  <h1 className="text-2xl font-black tracking-tight bg-gradient-to-r from-pink-500 via-orange-400 to-pink-600 bg-clip-text text-transparent">
                    คำต้องห้าม
                  </h1>
                  <p className={`text-xs mt-1.5 px-4 transition-colors leading-relaxed ${
                    theme === "dark" ? "text-slate-400" : "text-slate-500"
                  }`}>
                    เครื่องมือสุ่มคำศัพท์สำหรับเล่นบอร์ดเกมสุดฮา <br />
                    มีคำศัพท์ให้เล่นอย่างจุใจมากกว่า <span className="font-bold text-pink-500">2,000</span> คำ!
                  </p>
                </div>

                {/* Main Category Select Grid */}
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between px-1">
                    <span className={`text-[10px] font-bold tracking-[0.15em] uppercase ${
                      theme === "dark" ? "text-white/40" : "text-slate-500"
                    }`}>
                      เลือกหมวดหมู่คำศัพท์
                    </span>
                    <span className="text-[11px] text-pink-500 font-bold">
                      ทั้งหมด {allWords.length} คำ
                    </span>
                  </div>

                  {/* Highlight Super Random Option with Geometric Balance card design */}
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    id="cat-all-btn"
                    onClick={() => startGame("สุ่มทุกหมวด")}
                    className={`w-full p-4 rounded-[28px] flex items-center justify-between transition-all font-bold shadow-[0_15px_30px_rgba(236,72,153,0.15)] border ${
                      theme === "dark"
                        ? "bg-gradient-to-br from-orange-400/20 to-pink-600/20 text-pink-400 border-pink-500/30 hover:border-pink-500/50"
                        : "bg-gradient-to-br from-orange-50 to-pink-50 text-slate-800 border-pink-200 hover:border-pink-300"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-pink-600 flex items-center justify-center text-white text-xl shadow-lg rotate-6">
                        🔀
                      </div>
                      <div className="text-left">
                        <div className="text-sm font-black tracking-tight">สุ่มทุกหมวดหมู่ (All)</div>
                        <div className="text-[10px] opacity-80 font-normal mt-0.5">ผสมผสานคำศัพท์ทั้งหมดสุ่มไร้ขีดจำกัด</div>
                      </div>
                    </div>
                    <span className="text-lg font-bold text-pink-500">➔</span>
                  </motion.button>

                  {/* Regular Categories Grid */}
                  <div className="grid grid-cols-2 gap-2.5 max-h-[260px] md:max-h-[300px] overflow-y-auto pr-1">
                    {categoriesMap.map((cat) => {
                      const count = allWords.filter(w => w.category === cat.name).length;
                      return (
                        <motion.button
                          key={cat.name}
                          whileTap={{ scale: 0.96 }}
                          id={`cat-${cat.name}-btn`}
                          onClick={() => startGame(cat.name)}
                          className={`p-3 rounded-[20px] border flex flex-col items-start gap-1 text-left transition-all relative overflow-hidden group ${
                            theme === "dark"
                              ? "bg-white/5 hover:bg-white/10 border-white/10 text-white"
                              : "bg-slate-100 hover:bg-slate-200/80 border-slate-200 text-slate-800"
                          }`}
                        >
                          {/* Floating backdrop for nice visual depth */}
                          <div className="absolute -right-1 -bottom-2 opacity-10 group-hover:opacity-20 group-hover:scale-110 transition-all duration-300">
                            <span className="text-4xl select-none">{cat.emoji}</span>
                          </div>

                          <div className="flex items-center justify-between w-full z-10">
                            <span className="text-xl select-none">{cat.emoji}</span>
                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${
                              theme === "dark" ? "bg-white/10 text-white/80" : "bg-slate-800/10 text-slate-600"
                            }`}>
                              {count} คำ
                            </span>
                          </div>
                          <span className="font-bold text-xs tracking-tight mt-1 z-10">{cat.name}</span>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                {/* Quick Guide / Setup Footer */}
                <div className={`p-4 rounded-[24px] border flex items-start gap-3 transition-colors ${
                  theme === "dark" 
                    ? "bg-white/5 border-white/10 text-slate-300" 
                    : "bg-slate-100 border-slate-200 text-slate-600"
                }`}>
                  <span className="text-lg select-none">💡</span>
                  <p className="text-[10px] leading-relaxed text-left">
                    เลือกหมวดหมู่ที่ต้องการ แล้วกดปุ่ม ➔ ถือโทรศัพท์หันหน้าจอออกให้เพื่อนๆ ดู แล้วเริ่มพูดคุยหลอกล่อเพื่อไม่ให้ตัวคุณเผลอพูดคำบนหน้าจอ!
                  </p>
                </div>
              </motion.div>
            )}

            {/* SCREEN 2: GAMEPLAY (WORD SCREEN) */}
            {screen === "play" && currentWord && (
              <motion.div
                key="play"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ type: "spring", damping: 20 }}
                className="absolute inset-0 z-10 flex flex-col justify-between p-5 overflow-hidden"
                id="play-screen-content"
              >
                {/* Category Header Indicator */}
                <div className="flex items-center justify-between z-10 text-white">
                  <div className="flex items-center gap-2 bg-white/5 backdrop-blur-md py-1.5 px-3.5 rounded-full border border-white/10">
                    <span className="text-xs font-bold tracking-wide">✨ {currentWord.category}</span>
                  </div>
                  <div className="flex items-center gap-1 bg-white/5 backdrop-blur-md py-1.5 px-3.5 rounded-full border border-white/10 font-mono text-[10px] text-white/80">
                    <span>{playedWordsCount} / {totalCategoryWordsCount}</span>
                  </div>
                </div>

                {/* MAIN WORD CARD (Geometric Balance gradient card) */}
                <div className="flex-1 flex flex-col items-center justify-center text-center z-10 py-4 my-2">
                  <div className={`w-full aspect-[4/3.5] bg-gradient-to-br ${WORD_GRADIENTS[gradientIndex]} rounded-[48px] shadow-[0_30px_70px_-15px_rgba(236,72,153,0.35)] flex flex-col items-center justify-center p-8 border border-white/20 relative group`}>
                    <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 rounded-[48px] transition-opacity duration-500" />
                    
                    {/* Decorative dots in the corner as in template */}
                    <div className="absolute top-6 right-6 flex gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-white/30" />
                      <div className="w-2 h-2 rounded-full bg-white/30" />
                    </div>

                    {/* Word Display Holder */}
                    <motion.div
                      key={currentWord.word}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.85 }}
                      transition={{ type: "spring", stiffness: 120, damping: 14 }}
                      className={`flex flex-col items-center justify-center gap-4 w-full ${
                        mirrorMode ? "flipped-h" : ""
                      }`}
                    >
                      {/* Giant Emoji */}
                      <div className="text-7xl md:text-8xl filter drop-shadow-2xl transform hover:scale-115 transition-transform cursor-pointer select-none">
                        {currentWord.emoji || "✨"}
                      </div>

                      {/* Word text */}
                      <div className="text-center">
                        <h2 className="text-3xl md:text-4xl font-black tracking-tight text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.35)] select-text px-2 break-words leading-tight max-w-[280px]">
                          {currentWord.word}
                        </h2>
                        {/* Elegant Geometric line divider */}
                        <div className="h-1 w-16 bg-white/40 rounded-full mx-auto mt-3.5" />
                      </div>
                    </motion.div>
                  </div>
                </div>

                {/* Pool Reset Toast Indicator */}
                <AnimatePresence>
                  {justResetPool && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="absolute bottom-28 left-1/2 transform -translate-x-1/2 bg-black/80 backdrop-blur-md text-amber-300 px-4 py-2 rounded-full text-[10px] font-bold shadow-lg text-center z-30 border border-amber-500/30 flex items-center gap-2"
                    >
                      <span>🔄 ครบทุกคำแล้ว! เริ่มสุ่มใหม่อีกรอบ</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Primary Game Actions Footer Buttons styled in Geometric Balance style */}
                <div className="grid grid-cols-2 gap-3.5 z-10 pt-4 border-t border-white/10 shrink-0">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    id="back-to-home-btn"
                    onClick={goHome}
                    className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 py-4 px-3 rounded-[24px] text-white font-bold transition-all shadow-md"
                  >
                    <Home className="w-4 h-4 text-white/80" />
                    <span className="text-xs">กลับหน้าแรก</span>
                  </motion.button>

                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    id="random-next-btn"
                    onClick={nextWord}
                    className="flex-1 flex items-center justify-center gap-2 bg-white text-slate-950 hover:bg-slate-100 py-4 px-3 rounded-[24px] text-xs font-black uppercase tracking-wide shadow-2xl transition-all active:scale-95"
                  >
                    <Shuffle className="w-4 h-4 text-pink-600" />
                    <span>สุ่มคำใหม่</span>
                  </motion.button>

                  {/* POOL STATUS dynamic tracker matching the aesthetic bottom elements */}
                  <div className="col-span-2 mt-2 flex items-center justify-center gap-2 bg-white/5 border border-white/10 py-3 px-4 rounded-[24px]">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="font-mono text-[9px] text-white/60 tracking-widest">AUTO-MOD ACTIVE • {playedWordsCount}/{totalCategoryWordsCount} WORDS</span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* SCREEN 3: WORDS MANAGER & CUSTOM ADDITIONS */}
            {screen === "words_manager" && (
              <motion.div
                key="words_manager"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="flex-1 flex flex-col h-full gap-4"
                id="words-manager-screen"
              >
                {/* Manager Header & Return */}
                <div className="flex items-center gap-2.5 border-b border-slate-800/10 dark:border-white/5 pb-3">
                  <button
                    id="back-from-manager-btn"
                    onClick={() => { synth.playClick(); setScreen("home"); }}
                    className={`p-2 rounded-xl border transition-colors ${
                      theme === "dark" 
                        ? "bg-white/5 hover:bg-white/10 text-white border-white/10" 
                        : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"
                    }`}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div>
                    <h2 className="font-bold text-sm tracking-tight flex items-center gap-1.5 text-emerald-500">
                      <BookOpen className="w-4 h-4" />
                      คลังคำศัพท์และคำที่กำหนดเอง
                    </h2>
                    <p className={`text-[9px] ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>
                      จัดการคำศัพท์และเพิ่มคำศัพท์ของคุณเองลงในเกมได้อย่างอิสระ
                    </p>
                  </div>
                </div>

                {/* Add Custom Word Form Box */}
                <form 
                  id="add-custom-word-form"
                  onSubmit={handleAddWord} 
                  className={`p-4 rounded-[24px] border transition-all ${
                    theme === "dark" 
                      ? "bg-white/5 border-white/10" 
                      : "bg-slate-100 border-slate-200"
                  }`}
                >
                  <div className="text-[11px] font-bold mb-3 text-pink-500 flex items-center gap-1">
                    <Plus className="w-3.5 h-3.5" />
                    เพิ่มคำศัพท์ใหม่ของคุณเอง
                  </div>

                  <div className="space-y-2.5">
                    {/* Word text and Emoji Inputs */}
                    <div className="grid grid-cols-4 gap-2">
                      <div className="col-span-3">
                        <input
                          id="new-word-input"
                          type="text"
                          required
                          placeholder="พิมพ์คำศัพท์..."
                          value={newWordText}
                          onChange={(e) => setNewWordText(e.target.value)}
                          className={`w-full px-3.5 py-2.5 rounded-[16px] text-xs outline-none transition-all border ${
                            theme === "dark" 
                              ? "bg-black/30 border-white/10 text-white focus:border-pink-500/50" 
                              : "bg-white border-slate-300 text-slate-900 focus:border-pink-500/50"
                          }`}
                        />
                      </div>
                      <div>
                        <input
                          id="new-word-emoji-input"
                          type="text"
                          placeholder="อิโมจิ"
                          value={newWordEmoji}
                          onChange={(e) => setNewWordEmoji(e.target.value)}
                          maxLength={3}
                          className={`w-full px-1.5 py-2.5 rounded-[16px] text-center text-xs outline-none transition-all border ${
                            theme === "dark" 
                              ? "bg-black/30 border-white/10 text-white focus:border-pink-500/50" 
                              : "bg-white border-slate-300 text-slate-900 focus:border-pink-500/50"
                          }`}
                        />
                      </div>
                    </div>

                    {/* Category Selector for custom word */}
                    <div className="grid grid-cols-4 gap-2 items-center">
                      <div className="col-span-3">
                        <select
                          id="new-word-category-select"
                          value={newWordCategory}
                          onChange={(e) => setNewWordCategory(e.target.value)}
                          className={`w-full px-3 py-2.5 rounded-[16px] text-xs outline-none transition-all border ${
                            theme === "dark" 
                              ? "bg-black/30 border-white/10 text-slate-300 focus:border-pink-500/50" 
                              : "bg-white border-slate-300 text-slate-700 focus:border-pink-500/50"
                          }`}
                        >
                          {categoriesMap.map(c => (
                            <option key={c.name} value={c.name}>{c.emoji} {c.name}</option>
                          ))}
                        </select>
                      </div>
                      <button
                        id="submit-word-btn"
                        type="submit"
                        className="py-2.5 rounded-[16px] bg-gradient-to-br from-pink-500 to-orange-400 hover:opacity-90 text-white text-xs font-bold transition-all shadow-md flex items-center justify-center"
                      >
                        เพิ่มคำ
                      </button>
                    </div>
                  </div>
                </form>

                {/* Word Search and List Filter Controls */}
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      id="word-search-input"
                      type="text"
                      placeholder="ค้นหาคำศัพท์ที่มีอยู่..."
                      value={managerSearch}
                      onChange={(e) => setManagerSearch(e.target.value)}
                      className={`w-full pl-10 pr-3.5 py-2.5 rounded-[16px] text-xs outline-none transition-all border ${
                        theme === "dark" 
                          ? "bg-black/20 border-white/10 text-white focus:border-emerald-500/50" 
                          : "bg-slate-100 border-slate-200 text-slate-900 focus:border-emerald-500/50"
                      }`}
                    />
                  </div>

                  {/* Filter Categories Horizontal Carousel */}
                  <div className="flex gap-1.5 overflow-x-auto py-1 pr-1" id="manager-cat-carousel">
                    <button
                      id="filter-all-btn"
                      onClick={() => { synth.playClick(); setManagerCategoryFilter("ทั้งหมด"); }}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap shrink-0 border ${
                        managerCategoryFilter === "ทั้งหมด"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                          : "bg-slate-800/10 dark:bg-white/5 border-transparent text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      ทั้งหมด
                    </button>
                    {categoriesMap.map(c => (
                      <button
                        key={c.name}
                        id={`filter-${c.name}-btn`}
                        onClick={() => { synth.playClick(); setManagerCategoryFilter(c.name); }}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap shrink-0 border flex items-center gap-1 ${
                          managerCategoryFilter === c.name
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                            : "bg-slate-800/10 dark:bg-white/5 border-transparent text-slate-500 dark:text-slate-400"
                        }`}
                      >
                        <span className="select-none">{c.emoji}</span>
                        <span>{c.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Words Interactive Grid View */}
                <div className={`flex-1 min-h-[150px] border rounded-[24px] overflow-hidden flex flex-col ${
                  theme === "dark" ? "bg-black/20 border-white/10" : "bg-slate-50 border-slate-200"
                }`}>
                  <div className={`px-4 py-2.5 border-b text-[9px] font-bold flex justify-between items-center ${
                    theme === "dark" ? "bg-white/5 border-white/5 text-slate-400" : "bg-slate-100 border-slate-200 text-slate-500"
                  }`}>
                    <span>ผลลัพธ์คำศัพท์ ({filteredManagerWords.length} คำ)</span>
                    <span className="hidden sm:inline">คำที่คุณเพิ่มเองจะลบได้</span>
                  </div>

                  <div className="flex-1 overflow-y-auto p-2 space-y-1 max-h-[180px] md:max-h-[240px]">
                    {filteredManagerWords.length === 0 ? (
                      <div className="text-center py-10 text-xs text-slate-500">
                        ไม่พบคำศัพท์ที่ตรงกับการค้นหาของคุณ 🔍
                      </div>
                    ) : (
                      filteredManagerWords.map((item, idx) => (
                        <div
                          key={`${item.word}-${item.category}-${idx}`}
                          className={`flex items-center justify-between p-2 rounded-[14px] text-xs transition-colors ${
                            theme === "dark" 
                              ? "hover:bg-white/5 border border-transparent" 
                              : "hover:bg-slate-200/50 border border-transparent"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-base select-none">{item.emoji}</span>
                            <span className="font-semibold text-slate-800 dark:text-white">{item.word}</span>
                            <span className={`text-[8px] px-1.5 py-0.5 rounded-md font-bold ${
                              theme === "dark" ? "bg-white/5 text-slate-400" : "bg-slate-200 text-slate-600"
                            }`}>
                              {item.category}
                            </span>
                            {item.isCustom && (
                              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[8px] font-bold px-1.5 py-0.2 rounded-md">
                                คุณเพิ่มเอง
                              </span>
                            )}
                          </div>

                          {item.isCustom && (
                            <button
                              type="button"
                              onClick={() => handleDeleteWord(item)}
                              className="text-rose-500 hover:bg-rose-500/10 p-1.5 rounded-lg transition-colors"
                              title="ลบคำศัพท์"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Return button styled to match the theme */}
                <button
                  id="manager-close-btn"
                  onClick={() => { synth.playClick(); setScreen("home"); }}
                  className="w-full py-3.5 rounded-[24px] bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 font-bold border border-emerald-500/20 text-xs tracking-wide transition-all text-center flex items-center justify-center gap-1.5 mt-auto"
                >
                  <X className="w-4 h-4" />
                  <span>บันทึกการตั้งค่าและเสร็จสิ้น</span>
                </button>
              </motion.div>
            )}

            {/* SCREEN 4: INFO & RULES */}
            {screen === "info" && (
              <motion.div
                key="info"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="flex-1 flex flex-col h-full gap-4 text-xs"
                id="info-screen"
              >
                {/* Info Header */}
                <div className="flex items-center gap-2.5 border-b border-slate-800/10 dark:border-white/5 pb-3">
                  <button
                    id="back-from-info-btn"
                    onClick={() => { synth.playClick(); setScreen("home"); }}
                    className={`p-2 rounded-xl border transition-colors ${
                      theme === "dark" 
                        ? "bg-white/5 hover:bg-white/10 text-white border-white/10" 
                        : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"
                    }`}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div>
                    <h2 className="font-bold text-sm tracking-tight text-pink-500 flex items-center gap-1.5">
                      📖 กติกาและวิธีการเล่น
                    </h2>
                    <p className={`text-[9px] ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>
                      กติกาสากลของบอร์ดเกม "คำต้องห้าม"
                    </p>
                  </div>
                </div>

                {/* Game Play Explanation Cards */}
                <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[380px] md:max-h-[460px]">
                  
                  <div className={`p-4 rounded-[24px] border ${
                    theme === "dark" ? "bg-white/5 border-white/10 text-slate-300" : "bg-slate-100 border-slate-200 text-slate-700"
                  }`}>
                    <div className="font-bold text-xs text-amber-500 mb-1 flex items-center gap-1.5">
                      <span>👥</span>
                      จำนวนผู้เล่นและอุปกรณ์
                    </div>
                    <p className="leading-relaxed text-[10px]">
                      เกมนี้เล่นด้วยผู้เล่นประมาณ <span className="font-bold text-pink-500">4–6 คน</span> โดยทุกคนใช้โทรศัพท์ของตนเองเปิดเว็บนี้ในหมวดหมู่เดียวกันหรือสุ่มทุกหมวด
                    </p>
                  </div>

                  <div className={`p-4 rounded-[24px] border ${
                    theme === "dark" ? "bg-white/5 border-white/10 text-slate-300" : "bg-slate-100 border-slate-200 text-slate-700"
                  }`}>
                    <div className="font-bold text-xs text-sky-500 mb-1 flex items-center gap-1.5">
                      <span>📱</span>
                      ขั้นตอนการเล่น
                    </div>
                    <ol className="list-decimal pl-4 space-y-1.5 mt-2 text-[10px] leading-relaxed">
                      <li>ทุกคนเลือกหมวดหมู่ที่ต้องการ แล้วกดปุ่ม <b>"สุ่มคำ"</b></li>
                      <li>
                        <b>ห้ามคุณแอบมองหน้าจอโทรศัพท์ของตัวเองโดยเด็ดขาด!</b> ให้นำโทรศัพท์วางไว้บนหน้าผากหรือเสียบกับสายคาดหัว หันหน้าจอออกด้านนอก เพื่อให้เพื่อนๆ คนอื่นมองเห็นคำของคุณได้อย่างชัดเจน
                      </li>
                      <li>
                        จากนั้นทุกคนเริ่มคุยเล่น หลอกถามคำถาม หรือหลอกล่อ เพื่อให้คุณเผลอหลุดปากพูดคำที่เป็น "คำต้องห้าม" บนหัวของตัวคุณเองออกมา
                      </li>
                    </ol>
                  </div>

                  <div className={`p-4 rounded-[24px] border ${
                    theme === "dark" ? "bg-white/5 border-white/10 text-slate-300" : "bg-slate-100 border-slate-200 text-slate-700"
                  }`}>
                    <div className="font-bold text-xs text-pink-500 mb-1 flex items-center gap-1.5">
                      <span>⚔️</span>
                      การตัดสินแพ้ชนะ
                    </div>
                    <ul className="list-disc pl-4 space-y-1.5 mt-2 text-[10px] leading-relaxed">
                      <li>
                        หากคุณเผลอพูดคำนั้นขึ้นมา แล้วเพื่อนจับได้และท้วงทันที ถือว่าคุณแพ้ในรอบนั้นทันที!
                      </li>
                      <li>
                        หากหมดเวลาแล้วหรือตกลงหยุดเล่น และยังไม่มีใครหลุดพูดคำต้องห้าม ให้ทุกคนผลัดกันเดาว่าคำบนหัวของตนเองคือคำว่าอะไร ถ้าเดาถูกสามารถรับคะแนนพิเศษได้!
                      </li>
                    </ul>
                  </div>

                </div>

                {/* Return Button */}
                <button
                  id="info-close-btn"
                  onClick={() => { synth.playClick(); setScreen("home"); }}
                  className="w-full py-3.5 rounded-[24px] bg-pink-500/10 text-pink-400 hover:bg-pink-500/20 font-bold border border-pink-500/20 text-xs tracking-wide transition-all text-center flex items-center justify-center gap-1.5 mt-auto"
                >
                  <X className="w-4 h-4" />
                  <span>เข้าใจกติกาแล้ว เริ่มเกมกันเลย</span>
                </button>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* Small aesthetic footer to emulate mobile app look & watermark */}
        <footer className={`py-3 text-center border-t select-none transition-colors duration-500 text-[10px] shrink-0 z-20 ${
          theme === "dark" 
            ? "bg-[#0c0c14] border-white/5 text-slate-500" 
            : "bg-slate-100/80 border-slate-200 text-slate-400"
        }`}>
          <div className="flex items-center justify-center gap-1.5 font-display font-medium">
            <span>คำต้องห้าม Pro v2.4</span>
            <span>•</span>
            <span>Geometric Balance</span>
          </div>
        </footer>

      </main>
    </div>
  );
}
