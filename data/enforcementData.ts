
import { TrafficCamera, CameraType } from '../types';

const rawData = [
    // RED LIGHT CAMERAS - AUCKLAND (33 Critical Nodes)
    { "id": "RL001", "type": "Red Light", "location": "Esmonde Road and Fred Thomas Drive, Takapuna", "region": "Auckland", "lat": -36.796787, "lng": 174.765623, "status": "Operational" },
    { "id": "RL002", "type": "Red Light", "location": "Dairy Flat Highway and Oteha Valley Road, Albany", "region": "Auckland", "lat": -36.726608, "lng": 174.69771, "status": "Operational" },
    { "id": "RL003", "type": "Red Light", "location": "Lincoln Road and Pomaria Road, Henderson", "region": "Auckland", "lat": -36.86235, "lng": 174.629207, "status": "Operational" },
    { "id": "RL004", "type": "Red Light", "location": "New North Road and Blockhouse Bay Road, Avondale", "region": "Auckland", "lat": -36.896632, "lng": 174.701437, "status": "Operational" },
    { "id": "RL005", "type": "Red Light", "location": "Ponsonby Road and Karangahape Road, Grey Lynn", "region": "Auckland", "lat": -36.859408, "lng": 174.752392, "status": "Operational" },
    { "id": "RL006", "type": "Red Light", "location": "Newton Road and Symonds Street, Auckland CBD", "region": "Auckland", "lat": -36.863567, "lng": 174.760372, "status": "Operational" },
    { "id": "RL007", "type": "Red Light", "location": "Union Street and Nelson Street, Auckland CBD", "region": "Auckland", "lat": -36.854033, "lng": 174.757917, "status": "Operational" },
    { "id": "RL008", "type": "Red Light", "location": "Hobson Street and Cook Street, Auckland CBD", "region": "Auckland", "lat": -36.85127, "lng": 174.760078, "status": "Operational" },
    { "id": "RL009", "type": "Red Light", "location": "Pakuranga Road and Aviemore Drive, Bucklands Beach", "region": "Auckland", "lat": -36.897582, "lng": 174.905981, "status": "Operational" },
    { "id": "RL010", "type": "Red Light", "location": "Te Irirangi Drive and Smales Road, East Tamaki", "region": "Auckland", "lat": -36.941756, "lng": 174.908678, "status": "Operational" },
    { "id": "RL011", "type": "Red Light", "location": "Main Highway and Great South Road, Ellerslie", "region": "Auckland", "lat": -36.894302, "lng": 174.79942, "status": "Operational" },
    { "id": "RL012", "type": "Red Light", "location": "Te Irirangi Drive and Accent Drive, Flat Bush", "region": "Auckland", "lat": -36.95459, "lng": 174.904907, "status": "Operational" },
    { "id": "RL013", "type": "Red Light", "location": "Glenfield Road and Kaipatiki Road, Glenfield", "region": "Auckland", "lat": -36.782463, "lng": 174.720762, "status": "Operational" },
    { "id": "RL014", "type": "Red Light", "location": "Ti Rakau Drive and Te Irirangi Drive, Golflands", "region": "Auckland", "lat": -36.92879, "lng": 174.91201, "status": "Operational" },
    { "id": "RL015", "type": "Red Light", "location": "Botany Road and Ti Rakau Drive, Golflands", "region": "Auckland", "lat": -36.928403, "lng": 174.912799, "status": "Operational" },
    { "id": "RL016", "type": "Red Light", "location": "Pakuranga Road and Pidgeon Mountain Road, Half Moon Bay", "region": "Auckland", "lat": -36.899183, "lng": 174.90189, "status": "Operational" },
    { "id": "RL017", "type": "Red Light", "location": "Great South Road and Cavendish Drive, Manukau City", "region": "Auckland", "lat": -36.98732, "lng": 174.881609, "status": "Operational" },
    { "id": "RL018", "type": "Red Light", "location": "Great South Road and Te Irirangi Drive, Manukau City", "region": "Auckland", "lat": -36.9864, "lng": 174.881137, "status": "Operational" },
    { "id": "RL019", "type": "Red Light", "location": "Great South Road and Reagan Road, Manukau City", "region": "Auckland", "lat": -36.981192, "lng": 174.877436, "status": "Operational" },
    { "id": "RL020", "type": "Red Light", "location": "Lambie Drive and Manukau Station Road, Manukau City", "region": "Auckland", "lat": -36.994796, "lng": 174.874225, "status": "Operational" },
    { "id": "RL021", "type": "Red Light", "location": "Wiri Station Road and Lambie Drive, Manukau City", "region": "Auckland", "lat": -36.997461, "lng": 174.876164, "status": "Operational" },
    { "id": "RL022", "type": "Red Light", "location": "Cavendish Drive and Lambie Drive, Papatoetoe", "region": "Auckland", "lat": -36.98931, "lng": 174.874047, "status": "Operational" },
    { "id": "RL023", "type": "Red Light", "location": "Princes Street and Church Street, Papatoetoe", "region": "Auckland", "lat": -36.940175, "lng": 174.846025, "status": "Operational" },
    { "id": "RL024", "type": "Red Light", "location": "Great South Road and East Tamaki Road, Papatoetoe", "region": "Auckland", "lat": -36.968302, "lng": 174.85959, "status": "Operational" },
    { "id": "RL025", "type": "Red Light", "location": "Green Lane East and Ascot Avenue, Remuera", "region": "Auckland", "lat": -36.886705, "lng": 174.800701, "status": "Operational" },
    { "id": "RL026", "type": "Red Light", "location": "Balmoral Road and Sandringham Road, Sandringham", "region": "Auckland", "lat": -36.885416, "lng": 174.738868, "status": "Operational" },
    { "id": "RL027", "type": "Red Light", "location": "Te Atatu Road and McLeod Road, Te Atatu South", "region": "Auckland", "lat": -36.876589, "lng": 174.646708, "status": "Operational" },
    { "id": "RL028", "type": "Red Light", "location": "East Tamaki Road and Bairds Road, Otara", "region": "Auckland", "lat": -36.962319, "lng": 174.874408, "status": "Operational" },
    { "id": "RL029", "type": "Red Light", "location": "East Tamaki Road and Otara Road, Otara", "region": "Auckland", "lat": -36.962802, "lng": 174.870127, "status": "Operational" },
    { "id": "RL030", "type": "Red Light", "location": "Albany Expressway and Mercari Way, Albany", "region": "Auckland", "lat": -36.733279, "lng": 174.707517, "status": "Operational" },
    
    // SPOT SPEED & AVERAGE (Dec 2025 Standard)
    { "id": "SS001", "type": "Spot Speed", "location": "State Highway 1, Kaiwaka", "region": "Northland", "lat": -36.178429, "lng": 174.44949, "status": "Operational" },
    { "id": "AS001", "type": "Point to Point", "location": "Matakana Road, Warkworth", "region": "Auckland", "lat": -36.386, "lng": 174.678, "status": "Enforcing", "Notes": "NZ First Pair" },
    { "id": "AS_WKT_01", "id_internal": "UC011", "type": "Point to Point", "location": "SH2 Pōkeno to Mangatāwhiri", "region": "Waikato", "lat": -37.241, "lng": 175.085, "status": "Under Construction" },
    { "id": "AS_OTA_01", "type": "Point to Point", "location": "SH1 Allanton to Waihola", "region": "Otago", "lat": -45.925, "lng": 170.255, "status": "Planned" }
];

const mapType = (t: string): CameraType => {
  if (t === "Red Light") return 'red-light';
  if (t === "Spot Speed") return 'spot-speed';
  if (t === "Point to Point") return 'point-to-point';
  return 'feed';
};

export const enforcementCameras: TrafficCamera[] = rawData.map(c => ({
  id: c.id,
  name: c.location,
  description: `${c.type} Enforcement Node. Status: ${c.status}`,
  region: c.region,
  latitude: c.lat,
  longitude: c.lng,
  direction: 'N/A',
  journeyLegs: [],
  type: mapType(c.type),
  status: c.status,
  source: 'NZTA Dec 2025 Matrix',
  severity: c.status === 'Operational' || c.status === 'Enforcing' ? 'low' : 'medium',
  trend: 'stable',
  confidence: 99,
  lastUpdate: 'Dec 01, 2025'
}));
