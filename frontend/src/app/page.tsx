"use client";

import { useState, useEffect } from "react";
import { Film, Download, Loader2, Image as ImageIcon, Video, AlertCircle, Settings, Check, RefreshCw, List, FileSpreadsheet, Search, Copy, ExternalLink } from "lucide-react";

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  // Tab control
  const [activeTab, setActiveTab] = useState<"extract" | "subtitles" | "channel">("extract");
  
  // Subtitle tool states
  const [imagesZip, setImagesZip] = useState<File | null>(null);
  const [subtitlesTxt, setSubtitlesTxt] = useState<File | null>(null);
  const [subtitleStyle, setSubtitleStyle] = useState<"outline" | "bg_box">("outline");
  const [fontSize, setFontSize] = useState("");
  const [fontScale, setFontScale] = useState(0.045);
  const [margin, setMargin] = useState(0.08);
  const [isBold, setIsBold] = useState(false);
  const [textColor, setTextColor] = useState("#FFFFFF");

  // Backend URL settings states
  const backendUrl = "http://localhost:10000";
  const [backendConnected, setBackendConnected] = useState<boolean | null>(null);
  const [cropType, setCropType] = useState("none");

  // Channel scraper states
  const [channelUrl, setChannelUrl] = useState("");
  const [maxVideos, setMaxVideos] = useState(100);
  const [extractedChannelName, setExtractedChannelName] = useState("");
  const [extractedVideos, setExtractedVideos] = useState<{ id: string; title: string; url: string }[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Periodically check if local backend is running
  useEffect(() => {
    const checkConnection = async () => {
      await testConnection(backendUrl);
    };
    checkConnection();
    const interval = setInterval(checkConnection, 3000); // Check every 3 seconds
    return () => clearInterval(interval);
  }, []);

  const handleSubtitlesSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imagesZip) {
      setError("Please select a ZIP file containing images.");
      return;
    }
    if (!subtitlesTxt) {
      setError("Please select a TXT file containing subtitles.");
      return;
    }
    
    setError("");
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("images_zip", imagesZip);
      formData.append("subtitles_txt", subtitlesTxt);
      formData.append("style", subtitleStyle);
      formData.append("font_size", fontSize);
      formData.append("font_scale", fontScale.toString());
      formData.append("margin", margin.toString());
      formData.append("is_bold", isBold.toString());
      formData.append("text_color", textColor);

      const response = await fetch(`${backendUrl}/api/subtitles`, {
        method: "POST",
        headers: {
          "Bypass-Tunnel-Reminder": "true"
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        let errorMsg = "Failed to process images and subtitles";
        if (errorData?.detail) {
          errorMsg = typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail);
        }
        throw new Error(errorMsg);
      }

      // Download the zip file
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = "subtitled_images.zip";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);

    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async (targetUrl: string): Promise<boolean> => {
    try {
      const response = await fetch(`${targetUrl}/`, {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "Bypass-Tunnel-Reminder": "true"
        }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.status && data.status.includes("Backend is running")) {
          setBackendConnected(true);
          return true;
        }
      }
      setBackendConnected(false);
      return false;
    } catch (err) {
      setBackendConnected(false);
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) {
      setError("Please enter a YouTube URL");
      return;
    }
    
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${backendUrl}/api/screenshots`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Bypass-Tunnel-Reminder": "true"
        },
        body: JSON.stringify({ videoUrl: url, cropType: cropType }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        let errorMsg = "Failed to process video";
        if (errorData?.detail) {
          errorMsg = typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail);
        }
        throw new Error(errorMsg);
      }

      // Download the zip file
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = "youtube_screenshots.zip";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);

    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleChannelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!channelUrl) {
      setError("Please enter a YouTube Channel URL");
      return;
    }
    
    setError("");
    setLoading(true);
    setExtractedVideos([]);
    setExtractedChannelName("");

    try {
      const response = await fetch(`${backendUrl}/api/channel/videos`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Bypass-Tunnel-Reminder": "true"
        },
        body: JSON.stringify({ channelUrl, maxVideos: Number(maxVideos) }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        let errorMsg = "Failed to scrape channel";
        if (errorData?.detail) {
          errorMsg = typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail);
        }
        throw new Error(errorMsg);
      }

      const data = await response.json();
      setExtractedChannelName(data.channelName || "YouTube Channel");
      setExtractedVideos(data.videos || []);

    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const downloadCSV = () => {
    if (extractedVideos.length === 0) return;
    
    const filtered = extractedVideos.filter(v => 
      v.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    if (filtered.length === 0) return;
    
    const csvRows = [
      ["Title", "URL"],
      ...filtered.map(v => [
        `"${v.title.replace(/"/g, '""')}"`,
        `"${v.url.replace(/"/g, '""')}"`
      ])
    ];
    
    const csvContent = "\uFEFF" + csvRows.map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    
    const sanitizedChannelName = extractedChannelName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "_")
      .replace(/_+/g, "_")
      .trim();
    link.setAttribute("download", `${sanitizedChannelName || "channel"}_videos.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <main className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center p-4 sm:p-8 relative overflow-hidden">
      
      {/* Background glowing orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-red-600/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/20 blur-[120px] pointer-events-none" />

      <div className="z-10 w-full max-w-3xl flex flex-col gap-8 items-center text-center">
        
        {/* Header section */}
        <div className="space-y-4">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md shadow-2xl mb-2">
            <Film className="w-10 h-10 text-red-500" />
          </div>
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight bg-gradient-to-br from-white to-neutral-400 bg-clip-text text-transparent">
            YT Screenshot Extractor
          </h1>
          <p className="text-lg text-neutral-400 max-w-xl mx-auto">
            {activeTab === "extract"
              ? "Paste any YouTube link and automatically extract perfectly cropped screenshots from the entire video."
              : activeTab === "subtitles"
              ? "Upload a ZIP file of images and a TXT file of subtitles to overlay text on your images sequentially."
              : "Paste a YouTube channel link to extract all video titles and URLs, view them, and export to CSV."}
          </p>
        </div>

        <div className="w-full bg-white/5 border border-white/10 p-6 sm:p-10 rounded-3xl backdrop-blur-xl shadow-2xl shadow-black/50 relative">
          
          {/* Global Connection Status Indicator */}
          <div className="absolute top-4 right-6 sm:top-6 sm:right-10 z-20">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-neutral-400">
              <span className={`w-2 h-2 rounded-full ${
                backendConnected === true ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" : 
                backendConnected === false ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]" : 
                "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)] animate-pulse"
              }`} />
              {backendConnected === true ? "Local Backend: Connected" : 
               backendConnected === false ? "Local Backend: Offline" : 
               "Checking connection..."}
            </div>
          </div>

          {/* Tab Switcher */}
          <div className="flex border-b border-white/10 pb-4 mb-6 gap-6 justify-center">
            <button
              type="button"
              onClick={() => {
                setActiveTab("extract");
                setError("");
              }}
              className={`pb-2 text-sm font-semibold tracking-wider transition-all border-b-2 flex items-center gap-2 ${
                activeTab === "extract" 
                  ? "text-red-500 border-red-500" 
                  : "text-neutral-500 border-transparent hover:text-neutral-300"
              }`}
            >
              <Video className="w-4 h-4" />
              Extract Screenshots
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("subtitles");
                setError("");
              }}
              className={`pb-2 text-sm font-semibold tracking-wider transition-all border-b-2 flex items-center gap-2 ${
                activeTab === "subtitles" 
                  ? "text-red-500 border-red-500" 
                  : "text-neutral-500 border-transparent hover:text-neutral-300"
              }`}
            >
              <ImageIcon className="w-4 h-4" />
              Add Subtitles
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("channel");
                setError("");
              }}
              className={`pb-2 text-sm font-semibold tracking-wider transition-all border-b-2 flex items-center gap-2 ${
                activeTab === "channel" 
                  ? "text-red-500 border-red-500" 
                  : "text-neutral-500 border-transparent hover:text-neutral-300"
              }`}
            >
              <List className="w-4 h-4" />
              Scrape Channel Links
            </button>
          </div>

          <form onSubmit={
            activeTab === "extract" ? handleSubmit : 
            activeTab === "subtitles" ? handleSubtitlesSubmit : 
            handleChannelSubmit
          } className="flex flex-col gap-6">
            {activeTab === "extract" ? (
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-2 text-left">
                  <div className="flex justify-between items-center ml-1">
                    <label htmlFor="url" className="text-sm font-medium text-neutral-300">
                      YouTube Video URL
                    </label>
                  </div>
                  
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Video className="h-5 w-5 text-neutral-500 group-focus-within:text-red-400 transition-colors" />
                    </div>
                    <input
                      type="url"
                      id="url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://www.youtube.com/watch?v=..."
                      className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 transition-all duration-300"
                      required={activeTab === "extract"}
                    />
                  </div>
                </div>

                {/* Cropping Options */}
                <div className="flex flex-col gap-2.5 text-left">
                  <label className="text-sm font-medium text-neutral-300 ml-1">
                    Watermark & Subtitle Removal (Crop Mode)
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setCropType("none")}
                      className={`flex flex-col gap-1 p-3.5 rounded-2xl border text-left transition-all duration-200 ${
                        cropType === "none" 
                          ? "bg-red-600/10 border-red-500 text-white shadow-[0_0_15px_rgba(220,38,38,0.15)]" 
                          : "bg-black/30 border-white/10 hover:border-white/20 text-neutral-400 hover:text-neutral-300"
                      }`}
                    >
                      <span className="text-xs font-bold uppercase tracking-wider">No Crop</span>
                      <span className="text-[11px] leading-relaxed text-neutral-500">Full original video stream without modification.</span>
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => setCropType("no_bottom")}
                      className={`flex flex-col gap-1 p-3.5 rounded-2xl border text-left transition-all duration-200 ${
                        cropType === "no_bottom" 
                          ? "bg-red-600/10 border-red-500 text-white shadow-[0_0_15px_rgba(220,38,38,0.15)]" 
                          : "bg-black/30 border-white/10 hover:border-white/20 text-neutral-400 hover:text-neutral-300"
                      }`}
                    >
                      <span className="text-xs font-bold uppercase tracking-wider">Remove Subtitles</span>
                      <span className="text-[11px] leading-relaxed text-neutral-500">Crops bottom 15% to hide captions and player overlays.</span>
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => setCropType("central_4_3")}
                      className={`flex flex-col gap-1 p-3.5 rounded-2xl border text-left transition-all duration-200 ${
                        cropType === "central_4_3" 
                          ? "bg-red-600/10 border-red-500 text-white shadow-[0_0_15px_rgba(220,38,38,0.15)]" 
                          : "bg-black/30 border-white/10 hover:border-white/20 text-neutral-400 hover:text-neutral-300"
                      }`}
                    >
                      <span className="text-xs font-bold uppercase tracking-wider">Center Focus (4:3)</span>
                      <span className="text-[11px] leading-relaxed text-neutral-500">Removes left/right black bars, watermarks, and bottom text.</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : activeTab === "subtitles" ? (
              <div className="flex flex-col gap-6">
                {/* Images ZIP File Upload */}
                <div className="flex flex-col gap-2 text-left">
                  <div className="flex justify-between items-center ml-1">
                    <label htmlFor="imagesZip" className="text-sm font-medium text-neutral-300">
                      Images ZIP File (Containing screenshots)
                    </label>
                  </div>
                  <div className="relative group">
                    <input
                      type="file"
                      id="imagesZip"
                      accept=".zip"
                      onChange={(e) => setImagesZip(e.target.files?.[0] || null)}
                      className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 px-4 text-white focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 transition-all duration-300 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-neutral-800 file:text-neutral-300 hover:file:bg-neutral-700"
                      required={activeTab === "subtitles"}
                    />
                  </div>
                </div>

                {/* Subtitles TXT File Upload */}
                <div className="flex flex-col gap-2 text-left">
                  <label htmlFor="subtitlesTxt" className="text-sm font-medium text-neutral-300 ml-1">
                    Subtitles TXT File (One line of text per image)
                  </label>
                  <div className="relative group">
                    <input
                      type="file"
                      id="subtitlesTxt"
                      accept=".txt"
                      onChange={(e) => setSubtitlesTxt(e.target.files?.[0] || null)}
                      className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 px-4 text-white focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 transition-all duration-300 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-neutral-800 file:text-neutral-300 hover:file:bg-neutral-700"
                      required={activeTab === "subtitles"}
                    />
                  </div>
                </div>

                {/* Subtitle Overlay Style */}
                <div className="flex flex-col gap-2.5 text-left">
                  <label className="text-sm font-medium text-neutral-300 ml-1">
                    Subtitle Overlay Style
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setSubtitleStyle("outline")}
                      className={`flex flex-col gap-1 p-3.5 rounded-2xl border text-left transition-all duration-200 ${
                        subtitleStyle === "outline" 
                          ? "bg-red-600/10 border-red-500 text-white shadow-[0_0_15px_rgba(220,38,38,0.15)]" 
                          : "bg-black/30 border-white/10 hover:border-white/20 text-neutral-400 hover:text-neutral-300"
                      }`}
                    >
                      <span className="text-xs font-bold uppercase tracking-wider">Outline Shadow</span>
                      <span className="text-[11px] leading-relaxed text-neutral-500">White text with a thick black outline for visibility on any background.</span>
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => setSubtitleStyle("bg_box")}
                      className={`flex flex-col gap-1 p-3.5 rounded-2xl border text-left transition-all duration-200 ${
                        subtitleStyle === "bg_box" 
                          ? "bg-red-600/10 border-red-500 text-white shadow-[0_0_15px_rgba(220,38,38,0.15)]" 
                          : "bg-black/30 border-white/10 hover:border-white/20 text-neutral-400 hover:text-neutral-300"
                      }`}
                    >
                      <span className="text-xs font-bold uppercase tracking-wider">Translucent Bar</span>
                      <span className="text-[11px] leading-relaxed text-neutral-500">White text inside a dark semi-transparent rectangle box.</span>
                    </button>
                  </div>
                </div>

                {/* Subtitle Text Options (Color & Bold) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="textColor" className="text-xs text-neutral-400">Text Color</label>
                    <div className="flex items-center gap-3 bg-black/40 border border-white/10 rounded-xl py-2 px-3">
                      <input
                        type="color"
                        id="textColor"
                        value={textColor}
                        onChange={(e) => setTextColor(e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer border-0 p-0 bg-transparent focus:outline-none"
                      />
                      <span className="text-sm text-neutral-300 font-mono uppercase">{textColor}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 justify-end pb-2">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className={`w-12 h-6 rounded-full transition-colors flex items-center px-1 ${isBold ? 'bg-red-500' : 'bg-neutral-700'}`}>
                        <div className={`w-4 h-4 bg-white rounded-full transition-transform ${isBold ? 'translate-x-6' : 'translate-x-0'}`} />
                      </div>
                      <span className={`text-sm transition-colors ${isBold ? 'text-white font-bold' : 'text-neutral-400 font-medium'}`}>
                        Bold Text
                      </span>
                      <input 
                        type="checkbox" 
                        className="hidden" 
                        checked={isBold} 
                        onChange={(e) => setIsBold(e.target.checked)} 
                      />
                    </label>
                  </div>
                </div>

                {/* Subtitle Sizing and Margins */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="fontSize" className="text-xs text-neutral-400">Font Size (px, blank for auto)</label>
                    <input
                      type="number"
                      id="fontSize"
                      value={fontSize}
                      onChange={(e) => setFontSize(e.target.value)}
                      placeholder="Auto-scale"
                      className="bg-black/40 border border-white/10 rounded-xl py-2.5 px-3.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500/40"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="fontScale" className="text-xs text-neutral-400">Font Scale (Auto mode only)</label>
                    <input
                      type="number"
                      id="fontScale"
                      step="0.005"
                      value={fontScale}
                      onChange={(e) => setFontScale(parseFloat(e.target.value) || 0.045)}
                      className="bg-black/40 border border-white/10 rounded-xl py-2.5 px-3.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500/40"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="margin" className="text-xs text-neutral-400">Bottom Margin (% height)</label>
                    <input
                      type="number"
                      id="margin"
                      step="0.01"
                      value={margin}
                      onChange={(e) => setMargin(parseFloat(e.target.value) || 0.08)}
                      className="bg-black/40 border border-white/10 rounded-xl py-2.5 px-3.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500/40"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                {/* Channel URL */}
                <div className="flex flex-col gap-2 text-left">
                  <div className="flex justify-between items-center ml-1">
                    <label htmlFor="channelUrl" className="text-sm font-medium text-neutral-300">
                      YouTube Channel URL
                    </label>
                  </div>
                  
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <List className="h-5 w-5 text-neutral-500 group-focus-within:text-red-400 transition-colors" />
                    </div>
                    <input
                      type="url"
                      id="channelUrl"
                      value={channelUrl}
                      onChange={(e) => setChannelUrl(e.target.value)}
                      placeholder="https://www.youtube.com/@ChannelName or https://www.youtube.com/channel/..."
                      className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 transition-all duration-300"
                      required={activeTab === "channel"}
                    />
                  </div>
                </div>

                {/* Sizing & Video Limits */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="maxVideos" className="text-xs text-neutral-400">Maximum Videos to Fetch</label>
                    <input
                      type="number"
                      id="maxVideos"
                      value={maxVideos}
                      onChange={(e) => setMaxVideos(parseInt(e.target.value) || 0)}
                      placeholder="e.g. 100"
                      className="bg-black/40 border border-white/10 rounded-xl py-2.5 px-3.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500/40"
                    />
                    <span className="text-[10px] text-neutral-500 ml-1">Use a lower limit (e.g., 50-100) for faster responses. Set to 0 to fetch all videos.</span>
                  </div>
                </div>
              </div>
            )}



            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-center gap-3 text-sm text-left">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || backendConnected !== true}
              className="relative w-full bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-semibold py-4 px-8 rounded-2xl transition-all duration-300 transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 flex items-center justify-center gap-2 shadow-[0_0_40px_-10px_rgba(220,38,38,0.5)] overflow-hidden group"
            >
              {/* Shine effect */}
              <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
              
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {activeTab === "extract" ? "Processing Video... (This might take a while)" : 
                   activeTab === "subtitles" ? "Processing Images & Subtitles..." : 
                   "Extracting channel videos... (This can take a moment)"}
                </>
              ) : backendConnected !== true ? (
                <>
                  Start Local Backend Server on your PC to Connect
                </>
              ) : activeTab === "extract" ? (
                <>
                  <ImageIcon className="w-5 h-5" />
                  Extract & Download ZIP
                </>
              ) : activeTab === "subtitles" ? (
                <>
                  <Download className="w-5 h-5" />
                  Add Subtitles & Download ZIP
                </>
              ) : (
                <>
                  <List className="w-5 h-5" />
                  Extract Channel Videos
                </>
              )}
            </button>
          </form>
        </div>

        {/* Extracted Videos Results Section */}
        {activeTab === "channel" && extractedVideos.length > 0 && (
          <div className="w-full bg-white/5 border border-white/10 p-6 sm:p-10 rounded-3xl backdrop-blur-xl shadow-2xl shadow-black/50 text-left flex flex-col gap-6 transition-all duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <h2 className="text-xl font-semibold text-white">
                  {extractedChannelName}
                </h2>
                <p className="text-xs text-neutral-400 mt-1">
                  Extracted {extractedVideos.length} video{extractedVideos.length === 1 ? '' : 's'}
                </p>
              </div>
              <button
                type="button"
                onClick={downloadCSV}
                className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2.5 px-5 rounded-xl transition-all duration-200 shadow-lg shadow-emerald-950/20 text-sm cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Download CSV
              </button>
            </div>

            {/* Search/Filter bar */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-neutral-500" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search videos by title..."
                className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-red-500/40 focus:border-red-500/40 transition-all duration-200"
              />
            </div>

            {/* Table Container */}
            <div className="overflow-x-auto rounded-xl border border-white/5 bg-black/20 max-h-[400px] overflow-y-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5 text-neutral-400 font-medium">
                    <th className="py-3 px-4 w-12 text-center">#</th>
                    <th className="py-3 px-4">Title</th>
                    <th className="py-3 px-4 w-28 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {extractedVideos
                    .filter(v => v.title.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map((video, idx) => (
                      <tr key={`${video.id || 'video'}-${idx}`} className="hover:bg-white/5 transition-colors group">
                        <td className="py-3.5 px-4 text-center text-neutral-500 font-mono text-xs">{idx + 1}</td>
                        <td className="py-3.5 px-4 font-medium text-neutral-200 break-words max-w-[200px] sm:max-w-md">
                          {video.title}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <a
                              href={video.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-neutral-400 hover:text-white hover:bg-white/10 transition-all"
                              title="Open Video"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(video.url);
                                const btn = document.getElementById(`copy-btn-${video.id || 'video'}-${idx}`);
                                if (btn) {
                                  btn.classList.add("text-emerald-500");
                                  setTimeout(() => btn.classList.remove("text-emerald-500"), 1000);
                                }
                              }}
                              id={`copy-btn-${video.id || 'video'}-${idx}`}
                              className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-neutral-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                              title="Copy URL"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  {extractedVideos.filter(v => v.title.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-neutral-500">
                        No videos match your search query.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Feature Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full mt-4">
          <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white/5 border border-white/5 text-center">
            <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400">
              <Video className="w-6 h-6" />
            </div>
            <h3 className="font-medium text-neutral-200">Full Video Scan</h3>
            <p className="text-sm text-neutral-500">Automatically watches the video and captures frames.</p>
          </div>
          <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white/5 border border-white/5 text-center">
            <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400">
              <ImageIcon className="w-6 h-6" />
            </div>
            <h3 className="font-medium text-neutral-200">Raw Stream Extraction</h3>
            <p className="text-sm text-neutral-500">Gets clean frames directly from the video stream without any YouTube UI.</p>
          </div>
          <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white/5 border border-white/5 text-center">
            <div className="p-3 rounded-xl bg-green-500/10 text-green-400">
              <Download className="w-6 h-6" />
            </div>
            <h3 className="font-medium text-neutral-200">Batch Download</h3>
            <p className="text-sm text-neutral-500">Delivers a clean ZIP file containing all your screenshots.</p>
          </div>
        </div>

      </div>

      <style jsx global>{`
        @keyframes shimmer {
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </main>
  );
}
