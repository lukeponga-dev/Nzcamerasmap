
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { geminiService } from '../services/geminiService';
import { Modality, LiveServerMessage } from '@google/genai';

const LiveCommand: React.FC = () => {
  const [isActive, setIsActive] = useState(false);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'active'>('idle');
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const encode = (bytes: Uint8Array) => {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  const createBlob = (data: Float32Array) => {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
      int16[i] = data[i] * 32768;
    }
    return {
      data: encode(new Uint8Array(int16.buffer)),
      mimeType: 'audio/pcm;rate=16000',
    };
  };

  const stopSession = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    sourcesRef.current.forEach(s => s.stop());
    sourcesRef.current.clear();
    setIsActive(false);
    setStatus('idle');
  }, []);

  const startSession = async () => {
    try {
      setStatus('connecting');
      const ai = geminiService.ai;
      
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const inputContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            setStatus('active');
            setIsActive(true);
            const source = inputContext.createMediaStreamSource(stream);
            const scriptProcessor = inputContext.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);
              sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputContext.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio && audioContextRef.current) {
              const ctx = audioContextRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              const data = geminiService.decodeBase64(base64Audio);
              const buffer = await geminiService.decodeAudioData(data, ctx, 24000, 1);
              const source = ctx.createBufferSource();
              source.buffer = buffer;
              source.connect(ctx.destination);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(source);
              source.onended = () => sourcesRef.current.delete(source);
            }
            if (message.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => s.stop());
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          },
          onerror: (e) => {
            console.error("Live Error:", e);
            stopSession();
          },
          onclose: () => stopSession()
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
          systemInstruction: 'You are the Traffic Command AI. Help the user with navigation, camera status, and traffic conditions in New Zealand. Keep responses tactical and concise.'
        }
      });

      sessionRef.current = await sessionPromise;
    } catch (e) {
      console.error("Live Init Failed:", e);
      setStatus('idle');
    }
  };

  return (
    <div className="fixed bottom-6 left-6 z-[1100]">
      <button
        onClick={isActive ? stopSession : startSession}
        className={`relative group w-14 h-14 rounded-full flex items-center justify-center transition-all duration-500 shadow-2xl overflow-hidden ${
          isActive 
            ? 'bg-red-600 scale-110 shadow-red-500/40 ring-4 ring-red-500/20' 
            : 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/30'
        }`}
      >
        {status === 'connecting' ? (
          <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
        ) : isActive ? (
          <div className="flex gap-1 items-center">
            <div className="w-1 h-4 bg-white animate-[pulse_1s_infinite]"></div>
            <div className="w-1 h-6 bg-white animate-[pulse_1.2s_infinite]"></div>
            <div className="w-1 h-4 bg-white animate-[pulse_0.8s_infinite]"></div>
          </div>
        ) : (
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-20a3 3 0 00-3 3v8a3 3 0 006 0V5a3 3 0 00-3-3z"/>
          </svg>
        )}
        
        <div className={`absolute -top-12 left-0 whitespace-nowrap bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 text-[9px] font-black uppercase tracking-widest text-white transition-opacity ${isActive || status === 'connecting' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          {status === 'idle' ? 'Live Command' : status === 'connecting' ? 'Initiating Link' : 'Link Active'}
        </div>
      </button>
    </div>
  );
};

export default LiveCommand;
