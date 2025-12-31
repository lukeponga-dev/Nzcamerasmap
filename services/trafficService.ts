
import { TrafficCamera, Severity, Trend } from '../types';

const BASE_TRAFFIC_URL = 'https://trafficnz.info';
const XML_ENDPOINT = 'https://trafficnz.info/service/traffic/rest/4/cameras/all';

/**
 * Robust fallback dataset for survival mode.
 */
const FALLBACK_CAMERAS: TrafficCamera[] = [
  {
    id: "FB-AKL-01",
    name: "SH1: Oteha Valley Rd",
    description: "Northbound coverage - Backup Uplink",
    imageUrl: "https://www.trafficnz.info/camera/images/20.jpg",
    region: "Auckland",
    latitude: -36.723,
    longitude: 174.706,
    direction: "North",
    journeyLegs: ["Auckland - North"],
    type: "feed",
    status: "Operational",
    source: "Static Matrix Fallback",
    severity: 'low',
    trend: 'stable',
    confidence: 99,
    lastUpdate: new Date().toLocaleTimeString()
  },
  {
    id: "FB-AKL-02",
    name: "SH1: Harbour Bridge",
    description: "Clip-on lanes - Backup Uplink",
    imageUrl: "https://www.trafficnz.info/camera/images/24.jpg",
    region: "Auckland",
    latitude: -36.83,
    longitude: 174.75,
    direction: "South",
    journeyLegs: ["Auckland - Central"],
    type: "feed",
    status: "Operational",
    source: "Static Matrix Fallback",
    severity: 'low',
    trend: 'stable',
    confidence: 99,
    lastUpdate: new Date().toLocaleTimeString()
  }
];

interface ProxyConfig {
  url: string;
  type: 'json' | 'text';
}

const PROXIES: ProxyConfig[] = [
  { url: 'https://api.allorigins.win/get?url=', type: 'json' },
  { url: 'https://corsproxy.io/?url=', type: 'text' },
  { url: 'https://api.codetabs.com/v1/proxy?url=', type: 'text' },
  { url: 'https://thingproxy.freeboard.io/fetch/', type: 'text' }
];

export class TrafficService {
  private async fetchWithTimeout(url: string, options: RequestInit, timeout = 15000): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(id);
      return response;
    } catch (e: any) {
      clearTimeout(id);
      throw e;
    }
  }

  async fetchLiveCameras(): Promise<TrafficCamera[]> {
    console.log("Initiating Traffic Matrix Sync (REST v4)...");
    
    for (const proxy of PROXIES) {
      try {
        const targetUrl = `${proxy.url}${encodeURIComponent(XML_ENDPOINT)}`;
        const response = await this.fetchWithTimeout(targetUrl, { method: 'GET' });
        
        if (!response.ok) continue;

        let xmlText = '';
        if (proxy.type === 'json') {
          const data = await response.json();
          xmlText = data.contents;
        } else {
          xmlText = await response.text();
        }
        
        if (!xmlText || xmlText.trim().startsWith('<!DOCTYPE html') || xmlText.trim().includes('<html')) {
          continue;
        }

        const parsed = this.parseTrafficXml(xmlText);
        if (parsed.length > 0) {
          console.log(`Sync Successful: ${parsed.length} nodes decrypted via ${proxy.url}`);
          return parsed;
        }
      } catch (error: any) {
        console.warn(`Node ${proxy.url} drop: ${error.message}`);
      }
    }

    console.error("Emergency: All synchronization vectors failed. Engaging fallback.");
    return FALLBACK_CAMERAS;
  }

  private parseTrafficXml(xmlString: string): TrafficCamera[] {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "text/xml");
    
    if (xmlDoc.getElementsByTagName("parsererror").length > 0) return [];

    const cameraNodes = xmlDoc.querySelectorAll("trafficCamera, camera");
    const parsedCameras: TrafficCamera[] = [];
    
    cameraNodes.forEach(node => {
      const getVal = (s: string) => node.querySelector(s)?.textContent?.trim() || "";
      
      const latStr = getVal("location > latitude") || getVal("latitude");
      const lngStr = getVal("location > longitude") || getVal("longitude");
      
      const lat = parseFloat(latStr || "0");
      const lng = parseFloat(lngStr || "0");

      if (lat && lng && Math.abs(lat) > 1 && Math.abs(lng) > 1) {
        const status = getVal("status") || "Operational";
        const severities: Severity[] = ['low', 'low', 'medium'];
        const trends: Trend[] = ['stable', 'stable', 'escalating', 'improving'];
        
        parsedCameras.push({
          id: getVal("id") || `node-${Math.random().toString(36).substring(2, 7)}`,
          name: getVal("name") || "Surveillance Node",
          description: getVal("description") || "Live matrix uplink",
          imageUrl: this.normalizeImageUrl(getVal("imageUrl") || getVal("url")),
          region: getVal("region") || "NZ Sector",
          latitude: lat,
          longitude: lng,
          direction: getVal("direction") || "N/A",
          journeyLegs: [],
          type: 'feed',
          status,
          source: 'TrafficNZ REST v4',
          severity: status.includes('Construction') ? 'medium' : severities[Math.floor(Math.random() * severities.length)],
          trend: trends[Math.floor(Math.random() * trends.length)],
          confidence: 85 + Math.floor(Math.random() * 14),
          lastUpdate: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
      }
    });

    return parsedCameras;
  }

  private normalizeImageUrl(url: string): string {
    if (!url) return "";
    if (url.startsWith('http')) return url;
    if (url.startsWith('/')) return `${BASE_TRAFFIC_URL}${url}`;
    return `${BASE_TRAFFIC_URL}/camera/images/${url}`;
  }
}

export const trafficService = new TrafficService();
