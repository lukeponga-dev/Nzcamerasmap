
export type CameraType = 'feed' | 'red-light' | 'spot-speed' | 'point-to-point';
export type Severity = 'low' | 'medium' | 'high' | 'critical';
export type Trend = 'improving' | 'stable' | 'escalating';

export interface TrafficCamera {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
  region: string;
  latitude: number;
  longitude: number;
  direction: string;
  journeyLegs: string[];
  type: CameraType;
  status: string;
  source: string;
  // Enhanced Intelligence Fields
  severity: Severity;
  trend: Trend;
  confidence: number; // 0-100
  lastUpdate: string;
}

export type CongestionLevel = 'light' | 'moderate' | 'heavy' | 'unknown';

export interface CongestionAnalysis {
  level: CongestionLevel;
  reasoning: string;
  timestamp: string;
}

export interface RouteData {
  distance: number; // in meters
  duration: number; // in seconds
  geometry: [number, number][];
}

export interface MapGroundingResult {
  title: string;
  uri: string;
}

export interface SearchGroundingResult {
  text: string;
  sources: { title: string; uri: string }[];
}

export interface AdvancedIntelligence {
  thought?: string;
  response: string;
}
