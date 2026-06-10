"use client";

import { useState } from "react";
import { Film, Download, Loader2, Image as ImageIcon, Video, AlertCircle } from "lucide-react";

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) {
      setError("Please enter a YouTube URL");
      return;
    }
    
    setError("");
    setLoading(true);

    try {
      // Use the live Render backend URL
      const apiUrl = "https://ytscreenshot-backend.onrender.com";
      
      const response = await fetch(`${apiUrl}/api/screenshots`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ videoUrl: url }),
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
              <label htmlFor="url" className="text-sm font-medium text-neutral-300 ml-1">
                YouTube Video URL
              </label>
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

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-center gap-3 text-sm text-left">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="relative w-full bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-semibold py-4 px-8 rounded-2xl transition-all duration-300 transform active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed disabled:active:scale-100 flex items-center justify-center gap-2 shadow-[0_0_40px_-10px_rgba(220,38,38,0.5)] overflow-hidden group"
            >
              {/* Shine effect */}
              <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
              
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processing Video... (This might take a while)
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
