
// Fix: remove responseMimeType and responseSchema from googleMaps tool usage per guidelines.
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

  async searchAddress(query: string): Promise<{ lat: number; lng: number; label: string } | null> {
    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Find the exact latitude and longitude for the address: "${query}" in New Zealand. Return only a JSON object like {"lat": -36.8, "lng": 174.7, "label": "Address Name"}.`,
        config: {
          tools: [{ googleMaps: {} }]
          // responseMimeType and responseSchema removed as they are prohibited with googleMaps tool
        }
      });
      // Extracting JSON from text response as grounding tools don't support structured output config
      const text = response.text || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch (e) {
      console.error("Address search failed:", e);
      return null;
    }
  }

  async analyzeCongestion(imageUrl: string): Promise<CongestionAnalysis> {
    const cacheKey = `congestion_${imageUrl}`;
    const cached = this.getCached<CongestionAnalysis>(cacheKey);
    if (cached) return cached;

    try {
      const parts: any[] = [{ 
        text: `Analyze this New Zealand traffic camera feed. 
        You must classify the traffic density exactly as one of these: 'light', 'moderate', or 'heavy'.
        Base your classification on vehicle density and spacing.
        Provide a concise reasoning (max 10 words).` 
      }];

      try {
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(blob);
        });
        parts.push({
          inlineData: {
            mimeType: blob.type || 'image/jpeg',
            data: base64
          }
        });
      } catch (e) {
        parts[0].text += `\nReference Image URL: ${imageUrl}.`;
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
      return { level: 'unknown', reasoning: 'Prediction offline.', timestamp: '' };
    }
  }

  async getWeatherIntelligence(lat: number, lng: number): Promise<{ temp: string; condition: string; visibility: string }> {
    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Provide the current weather conditions at coordinates (${lat}, ${lng}) in New Zealand. Respond only with a JSON object.`,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              temp: { type: Type.STRING, description: "e.g. 18°C" },
              condition: { type: Type.STRING, description: "e.g. Overcast" },
              visibility: { type: Type.STRING, description: "e.g. Good" }
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

  async getTransportIntelligence(lat: number, lng: number): Promise<{ name: string; type: string; lat: number; lng: number }[]> {
    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Find major public transport hubs (train stations, ferry terminals) near (${lat}, ${lng}) in New Zealand. Return a JSON array of objects.`,
        config: {
          tools: [{ googleMaps: {} }]
          // responseMimeType and responseSchema removed as they are prohibited with googleMaps tool
        }
      });
      const text = response.text || '';
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    } catch (e) {
      return [];
    }
  }

  async playBriefingAudio(text: string) {
    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Say in a professional tactical voice: ${text}` }] }],
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
      console.error("TTS failed:", error);
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
        contents: { parts: [{ text: `A highly realistic New Zealand road scenario visualization: ${prompt}. Photorealistic, cinematic lighting, 8k.` }] },
        config: {
          imageConfig: { aspectRatio: aspectRatio as any, imageSize: "1K" }
        },
      });
      
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
      throw new Error("No image data returned");
    } catch (error: any) {
      console.error("Image generation failed:", error);
      throw error;
    }
  }

  async getAIPredictedTime(origin: string, dest: string, baseTime: string): Promise<{ predictedTime: string; factor: string }> {
    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analyze the route from ${origin} to ${dest} in New Zealand. Base driving time is ${baseTime}. Predict an adjusted travel time accounting for potential congestion or future incidents. Respond with a JSON object.`,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              predictedTime: { type: Type.STRING, description: "Formatted time e.g. 45m" },
              factor: { type: Type.STRING, description: "Brief explanation of the adjustment e.g. 'Peak hour flow'" }
            },
            required: ['predictedTime', 'factor']
          }
        }
      });
      return JSON.parse(response.text || '{}');
    } catch (error) {
      return { predictedTime: baseTime, factor: "Normal flow" };
    }
  }

  async getRouteBriefing(origin: string, dest: string, distance: string, time: string): Promise<string> {
    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `I am planning a trip from ${origin} to ${dest} in New Zealand. OSRM estimates ${distance} and ${time}. Provide a tactical briefing under 50 words.`,
        config: { tools: [{ googleMaps: {} }] }
      });
      return response.text || "Sync failed.";
    } catch (error) {
      return "Unable to synchronize path intelligence.";
    }
  }

  async getNearbyContext(lat: number, lng: number, cameraName: string): Promise<{ text: string; links: MapGroundingResult[] }> {
    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Identify routes and landmarks around ${cameraName} (${lat}, ${lng}).`,
        config: {
          tools: [{ googleMaps: {} }],
          toolConfig: { retrievalConfig: { latLng: { latitude: lat, longitude: lng } } }
        }
      });
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const links = chunks.filter((c: any) => c.maps).map((c: any) => ({ title: c.maps.title, uri: c.maps.uri }));
      return { text: response.text || "No context found.", links };
    } catch (error) {
      return { text: "Grounding unavailable.", links: [] };
    }
  }

  async getRegionalTrafficNews(region: string, location: string): Promise<SearchGroundingResult> {
    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Search for road incidents, accidents, or events near ${location}, ${region} NZ in the last 24h.`,
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
        contents: `Strategic assessment for "${camera.name}" node in NZ matrix. Suggest structural optimizations.`,
        config: { thinkingConfig: { thinkingBudget: 32768 } }
      });
      return { response: response.text || "Error." };
    } catch (error) {
      return { response: "Logic offline." };
    }
  }
}

export const geminiService = new GeminiService();
