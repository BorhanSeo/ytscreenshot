"use client";

import { useState, useEffect } from "react";
import { Film, Download, Loader2, Image as ImageIcon, Video, AlertCircle, Settings, Check, RefreshCw } from "lucide-react";

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  // Backend URL settings states
  const defaultUrl = "https://worthy-memory-problems-tapes.trycloudflare.com";
  const [backendUrl, setBackendUrl] = useState(defaultUrl);
  const [backendConnected, setBackendConnected] = useState<boolean | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [cropType, setCropType] = useState("none");

  // Initialize backend URL from localStorage on client side
  useEffect(() => {
    const initBackend = async () => {
      const savedUrl = localStorage.getItem("backend_url");
      if (savedUrl && savedUrl !== defaultUrl) {
        setBackendUrl(savedUrl);
        const success = await testConnection(savedUrl);
        if (success) return;
      }
      
      // Fallback to defaultUrl if savedUrl is missing or offline
      setBackendUrl(defaultUrl);
      await testConnection(defaultUrl);
    };
    initBackend();
  }, []);

  const testConnection = async (targetUrl: string): Promise<boolean> => {
    if (!targetUrl) return false;
    setTestingConnection(true);
    setBackendConnected(null);
    try {
      const response = await fetch(`${targetUrl}/`, {
        method: "GET",
        headers: {
          "Accept": "application/json"
        }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.status && data.status.includes("Backend is running")) {
          setBackendConnected(true);
          localStorage.setItem("backend_url", targetUrl);
          return true;
        }
      }
      setBackendConnected(false);
      return false;
    } catch (err) {
      setBackendConnected(false);
      return false;
    } finally {
      setTestingConnection(false);
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
            Paste any YouTube link and automatically extract perfectly cropped screenshots from the entire video.
          </p>
        </div>

        {/* Form Card */}
        <div className="w-full bg-white/5 border border-white/10 p-6 sm:p-10 rounded-3xl backdrop-blur-xl shadow-2xl shadow-black/50">
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div className="flex flex-col gap-2 text-left">
              <div className="flex justify-between items-center ml-1">
                <label htmlFor="url" className="text-sm font-medium text-neutral-300">
                  YouTube Video URL
                </label>
                
                {/* Connection Status Indicator */}
                <button
                  type="button"
                  onClick={() => setShowSettings(!showSettings)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-neutral-400 transition-colors"
                >
                  <span className={`w-2 h-2 rounded-full ${
                    backendConnected === true ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" : 
                    backendConnected === false ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]" : 
                    "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)] animate-pulse"
                  }`} />
                  {backendConnected === true ? "Local Backend: Connected" : 
                   backendConnected === false ? "Local Backend: Offline" : 
                   "Checking connection..."}
                  <Settings className="w-3.5 h-3.5 ml-1 text-neutral-500" />
                </button>
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
                  required
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

            {/* Configurable Settings Panel */}
            {showSettings && (
              <div className="p-5 rounded-2xl bg-black/30 border border-white/5 text-left flex flex-col gap-4 transition-all duration-300 animate-in fade-in slide-in-from-top-2">
                <div className="flex flex-col gap-1.5">
                  <h3 className="text-sm font-semibold text-neutral-200">Local Backend Server Connection</h3>
                  <p className="text-xs text-neutral-500 leading-normal">
                    Due to YouTube's strict blocking of cloud hosting IPs (AWS, Render, etc.), this app routes video stream extraction through your residential local connection.
                  </p>
                </div>
                
                <div className="flex flex-col gap-2">
                  <label className="text-xs text-neutral-400">Tunnel API URL (trycloudflare.com)</label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={backendUrl}
                      onChange={(e) => {
                        setBackendUrl(e.target.value);
                        setBackendConnected(null);
                      }}
                      placeholder="https://xxx.trycloudflare.com"
                      className="flex-1 bg-black/50 border border-white/10 rounded-xl py-2.5 px-4 text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-red-500/40"
                    />
                    <button
                      type="button"
                      onClick={() => testConnection(backendUrl)}
                      disabled={testingConnection}
                      className="inline-flex items-center gap-1.5 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-white text-xs font-semibold px-4 rounded-xl transition-all"
                    >
                      {testingConnection ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5" />
                      )}
                      Test
                    </button>
                  </div>
                </div>

                <div className="text-xs text-neutral-500 flex flex-col gap-1">
                  <span className="font-semibold text-neutral-400">How to run the local server:</span>
                  <span>1. Run <code className="bg-black/60 px-1 py-0.5 rounded text-red-400">python start_server.py</code> on your computer.</span>
                  <span>2. Copy the generated <code className="bg-black/60 px-1 py-0.5 rounded text-neutral-400">trycloudflare.com</code> URL.</span>
                  <span>3. Paste the URL here and click <strong>Test</strong> to save.</span>
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
                  Processing Video... (This might take a while)
                </>
              ) : backendConnected !== true ? (
                <>
                  Connect Local Backend Server above to Start
                </>
              ) : (
                <>
                  <ImageIcon className="w-5 h-5" />
                  Extract & Download ZIP
                </>
              )}
            </button>
          </form>
        </div>

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
