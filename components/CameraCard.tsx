
import React, { useState, useMemo } from 'react';
import { TrafficCamera, CongestionAnalysis } from '../types';
import { geminiService } from '../services/geminiService';

interface CameraCardProps {
  camera: TrafficCamera;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  onViewLive: (camera: TrafficCamera) => void;
}

const CameraCard: React.FC<CameraCardProps> = React.memo(({ camera, isFavorite, onToggleFavorite, onViewLive }) => {
  const [analysis, setAnalysis] = useState<CongestionAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [imgError, setImgError] = useState(false);

  const isFeed = camera.type === 'feed';
  const isSpeedCamera = camera.type === 'spot-speed' || camera.type === 'point-to-point';

  const handleAnalyze = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!camera.imageUrl || imgError) return;
    setIsAnalyzing(true);
    const result = await geminiService.analyzeCongestion(camera.imageUrl);
    setAnalysis(result);
    setIsAnalyzing(false);
  };

  const statusColor = useMemo(() => {
    if (imgError) return 'bg-red-500';
    if (camera.status === 'Operational' || camera.status === 'Enforcing') return 'bg-emerald-500';
    if (camera.status.toLowerCase().includes('construction')) return 'bg-amber-500';
    return 'bg-zinc-500';
  }, [camera.status, imgError]);

  return (
    <div 
      className="group bg-[#18181b]/60 backdrop-blur-sm border border-zinc-800/50 rounded-2xl overflow-hidden hover:border-zinc-700 transition-all duration-300 flex flex-col relative shadow-lg active:scale-[0.98]"
      onClick={() => onViewLive(camera)}
    >
      {/* Image Section */}
      <div className="relative aspect-video bg-zinc-900 overflow-hidden">
        {isFeed && !imgError ? (
          <img
            src={camera.imageUrl}
            alt={camera.name}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-80 group-hover:opacity-100"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-zinc-800 bg-[#0c0a09] border-b border-zinc-800/30">
            {isSpeedCamera ? (
               <div className="flex flex-col items-center">
                 <div className="w-10 h-10 border border-zinc-800 rounded-xl flex items-center justify-center mb-2 shadow-inner">
                   <span className="font-mono font-black text-[10px] text-zinc-600">INTEL</span>
                 </div>
                 <span className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-700">Passive Sensor</span>
               </div>
            ) : (
               <svg className="w-8 h-8 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg>
            )}
          </div>
        )}

        {/* Favorite Button (Visible on hover and on touch devices by default if favorited) */}
        <div className={`absolute top-3 right-3 z-10 transition-opacity ${isFavorite ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          <button
            onClick={(e) => { e.stopPropagation(); onToggleFavorite(camera.id); }}
            className={`w-10 h-10 flex items-center justify-center rounded-xl backdrop-blur-xl border border-white/10 shadow-2xl transition-all active:scale-90 ${
              isFavorite ? 'bg-amber-500 text-white shadow-amber-500/20' : 'bg-black/60 text-white hover:bg-black/80'
            }`}
          >
            <svg className="w-5 h-5" fill={isFavorite ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>
          </button>
        </div>

        {/* AI Analysis Quick Info */}
        {analysis && (
          <div className="absolute bottom-3 left-3 z-10">
            <div className={`px-2.5 py-1 rounded-lg shadow-2xl backdrop-blur-xl border border-white/10 flex items-center gap-2 ${
               analysis.level === 'heavy' ? 'bg-red-600/90' : 
               analysis.level === 'moderate' ? 'bg-amber-600/90' : 
               'bg-emerald-600/90'
            }`}>
              <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></div>
              <span className="text-[10px] font-black uppercase tracking-widest text-white">{analysis.level}</span>
            </div>
          </div>
        )}
        
        {/* Analyze Button (Mobile Optimized) */}
        {isFeed && !analysis && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-[1px]">
            <button
               onClick={handleAnalyze}
               disabled={isAnalyzing}
               className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-2xl transform translate-y-2 group-hover:translate-y-0 transition-all duration-300"
            >
               {isAnalyzing ? 'Processing...' : 'Sync Intel'}
            </button>
          </div>
        )}
      </div>

      {/* Content Section */}
      <div className="p-4 flex flex-col gap-3 flex-1 relative overflow-hidden">
        <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-zinc-800/10 rounded-full"></div>
        
        <div className="flex items-start justify-between gap-3 relative">
          <h3 className="font-bold text-xs sm:text-sm text-zinc-100 leading-tight line-clamp-2 pr-2" title={camera.name}>
            {camera.name}
          </h3>
          <div className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 shadow-[0_0_8px_currentColor] ${statusColor} ${camera.status === 'Operational' ? 'animate-pulse' : ''}`} style={{ color: statusColor.replace('bg-', '') }}></div>
        </div>
        
        <div className="flex items-center gap-2 mt-auto relative">
          <span className="px-2.5 py-1 rounded-lg text-[9px] font-black bg-zinc-900 border border-zinc-800 text-zinc-500 uppercase tracking-widest">
            {camera.region}
          </span>
          {camera.direction !== 'N/A' && (
             <span className="text-[9px] text-zinc-600 font-black uppercase tracking-tighter">{camera.direction} VECTOR</span>
          )}
        </div>
      </div>
    </div>
  );
});

export default CameraCard;
