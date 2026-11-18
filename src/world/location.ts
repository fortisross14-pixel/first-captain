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
}
