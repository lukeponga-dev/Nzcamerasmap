
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { TrafficCamera } from './types';
import CameraCard from './components/CameraCard';
import CameraMap from './components/CameraMap';
import ImageModal from './components/ImageModal';
import LiveCommand from './components/LiveCommand';
import { enforcementCameras } from './data/enforcementData';
import { trafficService } from './services/trafficService';

const REFRESH_INTERVAL_SECONDS = 60;
const PAGE_SIZE = 24;

const App: React.FC = () => {
  const [cameras, setCameras] = useState<TrafficCamera[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<string>('--:--');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('All');
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  
  const [routeOrigin, setRouteOrigin] = useState<TrafficCamera | null>(null);
  const [routeDestination, setRouteDestination] = useState<TrafficCamera | null>(null);
  
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL_SECONDS);
  const [activeModalCamera, setActiveModalCamera] = useState<TrafficCamera | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  
  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setVisibleCount(PAGE_SIZE);
    }, 150);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const stored = localStorage.getItem('traffic-surveillance-favorites');
    if (stored) {
      try { setFavorites(JSON.parse(stored)); } catch (e) { console.error(e); }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('traffic-surveillance-favorites', JSON.stringify(favorites));
  }, [favorites]);

  const toggleFavorite = useCallback((id: string) => {
    setFavorites(prev => 
      prev.includes(id) ? prev.filter(fid => fid !== id) : [...prev, id]
    );
  }, []);

  const fetchData = useCallback(async (isInitial = false) => {
    try {
      const liveCameras = await trafficService.fetchLiveCameras();
      setCameras([...liveCameras, ...enforcementCameras]);
      setLastSync(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      if (isInitial) setLoading(false);
      setCountdown(REFRESH_INTERVAL_SECONDS);
    } catch (err) {
      setCameras([...enforcementCameras]);
      if (isInitial) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(true); 
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          fetchData(false);
          return REFRESH_INTERVAL_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const filteredCameras = useMemo(() => {
    return cameras.filter(cam => {
      const matchesSearch = debouncedSearch === '' || 
                           cam.name.toLowerCase().includes(debouncedSearch.toLowerCase()) || 
                           cam.region.toLowerCase().includes(debouncedSearch.toLowerCase());
      const matchesRegion = selectedRegion === 'All' || cam.region === selectedRegion;
      const matchesFavorite = !showFavoritesOnly || favorites.includes(cam.id);
      return matchesSearch && matchesRegion && matchesFavorite;
    });
  }, [cameras, debouncedSearch, selectedRegion, showFavoritesOnly, favorites]);

  const stats = useMemo(() => {
    return {
      total: cameras.length,
      visible: filteredCameras.length,
      redLight: cameras.filter(c => c.type === 'red-light').length,
      speed: cameras.filter(c => c.type === 'spot-speed' || c.type === 'point-to-point').length,
      construction: cameras.filter(c => c.status.toLowerCase().includes('construction') || c.status === 'Testing').length
    };
  }, [cameras, filteredCameras]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleCount < filteredCameras.length) {
          setVisibleCount(prev => prev + PAGE_SIZE);
        }
      },
      { threshold: 0.1 }
    );
    if (observerTarget.current) observer.observe(observerTarget.current);
    return () => observer.disconnect();
  }, [filteredCameras, visibleCount]);

  const regions = useMemo(() => ['All', ...Array.from(new Set(cameras.map(c => c.region)))].sort(), [cameras]);

  const SidebarItem = ({ icon, label, active, onClick }: any) => (
    <button 
      onClick={() => { onClick(); setIsMobileMenuOpen(false); }}
      className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all active:scale-[0.97] ${active ? 'bg-blue-600/10 text-blue-500 border border-blue-500/10 shadow-lg' : 'text-zinc-400 hover:bg-zinc-800/50'}`}
    >
      <div className={`${active ? 'text-blue-500' : 'text-zinc-600'}`}>{icon}</div>
      <span className="text-sm font-black uppercase tracking-widest">{label}</span>
    </button>
  );

  const SidebarContent = () => (
    <>
      <div className="h-20 flex items-center px-6 border-b border-zinc-800/40">
        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center mr-4 shadow-[0_10px_30px_rgba(59,130,246,0.3)]">
           <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
        </div>
        <div className="flex flex-col">
          <span className="font-black text-xl tracking-tighter uppercase leading-none">TrafficOS</span>
          <span className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.4em] mt-1">Uplink Beta</span>
        </div>
      </div>

      <div className="p-4 flex-1 space-y-2 overflow-y-auto custom-scroll">
        <SidebarItem 
          active={viewMode === 'grid' && !showFavoritesOnly}
          onClick={() => { setViewMode('grid'); setShowFavoritesOnly(false); }}
          label="Matrix"
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2 2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/></svg>}
        />
        <SidebarItem 
          active={viewMode === 'map'}
          onClick={() => setViewMode('map')}
          label="Geo Map"
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 9m0 11l6-3m-6 3v-11m6 11l5.447-2.724A1 1 0 0121 16.382V5.618a1 1 0 01-1.447-.894L15 9m0 11V9m0 11l-6-3m6 3V9"/></svg>}
        />
        <SidebarItem 
          active={showFavoritesOnly}
          onClick={() => { setViewMode('grid'); setShowFavoritesOnly(true); }}
          label="Watchlist"
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>}
        />

        <div className="pt-8 pb-3 px-5">
           <span className="text-[10px] font-black text-zinc-700 uppercase tracking-widest">Network Analytics</span>
        </div>
        
        <div className="px-5 space-y-5">
           <div className="flex justify-between items-center text-[11px]">
              <span className="text-zinc-600 font-bold uppercase tracking-wide">Total Nodes</span>
              <span className="font-mono text-blue-500 font-black">{stats.total}</span>
           </div>
           <div className="flex justify-between items-center text-[11px]">
              <span className="text-zinc-600 font-bold uppercase tracking-wide">Red Light</span>
              <span className="font-mono text-zinc-400 font-black">{stats.redLight}</span>
           </div>
           <div className="flex justify-between items-center text-[11px]">
              <span className="text-zinc-600 font-bold uppercase tracking-wide">Speed Intel</span>
              <span className="font-mono text-zinc-400 font-black">{stats.speed}</span>
           </div>
        </div>
      </div>

      <div className="p-6">
         <div className="bg-zinc-900/60 rounded-[2rem] p-5 border border-zinc-800 backdrop-blur-md">
            <div className="flex justify-between items-center mb-3">
               <span className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.3em]">Sync Stream</span>
               <div className="flex h-1.5 w-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_#3b82f6] animate-pulse"></div>
            </div>
            <div className="flex justify-between items-center text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-4">
               <span>Last Uplink</span>
               <span className="font-mono text-zinc-300">{lastSync}</span>
            </div>
            <div className="w-full bg-zinc-800 h-1 rounded-full overflow-hidden">
               <div className="bg-blue-600 h-full transition-all ease-linear duration-1000" style={{ width: `${(countdown/REFRESH_INTERVAL_SECONDS)*100}%` }}></div>
            </div>
         </div>
      </div>
    </>
  );

  const clearSearch = () => setSearchQuery('');

  return (
    <div className="flex h-screen bg-[#09090b] text-zinc-100 overflow-hidden font-sans">
      
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-md z-[90] md:hidden animate-in fade-in duration-300"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <aside className={`
        fixed inset-y-0 left-0 w-72 bg-[#09090b] border-r border-zinc-800/40 z-[100] transition-transform duration-500 md:relative md:translate-x-0 md:flex md:flex-col
        ${isMobileMenuOpen ? 'translate-x-0 shadow-[40px_0_100px_rgba(0,0,0,0.8)]' : '-translate-x-full'}
      `}>
        <SidebarContent />
      </aside>

      <main className="flex-1 flex flex-col relative min-w-0 overflow-hidden">
        
        <header className="h-20 border-b border-zinc-800/40 bg-[#09090b]/90 backdrop-blur-2xl flex items-center justify-between px-5 sm:px-8 sticky top-0 z-[80]">
           <div className="flex items-center gap-4 flex-1">
             <button 
               onClick={() => setIsMobileMenuOpen(true)}
               className="p-3 -ml-3 text-zinc-400 hover:text-white md:hidden active:scale-90"
             >
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h16"/></svg>
             </button>

             <div className={`
               ${isMobileSearchOpen ? 'fixed inset-x-0 top-0 h-20 bg-[#0c0c0e] px-5 flex items-center z-[110] animate-in slide-in-from-top duration-300' : 'relative max-w-sm w-full hidden sm:block'}
             `}>
               <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                 <svg className="h-4 w-4 text-zinc-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
               </div>
               <input
                 type="text"
                 className="block w-full pl-11 pr-11 py-3 border border-zinc-800 rounded-2xl leading-5 bg-zinc-900/40 text-zinc-300 placeholder-zinc-700 focus:outline-none focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium"
                 placeholder="Locate node by name..."
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
                 autoFocus={isMobileSearchOpen}
               />
               {searchQuery && (
                 <button 
                   onClick={clearSearch}
                   className="absolute right-14 sm:right-4 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors"
                 >
                   <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
                 </button>
               )}
             </div>

             <button 
               onClick={() => setIsMobileSearchOpen(true)}
               className="p-3 text-zinc-500 hover:text-white sm:hidden active:scale-90"
             >
               <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
             </button>
           </div>

           <div className="flex items-center gap-4">
              <div className="flex flex-col items-end shrink-0">
                 <span className="text-[9px] font-black text-zinc-700 uppercase tracking-widest hidden xs:block">Network Coverage</span>
                 <span className="text-[10px] sm:text-xs font-mono text-blue-500 font-black">
                   {Math.round((stats.visible / stats.total) * 100)}% ACTIVE
                 </span>
              </div>
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[10px] font-black text-zinc-600 shadow-inner group cursor-pointer hover:border-blue-500/50 transition-all active:scale-95">
                OS
              </div>
           </div>
        </header>

        {viewMode === 'grid' ? (
          <div className="flex-1 flex flex-col min-h-0 bg-[#070708]">
             <div className="px-5 sm:px-8 py-4 border-b border-zinc-800/30 bg-[#09090b]/40 backdrop-blur-xl relative overflow-hidden flex-shrink-0">
               <div className="flex items-center gap-3 overflow-x-auto custom-scroll no-scrollbar pb-1 mask-linear-fade">
                 {regions.map(region => (
                   <button
                     key={region}
                     onClick={() => setSelectedRegion(region)}
                     className={`px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all whitespace-nowrap active:scale-95 ${
                       selectedRegion === region 
                         ? 'bg-blue-600 text-white shadow-[0_10px_25px_rgba(59,130,246,0.3)]' 
                         : 'bg-zinc-900 border border-zinc-800/60 text-zinc-600 hover:text-zinc-300'
                     }`}
                   >
                     {region}
                   </button>
                 ))}
               </div>
             </div>

             <div className="flex-1 overflow-y-auto custom-scroll p-5 sm:p-8">
                {loading ? (
                  <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                     {[...Array(10)].map((_, i) => (
                       <div key={i} className="bg-zinc-900/40 rounded-3xl border border-zinc-800/50 h-72 animate-pulse"></div>
                     ))}
                  </div>
                ) : filteredCameras.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-10 animate-in fade-in zoom-in-95 duration-500">
                    <div className="w-20 h-20 bg-zinc-900 rounded-3xl border border-zinc-800 flex items-center justify-center mb-6 shadow-2xl">
                      <svg className="w-10 h-10 text-zinc-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                    </div>
                    <h3 className="text-lg font-bold text-zinc-300 mb-2">No surveillance nodes found</h3>
                    <button 
                      onClick={clearSearch}
                      className="px-8 py-3 bg-zinc-800 hover:bg-zinc-700 text-[10px] font-black uppercase tracking-widest text-zinc-300 rounded-2xl border border-zinc-700 transition-all active:scale-95"
                    >
                      Clear Search Parameters
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                    {filteredCameras.slice(0, visibleCount).map(camera => (
                      <CameraCard 
                        key={camera.id}
                        camera={camera}
                        isFavorite={favorites.includes(camera.id)}
                        onToggleFavorite={toggleFavorite}
                        onViewLive={setActiveModalCamera}
                      />
                    ))}
                    <div ref={observerTarget} className="h-20 w-full col-span-full flex items-center justify-center">
                       {visibleCount < filteredCameras.length && (
                         <div className="w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
                       )}
                    </div>
                  </div>
                )}
             </div>
          </div>
        ) : (
          <div className="flex-1 relative flex flex-col min-h-0">
            <CameraMap 
              cameras={filteredCameras}
              favorites={favorites}
              onToggleFavorite={toggleFavorite}
              onViewLive={setActiveModalCamera}
              routeOrigin={routeOrigin}
              routeDestination={routeDestination}
              onSetRouteOrigin={setRouteOrigin}
              onSetRouteDestination={setRouteDestination}
            />
          </div>
        )}
      </main>

      <LiveCommand />

      {activeModalCamera && (
        <ImageModal 
          camera={activeModalCamera}
          onClose={() => setActiveModalCamera(null)}
        />
      )}
    </div>
  );
};

export default App;
