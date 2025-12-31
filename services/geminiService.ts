
import { GoogleGenAI, Type, Modality, LiveServerMessage } from "@google/genai";
import { CongestionAnalysis, MapGroundingResult, SearchGroundingResult, AdvancedIntelligence } from "../types";

export class GeminiService {
  private cache: Map<string, any> = new Map();

  public get ai() {
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  private getCached<T>(key: string): T | null {
    return this.cache.get(key) || null;
  }

  private setCache(key: string, value: any) {
    this.cache.set(key, value);
  }

  /**
   * Proxies image fetch to bypass CORS for client-side AI analysis
   */
  private async fetchImageAsBase64(url: string): Promise<{ data: string, mimeType: string } | null> {
    const proxies = [
      'https://api.allorigins.win/get?url=',
      'https://corsproxy.io/?url=',
    ];

    for (const proxy of proxies) {
      try {
        const targetUrl = `${proxy}${encodeURIComponent(url)}`;
        const res = await fetch(targetUrl);
        if (!res.ok) continue;

        let blob: Blob;
        if (proxy.includes('allorigins')) {
          const json = await res.json();
          const base64Content = json.contents.split(',')[1] || json.contents;
          return { data: base64Content, mimeType: 'image/jpeg' };
        } else {
          blob = await res.blob();
          const reader = new FileReader();
          return await new Promise((resolve) => {
            reader.onloadend = () => {
              const base64 = (reader.result as string).split(',')[1];
              resolve({ data: base64, mimeType: blob.type || 'image/jpeg' });
            };
            reader.readAsDataURL(blob);
          });
        }
      } catch (e) {
        console.warn("Image proxy failed:", proxy);
      }
    }
    return null;
  }

  async searchAddress(query: string): Promise<{ lat: number; lng: number; label: string } | null> {
    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Find the exact latitude and longitude for: "${query}" in New Zealand. Return only a JSON object: {"lat": -36.8, "lng": 174.7, "label": "Address Name"}.`,
        config: { tools: [{ googleMaps: {} }] }
      });
      const text = response.text || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch (e) {
      return null;
    }
  }

  async analyzeCongestion(imageUrl: string): Promise<CongestionAnalysis> {
    const cacheKey = `congestion_${imageUrl}`;
    const cached = this.getCached<CongestionAnalysis>(cacheKey);
    if (cached) return cached;

    try {
      const imageData = await this.fetchImageAsBase64(imageUrl);
      const parts: any[] = [{ 
        text: `Tactical Assessment: Analyze this traffic feed from New Zealand. 
        Classify density: 'light', 'moderate', or 'heavy'. 
        Be extremely concise (max 10 words logic).` 
      }];

      if (imageData) {
        parts.push({
          inlineData: {
            mimeType: imageData.mimeType,
            data: imageData.data
          }
        });
      } else {
        parts[0].text += `\nReference (External Feed): ${imageUrl}`;
      }
      
      const genResponse = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              level: { type: Type.STRING, enum: ['light', 'moderate', 'heavy'] },
              reasoning: { type: Type.STRING }
            },
            required: ['level', 'reasoning']
          }
        }
      });

      const data = JSON.parse(genResponse.text || '{}');
      const result = {
        level: data.level || 'unknown',
        reasoning: data.reasoning || 'Visual analysis complete.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      return { level: 'unknown', reasoning: 'Intelligence offline.', timestamp: '' };
    }
  }

  async getWeatherIntelligence(lat: number, lng: number): Promise<{ temp: string; condition: string; visibility: string }> {
    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Current weather at coordinates (${lat}, ${lng}), NZ. Use Google Search. JSON format.`,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              temp: { type: Type.STRING },
              condition: { type: Type.STRING },
              visibility: { type: Type.STRING }
            },
            required: ["temp", "condition", "visibility"]
          }
        }
      });
      return JSON.parse(response.text || '{}');
    } catch (e) {
      return { temp: "N/A", condition: "Unknown", visibility: "Unknown" };
    }
  }

  async playBriefingAudio(text: string) {
    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Tactical briefing: ${text}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Zephyr' },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        const data = this.decodeBase64(base64Audio);
        const audioBuffer = await this.decodeAudioData(data, audioCtx, 24000, 1);
        const source = audioCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioCtx.destination);
        source.start();
      }
    } catch (error) {
      console.error("Audio uplink failed.");
    }
  }

  decodeBase64(base64: string) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  async decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
      }
    }
    return buffer;
  }

  async generateProjection(prompt: string, aspectRatio: string = "16:9"): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: { parts: [{ text: `A highly realistic New Zealand road scenario visualization: ${prompt}. Photorealistic, 8k.` }] },
        config: {
          imageConfig: { aspectRatio: aspectRatio as any, imageSize: "1K" }
        },
      });
      
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
      throw new Error("Projection failed.");
    } catch (error: any) {
      throw error;
    }
  }

  async getAIPredictedTime(origin: string, dest: string, baseTime: string): Promise<{ predictedTime: string; factor: string }> {
    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Route: ${origin} to ${dest}, NZ. Base time: ${baseTime}. Predict congestion adjusted time using Google Search. JSON format.`,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              predictedTime: { type: Type.STRING },
              factor: { type: Type.STRING }
            },
            required: ['predictedTime', 'factor']
          }
        }
      });
      return JSON.parse(response.text || '{}');
    } catch (error) {
      return { predictedTime: baseTime, factor: "Stable flow" };
    }
  }

  async getRouteBriefing(origin: string, dest: string, distance: string, time: string): Promise<string> {
    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Tactical briefing for trip ${origin} to ${dest}, NZ. Params: ${distance}, ${time}. Max 40 words.`,
        config: { tools: [{ googleMaps: {} }] }
      });
      return response.text || "Intelligence sync error.";
    } catch (error) {
      return "Unable to synchronize path intelligence.";
    }
  }

  async getNearbyContext(lat: number, lng: number, cameraName: string): Promise<{ text: string; links: MapGroundingResult[] }> {
    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Context around ${cameraName} (${lat}, ${lng}). Landmarks and routes.`,
        config: {
          tools: [{ googleMaps: {} }],
          toolConfig: { retrievalConfig: { latLng: { latitude: lat, longitude: lng } } }
        }
      });
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const links = chunks.filter((c: any) => c.maps).map((c: any) => ({ title: c.maps.title, uri: c.maps.uri }));
      return { text: response.text || "No sector data.", links };
    } catch (error) {
      return { text: "Grounding offline.", links: [] };
    }
  }

  /**
   * Fix: Added missing getTransportIntelligence method to fetch transport hubs near coordinates using Google Maps grounding.
   */
  async getTransportIntelligence(lat: number, lng: number): Promise<{ lat: number; lng: number; name: string }[]> {
    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Identify major public transport hubs (train stations, ferry terminals, or bus interchanges) within 5km of coordinates (${lat}, ${lng}) in New Zealand. Return a JSON array of objects: [{"lat": number, "lng": number, "name": "string"}].`,
        config: {
          tools: [{ googleMaps: {} }],
          toolConfig: {
            retrievalConfig: {
              latLng: {
                latitude: lat,
                longitude: lng
              }
            }
          }
        }
      });
      const text = response.text || '';
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    } catch (e) {
      console.error("Transport intelligence failure", e);
      return [];
    }
  }

  async getRegionalTrafficNews(region: string, location: string): Promise<SearchGroundingResult> {
    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Urgent road incidents near ${location}, ${region} NZ last 24h.`,
        config: { tools: [{ googleSearch: {} }] }
      });
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const sources = chunks.filter((c: any) => c.web).map((c: any) => ({ title: c.web.title, uri: c.web.uri }));
      return { text: response.text || "No news.", sources };
    } catch (error) {
      return { text: "News offline.", sources: [] };
    }
  }

  async getDeepIntelligence(camera: any): Promise<AdvancedIntelligence> {
    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: `Deep analysis for node "${camera.name}" in NZ traffic matrix. Structural optimization suggestions.`,
        config: { thinkingConfig: { thinkingBudget: 32768 } }
      });
      return { response: response.text || "Logic error." };
    } catch (error) {
      return { response: "Reasoning logic offline." };
    }
  }
}

export const geminiService = new GeminiService();
