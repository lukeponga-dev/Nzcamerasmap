
import React, { useState, useEffect } from 'react';
import { TrafficCamera, CongestionAnalysis, MapGroundingResult, SearchGroundingResult, AdvancedIntelligence } from '../types';
import { geminiService } from '../services/geminiService';

interface ImageModalProps {
  camera: TrafficCamera;
  onClose: () => void;
}

// Removed manual 'declare global' for window.aistudio as it is pre-configured in the environment.

const ImageModal: React.FC<ImageModalProps> = ({ camera, onClose }) => {
  const [analysis, setAnalysis] = useState<CongestionAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [context, setContext] = useState<{ text: string; links: MapGroundingResult[] } | null>(null);
  const [news, setNews] = useState<SearchGroundingResult | null>(null);
  const [deepIntel, setDeepIntel] = useState<AdvancedIntelligence | null>(null);
  const [isThinking, setIsThinking] = useState(false);

  // Image Projection States
  const [isProjecting, setIsProjecting] = useState(false);
  const [projectionResult, setProjectionResult] = useState<string | null>(null);
  const [projectionPrompt, setProjectionPrompt] = useState('');
  const [selectedAspect, setSelectedAspect] = useState('16:9');
  
  // API Key State
  const [hasKey, setHasKey] = useState(true);
  const [keyErrorMessage, setKeyErrorMessage] = useState<string | null>(null);

  const aspectRatios = ['1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9', '21:9'];

  useEffect(() => {
    const checkApiKey = async () => {
      // Access window.aistudio directly as it is provided by the platform
      const selected = await (window as any).aistudio.hasSelectedApiKey();
      setHasKey(selected);
    };
    
    const initializeData = async () => {
      const [ctxResult, newsResult] = await Promise.all([
        geminiService.getNearbyContext(camera.latitude, camera.longitude, camera.name),
        geminiService.getRegionalTrafficNews(camera.region, camera.name)
      ]);
      setContext(ctxResult);
      setNews(newsResult);
    };
    
    checkApiKey();
    initializeData();
  }, [camera]);

  const handleDeepAnalysis = async () => {
    setIsThinking(true);
    const result = await geminiService.getDeepIntelligence(camera);
    setDeepIntel(result);
    setIsThinking(false);
  };

  const handleSelectKey = async () => {
    await (window as any).aistudio.openSelectKey();
    // Guidelines: Assume the key selection was successful after triggering openSelectKey()
    setHasKey(true);
    setKeyErrorMessage(null);
  };

  const handleGenerateProjection = async () => {
    if (!projectionPrompt) return;
    
    const isSelected = await (window as any).aistudio.hasSelectedApiKey();
    if (!isSelected) {
      setHasKey(false);
      return;
    }

    setIsProjecting(true);
    setKeyErrorMessage(null);
    try {
      const img = await geminiService.generateProjection(projectionPrompt, selectedAspect);
      setProjectionResult(img);
    } catch (e: any) {
      console.error(e);
      const msg = e.message || "";
      if (msg.includes("Requested entity was not found") || msg.includes("403") || msg.includes("permission")) {
        setHasKey(false);
        setKeyErrorMessage("HQ Uplink requires a Paid API Key with correct permissions.");
      } else if (msg.includes("429") || msg.includes("quota")) {
        setKeyErrorMessage("HQ Projection Quota Exhausted. Use a Paid project API key.");
      } else {
        setKeyErrorMessage("Projection failed. Verify connectivity.");
      }
    } finally {
      setIsProjecting(false);
    }
  };

  const handleAnalyze = async () => {
    if (!camera.imageUrl) return;
    setIsAnalyzing(true);
    const result = await geminiService.analyzeCongestion(camera.imageUrl);
    setAnalysis(result);
    setIsAnalyzing(false);
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-0 sm:p-6 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-black/95 backdrop-blur-md" onClick={onClose}></div>
      <div className="relative w-full h-full sm:h-[90vh] sm:max-w-6xl bg-[#09090b] rounded-none sm:rounded-[2.5rem] border-0 sm:border border-zinc-800 shadow-2xl flex flex-col lg:flex-row overflow-hidden">
        
        <div className="h-16 flex items-center justify-between px-5 border-b border-zinc-800 bg-[#09090b] z-[1010] flex-shrink-0">
          <div className="flex flex-col min-w-0 pr-4">
             <h2 className="text-sm font-bold text-white truncate">{camera.name}</h2>
             <span className="text-[9px] text-zinc-600 font-mono tracking-widest">{camera.region} • {camera.id}</span>
          </div>
          <button onClick={onClose} className="p-2.5 bg-zinc-900 rounded-2xl text-zinc-400 hover:text-white transition-all active:scale-90">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="h-[40vh] sm:h-[45vh] lg:h-auto lg:w-7/12 flex flex-col bg-black overflow-hidden relative border-b lg:border-b-0 lg:border-r border-zinc-800">
           <div className="flex-1 relative flex items-center justify-center bg-[#050505] overflow-hidden">
             {projectionResult ? (
                <img src={projectionResult} alt="AI Projection" className="w-full h-full object-contain animate-in zoom-in-105 duration-700" />
             ) : camera.imageUrl ? (
                <img src={camera.imageUrl} alt={camera.name} className="w-full h-full object-contain" />
             ) : (
                <div className="text-center opacity-40">
                  <svg className="w-12 h-12 mx-auto mb-3 text-zinc-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                  <p className="font-mono uppercase tracking-widest text-[9px]">Sensor Node Offline</p>
                </div>
             )}

             {isProjecting && (
                <div className="absolute inset-0 bg-blue-600/20 backdrop-blur-md flex flex-col items-center justify-center gap-4 z-50">
                  <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
                  <span className="text-[10px] font-black text-white uppercase tracking-[0.5em] animate-pulse">Rendering Matrix Projection</span>
                </div>
             )}
           </div>

           <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black via-black/80 to-transparent">
              <div className="flex flex-col gap-3">
                 {!hasKey ? (
                    <div className="bg-red-900/40 border border-red-500/30 p-4 rounded-2xl backdrop-blur-xl animate-in slide-in-from-bottom-2">
                       <h4 className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-1">HQ Projection Locked</h4>
                       <p className="text-[9px] text-zinc-400 mb-3">Paid API Key from a paid GCP project is required for high-quality simulations.</p>
                       <div className="flex gap-3">
                         <button onClick={handleSelectKey} className="flex-1 py-2 bg-red-600 text-white text-[9px] font-black uppercase tracking-widest rounded-lg active:scale-95 transition-all">Select API Key</button>
                         <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="px-4 py-2 bg-zinc-800 text-zinc-400 text-[9px] font-black uppercase tracking-widest rounded-lg border border-zinc-700 flex items-center justify-center">Docs</a>
                       </div>
                    </div>
                 ) : (
                    <>
                       {keyErrorMessage && (
                          <div className="bg-amber-900/40 border border-amber-500/30 p-2 rounded-xl text-[9px] font-bold text-amber-400 flex justify-between items-center mb-1">
                             <span>{keyErrorMessage}</span>
                             <button onClick={handleSelectKey} className="underline uppercase tracking-tighter">Change Key</button>
                          </div>
                       )}
                       <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                          {aspectRatios.map(ratio => (
                             <button 
                               key={ratio} 
                               onClick={() => setSelectedAspect(ratio)}
                               className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border transition-all ${
                                  selectedAspect === ratio ? 'bg-blue-600 border-blue-500 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-600'
                               }`}
                             >
                               {ratio}
                             </button>
                          ))}
                       </div>
                       <div className="flex gap-2">
                          <input 
                            type="text" 
                            placeholder="Simulate: 'Heavy rain during rush hour'..." 
                            className="flex-1 bg-zinc-900/80 border border-zinc-800 rounded-xl px-4 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/50"
                            value={projectionPrompt}
                            onChange={(e) => setProjectionPrompt(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleGenerateProjection()}
                          />
                          <button 
                            onClick={handleGenerateProjection}
                            disabled={isProjecting}
                            className="px-4 py-2 bg-blue-600 text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-blue-500 disabled:opacity-50 transition-all active:scale-95"
                          >
                            Project
                          </button>
                          {projectionResult && (
                             <button onClick={() => setProjectionResult(null)} className="p-2 bg-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-colors">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4l16 16m0-16L4 20"/></svg>
                             </button>
                          )}
                       </div>
                    </>
                 )}
              </div>
           </div>
        </div>

        <div className="flex-1 lg:w-5/12 bg-[#0c0a09] overflow-y-auto custom-scroll p-6 sm:p-10 space-y-10">
           <div className="space-y-6">
              <div className="flex items-center gap-3"><h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Deep Matrix Intelligence</h3></div>
              {!deepIntel && !isThinking ? (
                <button onClick={handleDeepAnalysis} className="w-full py-4 bg-blue-600/10 border border-blue-500/20 rounded-2xl text-[10px] font-black text-blue-500 uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all">Launch Strategic Reasoning</button>
              ) : isThinking ? (
                <div className="p-6 bg-zinc-900 rounded-2xl animate-pulse space-y-3">
                   <div className="h-2 bg-zinc-800 rounded w-full"></div>
                   <div className="h-2 bg-zinc-800 rounded w-5/6"></div>
                   <div className="h-2 bg-zinc-800 rounded w-4/6"></div>
                </div>
              ) : (
                <div className="space-y-4">
                   {deepIntel.thought && <p className="text-[9px] font-mono text-zinc-600 border-l border-zinc-800 pl-4 italic">Thinking: {deepIntel.thought}</p>}
                   <p className="text-sm text-zinc-300 leading-relaxed font-semibold">"{deepIntel.response}"</p>
                </div>
              )}
           </div>

           <div className="space-y-6">
              <div className="flex items-center gap-3"><h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Sector Recon</h3></div>
              {!context ? (
                <div className="h-20 bg-zinc-900 rounded-2xl animate-pulse"></div>
              ) : (
                <div className="space-y-4">
                   <p className="text-sm text-zinc-300 leading-relaxed italic font-medium">"{context.text}"</p>
                   <div className="flex flex-wrap gap-2">
                      {context.links.map((link, i) => (
                         <a key={i} href={link.uri} target="_blank" className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-[9px] text-blue-400 font-bold uppercase tracking-wide">{link.title}</a>
                      ))}
                   </div>
                </div>
              )}
           </div>

           <div className="space-y-6">
              <div className="flex items-center gap-3"><h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Real-time Advisories</h3></div>
              {!news ? (
                <div className="h-20 bg-zinc-900 rounded-2xl animate-pulse"></div>
              ) : (
                <div className="space-y-3">
                   {news.sources.length > 0 ? news.sources.map((src, i) => (
                      <a key={i} href={src.uri} target="_blank" className="flex items-center p-3 bg-zinc-900/50 border border-zinc-800 rounded-xl">
                         <div className="w-1 h-1 rounded-full bg-red-500 mr-3 shrink-0 animate-pulse"></div>
                         <span className="text-xs text-zinc-400 font-bold truncate">{src.title}</span>
                      </a>
                   )) : <p className="text-[10px] text-zinc-600 font-black uppercase">No active incidents detected in search stream</p>}
                </div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
};

export default ImageModal;
