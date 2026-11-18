import type * as THREE from 'three';
import type { Grid } from './grid';
import type { LocationId } from '../game/state';

export interface Place {
  id: string;
  name: string;
  description: string;
  /** Tile the player walks to when the place is tapped. */
  door: { x: number; z: number };
  /** World point the player faces on arrival. */
  faceTo: { x: number; z: number };
}

/** A building on the district map. */
export interface MapRect {
  x: number;
  z: number;
  w: number;
  d: number;
  label: string;
  kind: 'shop' | 'house' | 'church' | 'open';
  placeId?: string;
}

export interface Location {
  id: LocationId;
  name: string;
  scene: THREE.Scene;
  grid: Grid;
  places: Place[];
  /** Objects that can be tapped; userData.placeId names the place. */
  tappables: THREE.Object3D[];
  /** Named arrival points (world coordinates) and the point to face. */
  entries: Record<string, { x: number; z: number; faceX: number; faceZ: number }>;
  camera: { bounds: { minX: number; maxX: number; minZ: number; maxZ: number }; view: number; offsetZ: number };
  /** Fade buildings that hide the player. */
  fadeOccluders: boolean;
  /** Street lamps, for safety near the light. */
  lamps?: { x: number; z: number }[];
  /** Optional objects shown only once owned (furniture), with the tiles they block. */
  extras?: Record<string, { obj: THREE.Object3D; tiles: { x: number; z: number }[] }>;
  update(hour: number, t: number): void;
  /** Hester's room: rebuild the furniture from a layout; find a placed piece's object. */
  furnish?: (layout: import('./furniture').HomeLayout, cat: boolean) => void;
  objectFor?: (uid: number) => THREE.Object3D | null;
  /** The district map: buildings and street names. */
  map?: { w: number; h: number; rects: MapRect[]; streets: { x: number; z: number; label: string }[] };
  /** Today's weather, for the light and the fog. */
  setWeather?(w: 'clear' | 'rain' | 'fog'): void;
}
