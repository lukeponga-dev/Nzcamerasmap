
// Add missing React import
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { TrafficCamera, MapGroundingResult, Severity } from '../types';
import { geminiService } from '../services/geminiService';

declare const L: any;

interface CameraMapProps {
  cameras: TrafficCamera[];
  favorites: string[];
  onToggleFavorite: (id: string) => void;
  onViewLive: (camera: TrafficCamera) => void;
  routeOrigin: TrafficCamera | null;
  routeDestination: TrafficCamera | null;
  onSetRouteOrigin: (camera: TrafficCamera | null) => void;
  onSetRouteDestination: (camera: TrafficCamera | null) => void;
}

const SEVERITY_COLORS: Record<Severity, string> = {
  low: '#3b82f6',
  medium: '#f59e0b',
  high: '#ef4444',
  critical: '#d946ef'
};

const CameraMap: React.FC<CameraMapProps> = ({ 
  cameras, 
  onViewLive,
  routeOrigin,
  routeDestination,
  onSetRouteOrigin,
  onSetRouteDestination
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const clusterGroupRef = useRef<any>(null);
  const routeLayerRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);
  
  // Tactical Layers Refs
  const weatherLayerRef = useRef<any>(null);
  const transportLayerRef = useRef<any>(null);
  const hazardLayerRef = useRef<any>(null);

  const [routeBriefing, setRouteBriefing] = useState<string | null>(null);
  const [showBriefing, setShowBriefing] = useState(false);
  const [routeStats, setRouteStats] = useState<{ distance: string; duration: string; aiPredicted?: string; aiFactor?: string } | null>(null);
  const [isBriefingLoading, setIsBriefingLoading] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  
  // HUD State
  const [addressQuery, setAddressQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [activeLayers, setActiveLayers] = useState<Set<string>>(new Set());
  const [isLayerLoading, setIsLayerLoading] = useState<string | null>(null);

  const handleClearRoute = useCallback(() => {
    onSetRouteOrigin(null);
    onSetRouteDestination(null);
    setRouteStats(null);
    setRouteBriefing(null);
    setShowBriefing(false);
    if (routeLayerRef.current && mapRef.current) {
      mapRef.current.removeLayer(routeLayerRef.current);
      routeLayerRef.current = null;
    }
  }, [onSetRouteOrigin, onSetRouteDestination]);

  const handlePlayBriefing = async () => {
    if (!routeBriefing || isPlayingAudio) return;
    setIsPlayingAudio(true);
    await geminiService.playBriefingAudio(routeBriefing);
    setTimeout(() => setIsPlayingAudio(false), 5000);
  };

  const handleAddressSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addressQuery.trim()) return;
    setIsSearching(true);
    const result = await geminiService.searchAddress(addressQuery);
    if (result && mapRef.current) {
      mapRef.current.setView([result.lat, result.lng], 15);
      L.popup()
        .setLatLng([result.lat, result.lng])
        .setContent(`<div class="p-3 bg-[#18181b] text-white rounded-xl border border-blue-500/30 text-[10px] font-bold uppercase">${result.label}</div>`)
        .openOn(mapRef.current);
    }
    setIsSearching(false);
    setAddressQuery('');
  };

  const toggleLayer = async (layerId: string) => {
    if (!mapRef.current) return;
    
    const newLayers = new Set(activeLayers);
    if (newLayers.has(layerId)) {
      newLayers.delete(layerId);
      if (layerId === 'weather') mapRef.current.removeLayer(weatherLayerRef.current);
      if (layerId === 'transport') mapRef.current.removeLayer(transportLayerRef.current);
      if (layerId === 'hazards') mapRef.current.removeLayer(hazardLayerRef.current);
      setActiveLayers(newLayers);
      return;
    }

    newLayers.add(layerId);
    setActiveLayers(newLayers);
    setIsLayerLoading(layerId);
    
    const center = mapRef.current.getCenter();
    
    try {
      if (layerId === 'weather') {
        const data = await geminiService.getWeatherIntelligence(center.lat, center.lng);
        const icon = L.divIcon({
          html: `<div class="relative flex flex-col items-center group">
            <div class="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/30 backdrop-blur-md flex items-center justify-center animate-pulse">
              <span class="text-[10px] font-black text-blue-400">${data.temp}</span>
            </div>
            <div class="absolute -bottom-8 whitespace-nowrap px-2 py-0.5 bg-black/80 rounded border border-white/10 text-[8px] font-black text-white uppercase opacity-0 group-hover:opacity-100 transition-opacity">${data.condition}</div>
          </div>`,
          className: 'weather-icon',
          iconSize: [48, 48]
        });
        weatherLayerRef.current = L.featureGroup([L.marker([center.lat, center.lng], { icon })]).addTo(mapRef.current);
      } 
      else if (layerId === 'transport') {
        const hubs = await geminiService.getTransportIntelligence(center.lat, center.lng);
        const markers = hubs.map(hub => {
          const icon = L.divIcon({
            html: `<div class="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-700 flex items-center justify-center shadow-xl">
              <svg class="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 17a2 2 0 100 4 2 2 0 000-4zm11 0a2 2 0 100 4 2 2 0 000-4zM7 17h10V9H7v8zM7 9l1-2h8l1 2M5 19h14"/></svg>
            </div>`,
            className: 'transport-icon',
            iconSize: [32, 32]
          });
          return L.marker([hub.lat, hub.lng], { icon }).bindPopup(`<div class="text-[10px] font-black text-white p-2 uppercase">${hub.name} (${hub.type})</div>`);
        });
        transportLayerRef.current = L.featureGroup(markers).addTo(mapRef.current);
      }
      else if (layerId === 'hazards') {
        const centerNews = await geminiService.getRegionalTrafficNews('Current Matrix', `near lat:${center.lat} lng:${center.lng}`);
        const icon = L.divIcon({
          html: `<div class="relative">
            <div class="absolute inset-0 bg-red-600/20 rounded-full animate-ping"></div>
            <div class="w-10 h-10 rounded-full bg-red-600 border-2 border-white flex items-center justify-center shadow-2xl relative">
              <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
            </div>
          </div>`,
          className: 'hazard-icon',
          iconSize: [40, 40]
        });
        hazardLayerRef.current = L.featureGroup([L.marker([center.lat, center.lng], { icon }).bindPopup(`<div class="p-3 bg-black text-white text-[9px] font-bold uppercase w-48 leading-relaxed">${centerNews.text}</div>`)]).addTo(mapRef.current);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLayerLoading(null);
    }
  };

  const locateUser = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      const { latitude, longitude } = pos.coords;
      if (mapRef.current) {
        mapRef.current.setView([latitude, longitude], 15);
        if (userMarkerRef.current) mapRef.current.removeLayer(userMarkerRef.current);
        userMarkerRef.current = L.circleMarker([latitude, longitude], {
          radius: 8,
          color: '#3b82f6',
          fillColor: '#3b82f6',
          fillOpacity: 1,
          weight: 2
        }).addTo(mapRef.current);
      }
    });
  };

  const calculateRoute = useCallback(async (origin: TrafficCamera, dest: TrafficCamera) => {
    try {
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${origin.longitude},${origin.latitude};${dest.longitude},${dest.latitude}?overview=full&geometries=geojson`
      );
      const data = await response.json();
      
      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const coordinates = route.geometry.coordinates.map((coord: [number, number]) => [coord[1], coord[0]]);
        
        if (routeLayerRef.current && mapRef.current) mapRef.current.removeLayer(routeLayerRef.current);
        
        routeLayerRef.current = L.polyline(coordinates, {
          color: '#3b82f6',
          weight: 5,
          opacity: 0.9,
          lineJoin: 'round',
          dashArray: '10, 15',
          className: 'animate-route-flow shadow-[0_0_15px_rgba(59,130,246,0.5)]'
        }).addTo(mapRef.current);
        
        mapRef.current.fitBounds(routeLayerRef.current.getBounds(), { padding: [60, 60] });

        const distKm = (route.distance / 1000).toFixed(1) + 'km';
        const timeMin = Math.round(route.duration / 60) + 'm';
        
        setRouteStats({ distance: distKm, duration: timeMin });
        setIsBriefingLoading(true);
        
        const [brief, aiPred] = await Promise.all([
          geminiService.getRouteBriefing(origin.name, dest.name, distKm, timeMin),
          geminiService.getAIPredictedTime(origin.name, dest.name, timeMin)
        ]);

        setRouteStats(prev => prev ? { ...prev, aiPredicted: aiPred.predictedTime, aiFactor: aiPred.factor } : null);
        setRouteBriefing(brief);
        setShowBriefing(true);
        setIsBriefingLoading(false);
      }
    } catch (error) {
      setIsBriefingLoading(false);
    }
  }, []);

  useEffect(() => {
    if (routeOrigin && routeDestination) calculateRoute(routeOrigin, routeDestination);
  }, [routeOrigin, routeDestination, calculateRoute]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    mapRef.current = L.map(mapContainerRef.current, {
      center: [-36.8485, 174.7633], 
      zoom: 12,
      maxZoom: 20,
      zoomControl: false,
      attributionControl: false
    });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 20 }).addTo(mapRef.current);
    return () => { if (mapRef.current) mapRef.current.remove(); };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    if (clusterGroupRef.current) mapRef.current.removeLayer(clusterGroupRef.current);
    clusterGroupRef.current = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 40,
      iconCreateFunction: (cluster: any) => {
        const count = cluster.getChildCount();
        return L.divIcon({
          html: `<div class="relative w-10 h-10 flex items-center justify-center">
              <div class="absolute inset-0 rounded-full bg-blue-600/20 animate-pulse border border-blue-500/30"></div>
              <span class="text-[11px] font-black text-blue-400 z-10">${count}</span>
            </div>`,
          className: 'custom-cluster-icon',
          iconSize: [40, 40]
        });
      }
    });

    cameras.forEach(camera => {
      const isOrigin = routeOrigin?.id === camera.id;
      const isDest = routeDestination?.id === camera.id;
      const color = isOrigin ? '#10b981' : isDest ? '#f59e0b' : SEVERITY_COLORS[camera.severity];
      const iconHtml = `
        <div class="relative group cursor-pointer">
          ${isOrigin || isDest ? `<div class="absolute inset-[-32px] flex items-center justify-center pointer-events-none">
              <div class="absolute w-full h-full rounded-full border-2 border-dashed animate-spin duration-[15s]" style="border-color: ${color}44"></div>
              <div class="absolute inset-2 rounded-full status-pulse" style="background: radial-gradient(circle, ${color}33 0%, transparent 70%)"></div>
            </div>` : ''}
          <div class="relative w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 border-white/10 flex items-center justify-center transition-all bg-[#09090b] shadow-xl group-hover:scale-125 overflow-visible" style="border-color: ${isOrigin || isDest ? color : 'rgba(255,255,255,0.1)'}">
             <div class="w-2.5 h-2.5 rounded-full ${isOrigin || isDest ? 'animate-ping' : ''}" style="background-color: ${color}"></div>
          </div>
        </div>
      `;
      const marker = L.marker([camera.latitude, camera.longitude], { 
        icon: L.divIcon({ html: iconHtml, className: 'custom-marker', iconSize: [40, 40], iconAnchor: [20, 20] })
      });
      const popupHtml = `<div class="p-4 bg-[#18181b] text-white rounded-2xl min-w-[260px] border border-zinc-800 shadow-2xl overflow-hidden relative"><div class="absolute top-0 left-0 w-full h-1" style="background: ${color}"></div><h4 class="font-bold text-sm mb-3 mt-1">${camera.name}</h4><div class="grid grid-cols-2 gap-2 mb-4"><button id="set-origin-${camera.id}" class="py-2.5 bg-emerald-600/10 hover:bg-emerald-600 text-emerald-500 hover:text-white text-[10px] font-black uppercase rounded-lg border border-emerald-500/20 transition-all ${isOrigin ? 'ring-2 ring-emerald-500' : ''}">Origin</button><button id="set-dest-${camera.id}" class="py-2.5 bg-amber-600/10 hover:bg-amber-600 text-amber-500 hover:text-white text-[10px] font-black uppercase rounded-lg border border-amber-500/20 transition-all ${isDest ? 'ring-2 ring-amber-500' : ''}">Target</button></div><button id="view-feed-${camera.id}" class="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white text-[10px] font-black uppercase rounded-lg transition-all active:scale-95">Engage Feed</button></div>`;
      marker.bindPopup(popupHtml, { closeButton: false, offset: [0, -10] });
      marker.on('popupopen', () => {
        document.getElementById(`set-origin-${camera.id}`)?.addEventListener('click', () => onSetRouteOrigin(camera));
        document.getElementById(`set-dest-${camera.id}`)?.addEventListener('click', () => onSetRouteDestination(camera));
        document.getElementById(`view-feed-${camera.id}`)?.addEventListener('click', () => onViewLive(camera));
      });
      clusterGroupRef.current.addLayer(marker);
    });
    mapRef.current.addLayer(clusterGroupRef.current);
  }, [cameras, routeOrigin, routeDestination, onSetRouteOrigin, onSetRouteDestination, onViewLive]);

  return (
    <div className="relative w-full h-full bg-[#09090b] overflow-hidden">
      <div ref={mapContainerRef} className="w-full h-full z-10" />

      {/* Layer Control HUD (Right Sidebar) */}
      <div className="absolute top-24 right-6 z-[400] flex flex-col gap-3">
         <div className="bg-[#0c0a09]/80 backdrop-blur-2xl border border-white/10 rounded-2xl p-2 flex flex-col gap-2 shadow-2xl">
            <h4 className="text-[8px] font-black text-zinc-600 uppercase tracking-widest text-center py-1">Layer HUD</h4>
            {[
              { id: 'weather', icon: 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z' },
              { id: 'transport', icon: 'M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H5a2 2 0 00-2 2v5a2 2 0 002 2z M9 9h6 M11 15h2' },
              { id: 'hazards', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' }
            ].map(layer => (
              <button
                key={layer.id}
                onClick={() => toggleLayer(layer.id)}
                className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all active:scale-90 relative ${
                  activeLayers.has(layer.id) ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-zinc-900/50 text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {isLayerLoading === layer.id ? (
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={layer.icon}/>
                  </svg>
                )}
                {activeLayers.has(layer.id) && (
                  <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-blue-400 rounded-full border-2 border-[#09090b] animate-pulse"></div>
                )}
              </button>
            ))}
         </div>
      </div>

      {/* Map Control HUD (Left Sidebar) */}
      <div className="absolute top-24 left-6 z-[400] flex flex-col gap-4 w-full max-w-sm">
        <form onSubmit={handleAddressSearch} className="relative group">
          <input 
            type="text" 
            placeholder="Search address or landmark..." 
            value={addressQuery}
            onChange={(e) => setAddressQuery(e.target.value)}
            className="w-full bg-[#0c0a09]/95 backdrop-blur-xl border border-white/10 rounded-2xl px-5 py-3.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/50 shadow-2xl"
          />
          <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-zinc-500 hover:text-blue-500 transition-colors">
            {isSearching ? (
              <div className="w-4 h-4 border-2 border-zinc-700 border-t-blue-500 rounded-full animate-spin"></div>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            )}
          </button>
        </form>

        <button 
          onClick={locateUser}
          className="w-fit bg-[#0c0a09]/95 backdrop-blur-xl border border-white/10 rounded-2xl px-5 py-3 flex items-center gap-3 shadow-2xl hover:border-blue-500/50 transition-all active:scale-95"
        >
          <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
          <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Fix Position</span>
        </button>
      </div>

      {/* Origin/Destination Selection HUD */}
      {routeOrigin && !routeDestination && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-[450] animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="bg-blue-600/90 backdrop-blur-xl px-6 py-2.5 rounded-full shadow-[0_0_30px_rgba(59,130,246,0.5)] border border-blue-400/30 flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>
            <span className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Select Destination Camera</span>
          </div>
        </div>
      )}

      {routeStats && (
        <div className="absolute top-24 right-24 z-[400] animate-in slide-in-from-right-10 pointer-events-none">
           <div className="bg-[#0c0a09]/95 backdrop-blur-3xl border border-blue-500/30 p-5 rounded-3xl shadow-2xl flex flex-col gap-5 pointer-events-auto min-w-[240px]">
              <div className="flex justify-between items-center">
                 <h4 className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Vector Params</h4>
                 <div className="flex gap-2">
                    <button onClick={handlePlayBriefing} className={`p-2 bg-zinc-900 rounded-lg border border-zinc-800 text-blue-400 transition-colors hover:bg-zinc-800 ${isPlayingAudio ? 'animate-pulse' : ''}`}>
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M14,3.23V5.29C16.89,6.15 19,8.83 19,12C19,15.17 16.89,17.85 14,18.71V20.77C18.07,19.86 21,16.28 21,12C21,7.72 18.07,4.14 14,3.23M16.5,12C16.5,10.23 15.5,8.71 14,7.97V16.02C15.5,15.29 16.5,13.77 16.5,12M3,9V15H7L12,20V4L7,9H3Z"/></svg>
                    </button>
                    <button onClick={handleClearRoute} className="p-2 bg-zinc-900 rounded-lg border border-zinc-800 text-red-500 transition-colors hover:bg-red-900/20">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                 </div>
              </div>
              
              <div className="space-y-4">
                <div className="flex justify-between items-end border-b border-zinc-800/50 pb-2">
                  <div className="flex flex-col"><span className="text-[8px] font-black text-zinc-600 uppercase">Distance</span><span className="text-xl font-black text-blue-400 mono">{routeStats.distance}</span></div>
                  <div className="flex flex-col items-end"><span className="text-[8px] font-black text-zinc-600 uppercase">Est. Base</span><span className="text-xl font-black text-emerald-400 mono">{routeStats.duration}</span></div>
                </div>

                {routeStats.aiPredicted && (
                  <div className="bg-blue-600/10 border border-blue-500/20 rounded-2xl p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest">Tactical Forecast</span>
                      <div className="w-1 h-1 bg-blue-500 rounded-full animate-pulse"></div>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-2xl font-black text-white mono">{routeStats.aiPredicted}</span>
                      <span className="text-[8px] font-bold text-blue-400/60 uppercase">{routeStats.aiFactor}</span>
                    </div>
                  </div>
                )}
              </div>

              <button onClick={() => setShowBriefing(!showBriefing)} className="w-full py-2 bg-zinc-900 text-[9px] font-black text-blue-500 uppercase rounded-xl border border-zinc-800 active:scale-95 transition-all">
                {showBriefing ? 'Hide Intelligence' : 'View Intelligence'}
              </button>
           </div>
        </div>
      )}

      {routeBriefing && showBriefing && (
        <div className="absolute inset-x-0 bottom-0 sm:bottom-auto sm:top-24 sm:left-1/2 sm:transform sm:-translate-x-1/2 z-[500] w-full max-w-xl px-0 sm:px-4 animate-in slide-in-from-bottom sm:zoom-in-95 duration-500">
           <div className="bg-[#09090b]/98 border-t sm:border border-blue-500/40 p-6 sm:p-8 rounded-t-[2rem] sm:rounded-[3rem] shadow-2xl backdrop-blur-4xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500/20 via-blue-500 to-blue-500/20"></div>
              <div className="flex items-center justify-between mb-4">
                 <h3 className="text-[10px] font-black text-blue-500 uppercase tracking-[0.5em]">Tactical Feed</h3>
                 <button onClick={handlePlayBriefing} className="flex items-center gap-2 px-3 py-1 bg-blue-600/10 rounded-full border border-blue-500/20 text-blue-500 text-[8px] font-black uppercase tracking-widest active:scale-95 transition-all">Listen</button>
              </div>
              <div className="bg-zinc-900/50 rounded-2xl p-5 border border-zinc-800 italic text-sm text-zinc-300 shadow-inner">"{routeBriefing}"</div>
              <button onClick={() => setShowBriefing(false)} className="mt-4 w-full text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em] hover:text-zinc-400 transition-colors">Dismiss</button>
           </div>
        </div>
      )}

      <div className="absolute bottom-6 right-6 z-[400] flex flex-col gap-3">
         <div className="flex flex-col bg-zinc-900/90 border-2 border-zinc-800 rounded-2xl overflow-hidden shadow-2xl">
           <button onClick={() => mapRef.current?.zoomIn()} className="w-12 h-12 text-zinc-400 flex items-center justify-center font-bold text-xl active:bg-zinc-800 transition-colors">+</button>
           <button onClick={() => mapRef.current?.zoomOut()} className="w-12 h-12 text-zinc-400 flex items-center justify-center font-bold text-xl active:bg-zinc-800 transition-colors">-</button>
         </div>
      </div>
    </div>
  );
};

export default CameraMap;
