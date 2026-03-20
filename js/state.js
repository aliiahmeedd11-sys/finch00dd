/* state.js - Finch Parametric Architecture Engine */

const canvas = document.getElementById("floorplan");
const ctx = canvas.getContext("2d");
const PRESETS = {
  L: [
    [0, 0],
    [12, 0],
    [12, 10],
  ],
  U: [
    [0, 0],
    [10, 0],
    [10, 8],
    [0, 8],
  ],
  I: [
    [0, 0],
    [20, 0],
  ],
  T: [
    [0, 0],
    [10, 0],
    [10, -6],
  ],
};

const S = {
  data: null,
  zoom: 10,
  panX: 0,
  panY: 0,
  showRooms: true,
  showSpine: true,
  showCores: true,
  showDucts: true,
  showBalconies: true,
  showLabels: true,
  showDims: false,
  showCirc: false,
  showGrid: true,
  activeRoomFilter: "all",
  preset: "L",
  dragging: false,
  lastMouse: { x: 0, y: 0 },
  drawMode: false,
  customSpine: [],
  dragIdx: -1,
  hoverIdx: -1,
  zoningOn: true,
  // V17 Generative State
  genMode: "spine", // 'spine' or 'lot'
  landLot: [], // Points for boundary-driven mode
  setbacks: 3.0,
  // Precision Input System
  snapEnabled: true,
  orthoEnabled: true,
  structGridEnabled: true,
  snapRes: 0.25, // metres
  cursorWorld: [0, 0], // live world coords of cursor
  altHeld: false,
  shiftHeld: false, // modifier keys
  // Unit Mixer Config
  unitMixConfig: [
    {
      id: 1,
      type: "studio",
      size: 45,
      mix: 26,
      balcAlign: "center",
      balcLen: 1.2,
      balcOffsetSt: 0.0,
      balcOffsetEn: 0.0,
      color: "#FACC15",
    },
    {
      id: 2,
      type: "bed1",
      size: 60,
      mix: 46,
      balcAlign: "center",
      balcLen: 1.2,
      balcOffsetSt: 0.0,
      balcOffsetEn: 0.0,
      color: "#4ADE80",
    },
    {
      id: 3,
      type: "bed2",
      size: 70,
      mix: 25,
      balcAlign: "center",
      balcLen: 1.2,
      balcOffsetSt: 0.0,
      balcOffsetEn: 0.0,
      color: "#60A5FA",
    },
    {
      id: 4,
      type: "bed3",
      size: 85,
      mix: 3,
      balcAlign: "center",
      balcLen: 1.2,
      balcOffsetSt: 0.0,
      balcOffsetEn: 0.0,
      color: "#F472B6",
    },
  ],
  serverUrl: localStorage.getItem("finch_api_url") || "http://localhost:8080",
  selectedRoomId: null,
  editingRoom: null,
  editorWalls: [],
};
