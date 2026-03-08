import { AdaptiveDpr, Bvh, Instance, Instances, PerformanceMonitor, Sky, Sparkles } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BlendFunction,
  BloomEffect,
  EffectComposer as PostEffectComposer,
  EffectPass,
  NoiseEffect,
  RenderPass,
  VignetteEffect,
} from 'postprocessing'
import FastNoiseLite from 'fastnoise-lite'
import * as THREE from 'three'
import { AGI_WIN_TARGET } from '../game/rules'
import { Water } from 'three-stdlib'
import CustomShaderMaterial from 'three-custom-shader-material'
import type { CardType } from '../game/cards'
import type { GamePhase } from '../dojo/torii'
import type { Faction } from '../store/gameStore'

type SceneVariant = 'battle' | 'hero'
type DistrictKey = 'agi' | 'esc' | 'sys' | 'pts'

interface StrategicMapTeam {
  faction: Faction
  capital: number
  agi: number
  systems: number
  escalation: number
  heroCount: number
  projectedPoints: number
  production: {
    energy: number
    materials: number
    compute: number
  }
  active: boolean
}

interface StrategicMapBackgroundProps {
  age: 1 | 2 | 3
  className?: string
  phase?: GamePhase
  selectedType?: CardType | null
  showPresentationOverlays?: boolean
  teams: [StrategicMapTeam, StrategicMapTeam]
  variant?: SceneVariant
  winner?: 0 | 1 | 'tie' | null
}

interface ProgressSet {
  agi: number
  esc: number
  sys: number
  pts: number
}

type ShaderUniformRef = {
  uTime: { value: number }
  uHeroMix: { value: number }
  uSelectionColor: { value: THREE.Color }
}

type ShaderMaterialRef = THREE.Material & {
  uniforms: ShaderUniformRef
}

interface TerrainSample {
  height: number
  moisture: number
  river: number
}

const BATTLE_CAMERA = new THREE.Vector3(0, 72, 98)
const HERO_CAMERA = new THREE.Vector3(0, 58, 74)
const CAMERA_TARGET = new THREE.Vector3(0, 4, 0)
const MESA_TOP_Y = 0.28
const FACTION_MESA_OFFSET = 44
const WATER_LEVEL = 0.0
const TERRAIN_WIDTH = 332
const TERRAIN_DEPTH = 228
const TERRAIN_SEGMENTS_X = 252
const TERRAIN_SEGMENTS_Z = 172

function configureNoise(seed: number, apply: (noise: FastNoiseLite) => void): FastNoiseLite {
  const noise = new FastNoiseLite(seed)
  apply(noise)
  return noise
}

function normalizeNoise(value: number): number {
  return value * 0.5 + 0.5
}

const TERRAIN_NOISE = {
  continent: configureNoise(1201, (noise) => {
    noise.SetNoiseType(FastNoiseLite.NoiseType.OpenSimplex2S)
    noise.SetFrequency(0.0052)
    noise.SetFractalType(FastNoiseLite.FractalType.FBm)
    noise.SetFractalOctaves(4)
    noise.SetFractalLacunarity(2.1)
    noise.SetFractalGain(0.52)
    noise.SetFractalWeightedStrength(0.25)
  }),
  detail: configureNoise(5003, (noise) => {
    noise.SetNoiseType(FastNoiseLite.NoiseType.OpenSimplex2)
    noise.SetFrequency(0.05)
    noise.SetFractalType(FastNoiseLite.FractalType.FBm)
    noise.SetFractalOctaves(3)
    noise.SetFractalGain(0.45)
  }),
  hills: configureNoise(2401, (noise) => {
    noise.SetNoiseType(FastNoiseLite.NoiseType.OpenSimplex2S)
    noise.SetFrequency(0.016)
    noise.SetFractalType(FastNoiseLite.FractalType.FBm)
    noise.SetFractalOctaves(5)
    noise.SetFractalLacunarity(2.2)
    noise.SetFractalGain(0.5)
  }),
  moisture: configureNoise(8801, (noise) => {
    noise.SetNoiseType(FastNoiseLite.NoiseType.OpenSimplex2S)
    noise.SetFrequency(0.0105)
    noise.SetFractalType(FastNoiseLite.FractalType.FBm)
    noise.SetFractalOctaves(4)
    noise.SetFractalGain(0.55)
  }),
  ridges: configureNoise(3203, (noise) => {
    noise.SetNoiseType(FastNoiseLite.NoiseType.OpenSimplex2S)
    noise.SetFrequency(0.018)
    noise.SetFractalType(FastNoiseLite.FractalType.Ridged)
    noise.SetFractalOctaves(5)
    noise.SetFractalLacunarity(2.05)
    noise.SetFractalGain(0.58)
  }),
  riverAxisLarge: configureNoise(7101, (noise) => {
    noise.SetNoiseType(FastNoiseLite.NoiseType.OpenSimplex2)
    noise.SetFrequency(0.008)
  }),
  riverAxisSmall: configureNoise(7109, (noise) => {
    noise.SetNoiseType(FastNoiseLite.NoiseType.OpenSimplex2S)
    noise.SetFrequency(0.021)
  }),
  shelf: configureNoise(1601, (noise) => {
    noise.SetNoiseType(FastNoiseLite.NoiseType.OpenSimplex2S)
    noise.SetFrequency(0.009)
    noise.SetFractalType(FastNoiseLite.FractalType.FBm)
    noise.SetFractalOctaves(3)
    noise.SetFractalGain(0.48)
  }),
  warpX: configureNoise(901, (noise) => {
    noise.SetNoiseType(FastNoiseLite.NoiseType.OpenSimplex2)
    noise.SetFrequency(0.0075)
    noise.SetFractalType(FastNoiseLite.FractalType.FBm)
    noise.SetFractalOctaves(3)
  }),
  warpZ: configureNoise(1777, (noise) => {
    noise.SetNoiseType(FastNoiseLite.NoiseType.OpenSimplex2S)
    noise.SetFrequency(0.0075)
    noise.SetFractalType(FastNoiseLite.FractalType.FBm)
    noise.SetFractalOctaves(3)
  }),
} as const

const TEAM_ACCENTS: Record<Faction, {
  core: string
  glow: string
  lane: string
  shield: string
  territory: string
  soil: string
  forest: string
}> = {
  ATLANTIC: {
    core: '#6fa3ff',
    glow: '#54e0ff',
    lane: '#2f6df6',
    shield: '#84c4ff',
    territory: '#153a82',
    soil: '#6f8256',
    forest: '#395342',
  },
  CONTINENTAL: {
    core: '#ff9f6f',
    glow: '#ffd27a',
    lane: '#d26a38',
    shield: '#ffb36f',
    territory: '#7a331b',
    soil: '#9b8554',
    forest: '#53603a',
  },
}

const DISTRICT_TONES: Record<DistrictKey, {
  base: string
  glow: string
  windows: string
  accent: string
  pulseSpeed: number
}> = {
  agi: {
    base: '#355ff4',
    glow: '#8ef0ff',
    windows: '#d9fcff',
    accent: '#5db4ff',
    pulseSpeed: 1.9,
  },
  esc: {
    base: '#c04b47',
    glow: '#ff9e7b',
    windows: '#ffd0b8',
    accent: '#ff6b63',
    pulseSpeed: 2.5,
  },
  sys: {
    base: '#1da472',
    glow: '#89ffd6',
    windows: '#d6fff0',
    accent: '#57d8aa',
    pulseSpeed: 1.45,
  },
  pts: {
    base: '#b18521',
    glow: '#ffe39b',
    windows: '#fff4cb',
    accent: '#ffd56b',
    pulseSpeed: 1.2,
  },
}

const TYPE_TONES: Record<CardType, {
  beam: string
  glow: string
  pulseSpeed: number
}> = {
  AI: {
    beam: '#66c6ff',
    glow: '#9ef3ff',
    pulseSpeed: 1.8,
  },
  ECONOMY: {
    beam: '#ffbf5f',
    glow: '#ffe6a8',
    pulseSpeed: 1.15,
  },
  MILITARY: {
    beam: '#ff6e6e',
    glow: '#ffb28f',
    pulseSpeed: 2.4,
  },
  SYSTEM: {
    beam: '#6effb8',
    glow: '#b4ffd9',
    pulseSpeed: 1.4,
  },
}

const DISTRICT_ORDER: DistrictKey[] = ['agi', 'esc', 'sys', 'pts']

const DISTRICT_LAYOUT: Record<DistrictKey, readonly [number, number]> = {
  agi: [-8.2, -8.4],
  esc: [-8.2, 8.4],
  sys: [8.2, -8.4],
  pts: [8.2, 8.4],
}

const CITY_BLOCK_LAYOUT = [
  [-6.8, -2.8, 1.9, 2.3],
  [-6.2, 1.2, 1.5, 1.8],
  [-4.2, -5.8, 1.4, 1.7],
  [-4.0, 4.9, 1.5, 1.8],
  [-2.1, -2.6, 1.3, 1.5],
  [-1.7, 2.8, 1.2, 1.4],
  [0.0, -6.7, 2.1, 1.4],
  [0.0, 6.7, 2.1, 1.4],
  [2.0, -3.1, 1.3, 1.7],
  [2.1, 3.5, 1.2, 1.5],
  [4.3, -5.6, 1.5, 1.8],
  [4.4, 5.2, 1.5, 1.8],
  [6.3, -1.5, 1.6, 2.1],
  [6.9, 2.3, 1.8, 2.2],
  [-2.6, -0.4, 1.5, 1.3],
  [2.7, 0.6, 1.5, 1.3],
] as const

const FIELD_LAYOUT = [
  [-12.4, -6.6, 4.2, 2.6, '#97a76e', -0.18],
  [-11.8, 7.1, 4.0, 2.8, '#b8ab6a', 0.26],
  [11.4, -6.9, 3.8, 2.7, '#86a067', -0.12],
  [11.8, 7.2, 4.1, 2.9, '#bb975f', 0.2],
  [0.0, -11.3, 5.6, 2.4, '#a2b36d', 0.08],
] as const

const TREE_LAYOUT = [
  [-13.8, -2.6],
  [-13.2, 1.8],
  [-10.8, -10.2],
  [-9.4, 10.8],
  [-4.2, -12.8],
  [4.1, -12.6],
  [9.7, 11.2],
  [13.6, -2.1],
  [13.5, 2.5],
  [11.6, -10.1],
  [0.0, 12.6],
  [0.8, -13.4],
] as const

const WORLD_FOREST_LAYOUT = [
  [-82, -12],
  [-68, 34],
  [-48, -28],
  [-38, 40],
  [-18, -36],
  [-10, 30],
  [8, -38],
  [22, 26],
  [40, -30],
  [58, 36],
  [72, -16],
  [86, 24],
] as const

const DISTRICT_SUPPORT_LAYOUT: Record<DistrictKey, ReadonlyArray<readonly [number, number]>> = {
  agi: [
    [-1.5, -1.3],
    [1.4, -1.2],
    [0.2, 1.6],
    [-1.2, 1.2],
  ],
  esc: [
    [-1.5, -1.1],
    [1.4, -1.4],
    [0.4, 1.8],
    [-1.0, 1.1],
  ],
  sys: [
    [-1.4, -1.2],
    [1.3, -1.1],
    [-1.0, 1.1],
    [1.1, 1.3],
  ],
  pts: [
    [-1.3, -1.5],
    [1.3, -1.4],
    [-0.8, 1.4],
    [1.0, 1.6],
  ],
}

const DISTRICT_SELECTED_BY_TYPE: Partial<Record<CardType, DistrictKey>> = {
  AI: 'agi',
  ECONOMY: 'pts',
  MILITARY: 'esc',
  SYSTEM: 'sys',
}

const TERRAIN_VERTEX_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uHeroMix;

  attribute float aMoisture;
  attribute float aRiver;

  varying vec3 vWorldPosition;
  varying float vElevation;
  varying float vMoisture;
  varying float vRiver;

  void main() {
    vec3 displaced = position;
    displaced.y += uHeroMix * smoothstep(18.0, 0.0, distance(displaced.xz, vec2(0.0, 0.0))) * 0.18;

    vElevation = displaced.y;
    vMoisture = aMoisture;
    vRiver = aRiver;
    vWorldPosition = (modelMatrix * vec4(displaced, 1.0)).xyz;

    csm_Position = displaced;
  }
`

const TERRAIN_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uSelectionColor;
  uniform float uHeroMix;

  varying vec3 vWorldPosition;
  varying float vElevation;
  varying float vMoisture;
  varying float vRiver;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise2d(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);

    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;

    for (int octave = 0; octave < 4; octave++) {
      value += amplitude * noise2d(p * frequency);
      amplitude *= 0.5;
      frequency *= 2.0;
    }

    return value;
  }

  void main() {
    const float waterLevel = ${WATER_LEVEL.toFixed(2)};
    float riverBand = smoothstep(0.18, 0.86, vRiver);
    float channelOpen = smoothstep(0.22, 0.82, vRiver);
    if (vElevation < waterLevel + channelOpen * 0.08 - 0.035) discard;

    float basin = smoothstep(waterLevel + 0.02, 0.52, vElevation);
    float uplands = smoothstep(1.02, 2.44, vElevation);
    float mountains = smoothstep(2.58, 4.08, vElevation);
    float frost = smoothstep(4.22, 5.44, vElevation);
    float shore = 1.0 - smoothstep(waterLevel + 0.03, waterLevel + 0.38, vElevation);
    vec3 terrainNormal = normalize(cross(dFdx(vWorldPosition), dFdy(vWorldPosition)));
    float slope = 1.0 - clamp(terrainNormal.y, 0.0, 1.0);
    float macroVariation = fbm(vWorldPosition.xz * 0.028 + vec2(11.0, -7.0));
    float microVariation = fbm(vWorldPosition.xz * 0.14 - vec2(3.0, 8.0));
    float strata = smoothstep(0.42, 0.72, noise2d(vWorldPosition.xz * vec2(0.09, 0.24) + vec2(7.0, 0.0)));
    float biomeField = fbm(vWorldPosition.xz * 0.011 + vec2(-16.0, 13.0));
    float fertile = smoothstep(0.34, 0.82, biomeField + vMoisture * 0.34);
    float aridField = smoothstep(0.28, 0.8, (1.0 - biomeField) * 0.72 + (1.0 - vMoisture) * 0.48);
    float scrubField = smoothstep(0.2, 0.78, abs(macroVariation - biomeField) + slope * 0.18);
    float dryness = 1.0 - vMoisture;
    float riverBank = smoothstep(0.12, 0.62, vRiver) * smoothstep(waterLevel + 0.44, waterLevel + 0.04, vElevation);

    float sideBlend = smoothstep(-8.0, 8.0, vWorldPosition.x);
    vec3 atlanticGrass = mix(vec3(0.38, 0.50, 0.25), vec3(0.50, 0.66, 0.35), vMoisture);
    vec3 continentalGrass = mix(vec3(0.52, 0.54, 0.27), vec3(0.60, 0.63, 0.33), vMoisture * 0.52);
    vec3 plains = mix(atlanticGrass, continentalGrass, sideBlend);
    plains = mix(plains, vec3(0.73, 0.68, 0.41), dryness * 0.18);
    plains = mix(plains, vec3(0.27, 0.52, 0.23), fertile * 0.42);
    plains = mix(plains, vec3(0.63, 0.62, 0.36), aridField * 0.1);
    plains = mix(plains, vec3(0.39, 0.49, 0.28), scrubField * 0.12);
    plains = mix(plains, vec3(0.78, 0.74, 0.46), smoothstep(0.62, 0.94, macroVariation) * 0.08);
    plains = mix(plains, vec3(0.25, 0.40, 0.21), smoothstep(0.08, 0.34, macroVariation) * 0.08);
    plains += (microVariation - 0.5) * 0.09;

    vec3 beach = mix(vec3(0.81, 0.76, 0.58), vec3(0.74, 0.66, 0.45), sideBlend);
    vec3 basinColor = mix(vec3(0.46, 0.59, 0.34), vec3(0.60, 0.60, 0.37), sideBlend);
    vec3 highland = mix(vec3(0.48, 0.56, 0.30), vec3(0.61, 0.59, 0.34), sideBlend);
    vec3 rock = vec3(0.46, 0.44, 0.33);
    vec3 snow = vec3(0.84, 0.85, 0.83);

    float corridor = exp(-pow(abs(vWorldPosition.z) * 0.055, 2.0)) * smoothstep(14.0, 42.0, abs(vWorldPosition.x));
    float frontierShelf = exp(-pow(abs(vWorldPosition.x) * 0.09, 2.0)) * exp(-pow(abs(vWorldPosition.z) * 0.04, 2.0));
    float frontierGlow = exp(-pow(abs(vWorldPosition.x) * 0.12, 2.0));
    float valleyShade = smoothstep(waterLevel + 0.06, 0.7, vElevation);

    vec3 diffuse = mix(beach, basinColor, basin);
    diffuse = mix(diffuse, plains, smoothstep(waterLevel + 0.08, 0.5, vElevation));
    diffuse = mix(diffuse, highland, uplands);
    diffuse = mix(diffuse, rock, mountains);
    diffuse = mix(diffuse, snow, frost);
    diffuse = mix(diffuse, vec3(0.42, 0.46, 0.28), corridor * 0.16);
    diffuse = mix(diffuse, vec3(0.61, 0.61, 0.38), frontierShelf * 0.1);
    diffuse = mix(diffuse, vec3(0.67, 0.71, 0.58), shore * vMoisture * 0.16 + riverBank * 0.14);
    diffuse = mix(diffuse, vec3(0.33, 0.44, 0.28), slope * 0.12 + strata * 0.06);
    diffuse = mix(diffuse, vec3(0.45, 0.56, 0.48), riverBand * 0.12);
    diffuse = mix(diffuse, vec3(0.32, 0.56, 0.26), fertile * smoothstep(waterLevel + 0.04, 1.28, vElevation) * 0.12);
    diffuse *= mix(0.97, 1.06, valleyShade);
    diffuse *= mix(0.97, 1.05, smoothstep(0.18, 0.82, biomeField));
    diffuse += smoothstep(0.54, 0.9, strata) * (1.0 - slope) * 0.025;
    diffuse += uSelectionColor * frontierGlow * (0.045 + uHeroMix * 0.02);

    csm_DiffuseColor = vec4(diffuse, 1.0);
    csm_Emissive = uSelectionColor * frontierGlow * 0.014 + vec3(0.05, 0.07, 0.05) * shore * 0.018 + vec3(0.02, 0.03, 0.02) * riverBand;
  }
`

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

function hash2d(x: number, z: number): number {
  const value = Math.sin(x * 127.1 + z * 311.7) * 43758.5453123
  return value - Math.floor(value)
}

function noise2d(x: number, z: number): number {
  const baseX = Math.floor(x)
  const baseZ = Math.floor(z)
  const fractX = x - baseX
  const fractZ = z - baseZ
  const u = fractX * fractX * (3 - 2 * fractX)
  const v = fractZ * fractZ * (3 - 2 * fractZ)

  const a = hash2d(baseX, baseZ)
  const b = hash2d(baseX + 1, baseZ)
  const c = hash2d(baseX, baseZ + 1)
  const d = hash2d(baseX + 1, baseZ + 1)

  const mixX1 = a + (b - a) * u
  const mixX2 = c + (d - c) * u
  return mixX1 + (mixX2 - mixX1) * v
}

function fbm2d(x: number, z: number): number {
  let value = 0
  let amplitude = 0.5
  let frequency = 1

  for (let octave = 0; octave < 5; octave += 1) {
    value += amplitude * noise2d(x * frequency, z * frequency)
    amplitude *= 0.5
    frequency *= 2
  }

  return value
}

function sampleTerrainData(x: number, z: number): TerrainSample {
  const warpX = TERRAIN_NOISE.warpX.GetNoise(x, z) * 18 + TERRAIN_NOISE.detail.GetNoise(x * 0.42, z * 0.42) * 4.5
  const warpZ = TERRAIN_NOISE.warpZ.GetNoise(x, z) * 16 + TERRAIN_NOISE.shelf.GetNoise(x * 0.46 + 120, z * 0.46 - 120) * 4
  const warpedX = x + warpX
  const warpedZ = z + warpZ

  const edgeMask = 1 - smoothstep(118, 164, Math.hypot(x * 0.78, z * 0.9))
  const continent = smoothstep(0.3, 0.78, normalizeNoise(TERRAIN_NOISE.continent.GetNoise(warpedX, warpedZ)))
  const shelves = smoothstep(0.24, 0.76, normalizeNoise(TERRAIN_NOISE.shelf.GetNoise(warpedX * 0.92, warpedZ * 0.92)))
  const hills = normalizeNoise(TERRAIN_NOISE.hills.GetNoise(warpedX, warpedZ))
  const ridges = smoothstep(0.38, 0.92, normalizeNoise(TERRAIN_NOISE.ridges.GetNoise(warpedX, warpedZ)))
  const detail = normalizeNoise(TERRAIN_NOISE.detail.GetNoise(warpedX, warpedZ))

  const riverAxis = TERRAIN_NOISE.riverAxisLarge.GetNoise(0, z) * 11 + TERRAIN_NOISE.riverAxisSmall.GetNoise(120, z) * 4.2
  const riverWidth = 4.9 + normalizeNoise(TERRAIN_NOISE.shelf.GetNoise(x * 0.35 + 200, z * 0.35 - 200)) * 2.9
  const riverDistance = Math.abs(x - riverAxis)
  const river = smoothstep(riverWidth + 6.4, riverWidth - 1.6, riverDistance) * smoothstep(146, 0, Math.abs(z) + 12)
  const riverBasin = river * smoothstep(68, 0, Math.abs(z))
  const riverShelf = smoothstep(riverWidth + 13.5, riverWidth + 2.6, riverDistance) * smoothstep(150, 0, Math.abs(z) + 8)

  const capitalHubLeft = Math.exp(-(((x + FACTION_MESA_OFFSET) * 0.065) ** 2)) * Math.exp(-((z * 0.055) ** 2))
  const capitalHubRight = Math.exp(-(((x - FACTION_MESA_OFFSET) * 0.065) ** 2)) * Math.exp(-((z * 0.055) ** 2))

  let height = -0.28 + edgeMask * 2.58
  height += continent * 0.94
  height += shelves * 0.46
  height += hills * 0.34
  height += ridges * 1.18
  height += detail * 0.14
  height -= (1 - edgeMask) * 1.3
  height -= river * 3.25
  height -= riverBasin * 0.94
  height -= riverShelf * 0.34
  height += (capitalHubLeft + capitalHubRight) * 0.3

  const capitalBlend = Math.max(capitalHubLeft, capitalHubRight)
  height = THREE.MathUtils.lerp(height, 1.04 + detail * 0.08, smoothstep(0.16, 0.52, capitalBlend) * 0.34)

  const moistureBase = normalizeNoise(TERRAIN_NOISE.moisture.GetNoise(warpedX, warpedZ))
  const moisture = clamp(0.14 + moistureBase * 0.74 + river * 0.24 + riverBasin * 0.18 + riverShelf * 0.1, 0, 1)

  return {
    height: Math.max(height, -1.4),
    moisture,
    river,
  }
}

function sampleTerrainHeight(x: number, z: number): number {
  return sampleTerrainData(x, z).height
}

function waveHeight(u: number, v: number): number {
  const tau = Math.PI * 2
  return (
    Math.sin((u * 2.0 + v * 0.36) * tau) * 0.34
    + Math.cos((v * 3.0 - u * 0.58) * tau) * 0.24
    + Math.sin((u + v) * 5.2 * tau) * 0.16
    + Math.cos((u - v) * 7.4 * tau) * 0.08
  )
}

function createWaterNormalTexture(size = 256): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4)
  const texel = 1 / size

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / size
      const v = y / size
      const sampleX = waveHeight((u + texel) % 1, v) - waveHeight((u - texel + 1) % 1, v)
      const sampleZ = waveHeight(u, (v + texel) % 1) - waveHeight(u, (v - texel + 1) % 1)
      const normal = new THREE.Vector3(-sampleX * 3.8, 1, -sampleZ * 3.8).normalize()
      const offset = (y * size + x) * 4
      data[offset] = Math.round((normal.x * 0.5 + 0.5) * 255)
      data[offset + 1] = Math.round((normal.y * 0.5 + 0.5) * 255)
      data[offset + 2] = Math.round((normal.z * 0.5 + 0.5) * 255)
      data[offset + 3] = 255
    }
  }

  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.magFilter = THREE.LinearFilter
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.generateMipmaps = true
  texture.colorSpace = THREE.NoColorSpace
  texture.needsUpdate = true
  return texture
}

function buildTerrainGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.PlaneGeometry(TERRAIN_WIDTH, TERRAIN_DEPTH, TERRAIN_SEGMENTS_X, TERRAIN_SEGMENTS_Z)
  geometry.rotateX(-Math.PI / 2)

  const position = geometry.attributes.position as THREE.BufferAttribute
  const moisture = new Float32Array(position.count)
  const river = new Float32Array(position.count)

  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index)
    const z = position.getZ(index)
    const sample = sampleTerrainData(x, z)
    position.setY(index, sample.height)
    moisture[index] = sample.moisture
    river[index] = sample.river
  }

  position.needsUpdate = true
  geometry.setAttribute('aMoisture', new THREE.BufferAttribute(moisture, 1))
  geometry.setAttribute('aRiver', new THREE.BufferAttribute(river, 1))
  geometry.computeVertexNormals()

  return geometry
}

function blendColor(left: string, right: string, amount: number): string {
  return new THREE.Color(left).lerp(new THREE.Color(right), amount).getStyle()
}

function resolveTypeTone(selectedType?: CardType | null) {
  return selectedType ? TYPE_TONES[selectedType] : {
    beam: '#8dd4ff',
    glow: '#d7f3ff',
    pulseSpeed: 1.15,
  }
}

function deriveHeroFocus(teams: [StrategicMapTeam, StrategicMapTeam]): number {
  return teams[0].heroCount + teams[1].heroCount
}

function getDistrictProgress(team: StrategicMapTeam, pointsLeader: number): ProgressSet {
  return {
    agi: clamp(team.agi / AGI_WIN_TARGET, 0, 1),
    esc: clamp(team.escalation / 6, 0, 1),
    sys: clamp(team.systems / 4, 0, 1),
    pts: clamp(team.projectedPoints / Math.max(pointsLeader, 1), 0, 1),
  }
}

function getVisibleBuildings(progress: number, count: number): number {
  if (progress < 0.08) return 0
  if (progress >= 0.98) return count
  return Math.min(count, 1 + Math.floor(progress * count))
}

function districtForPosition(x: number, z: number): DistrictKey {
  if (x < 0 && z < 0) return 'agi'
  if (x < 0 && z >= 0) return 'esc'
  if (x >= 0 && z < 0) return 'sys'
  return 'pts'
}

function CameraRig({ variant, selectedType }: { variant: SceneVariant, selectedType?: CardType | null }) {
  const { camera } = useThree()
  const base = variant === 'battle' ? BATTLE_CAMERA : HERO_CAMERA
  const pulseSpeed = resolveTypeTone(selectedType).pulseSpeed
  const nextPositionRef = useRef(new THREE.Vector3())
  const nextTargetRef = useRef(new THREE.Vector3())

  useFrame((state, delta) => {
    const elapsed = state.clock.getElapsedTime()
    nextPositionRef.current.set(
      base.x + Math.sin(elapsed * 0.16) * (variant === 'battle' ? 2.2 : 1.6),
      base.y + Math.sin(elapsed * 0.11 + pulseSpeed * 0.5) * (variant === 'battle' ? 1.2 : 0.8),
      base.z + Math.cos(elapsed * 0.14) * (variant === 'battle' ? 2.5 : 1.6),
    )
    camera.position.lerp(nextPositionRef.current, 1 - Math.exp(-delta * 2.4))

    nextTargetRef.current.copy(CAMERA_TARGET)
    nextTargetRef.current.x = Math.sin(elapsed * 0.08) * 1.2
    nextTargetRef.current.z = Math.cos(elapsed * 0.09) * 0.8
    camera.lookAt(nextTargetRef.current)
  })

  return null
}

function TerrainBoard({ variant, selectedType }: { variant: SceneVariant, selectedType?: CardType | null }) {
  const terrainGeometry = useMemo(() => buildTerrainGeometry(), [])
  const terrainUniforms = useMemo<ShaderUniformRef>(() => ({
    uHeroMix: { value: variant === 'hero' ? 1 : 0 },
    uSelectionColor: { value: new THREE.Color(resolveTypeTone(selectedType).beam) },
    uTime: { value: 0 },
  }), [selectedType, variant])
  const terrainRef = useRef<ShaderMaterialRef | null>(null)

  useEffect(() => () => {
    terrainGeometry.dispose()
  }, [terrainGeometry])

  useFrame((state) => {
    const elapsed = state.clock.getElapsedTime()
    if (terrainRef.current) terrainRef.current.uniforms.uTime.value = elapsed
  })

  return (
    <group>
      <mesh geometry={terrainGeometry} receiveShadow>
        <CustomShaderMaterial<typeof THREE.MeshPhysicalMaterial>
          baseMaterial={THREE.MeshPhysicalMaterial}
          clearcoat={0.02}
          color="#ffffff"
          fragmentShader={TERRAIN_FRAGMENT_SHADER}
          metalness={0.04}
          polygonOffset
          polygonOffsetFactor={1}
          ref={(material) => {
            terrainRef.current = material as ShaderMaterialRef | null
          }}
          roughness={0.96}
          uniforms={terrainUniforms}
          vertexShader={TERRAIN_VERTEX_SHADER}
        />
      </mesh>
    </group>
  )
}

function WaterSurface({ variant }: { variant: SceneVariant }) {
  const waterRef = useRef<Water | null>(null)
  const waterNormals = useMemo(() => createWaterNormalTexture(256), [])
  const water = useMemo(() => {
    const surface = new Water(
      new THREE.PlaneGeometry(TERRAIN_WIDTH + 28, TERRAIN_DEPTH + 28),
      {
        alpha: variant === 'battle' ? 0.98 : 0.95,
        clipBias: 0.002,
        distortionScale: variant === 'battle' ? 2.7 : 2.35,
        fog: false,
        sunColor: '#fff7e3',
        sunDirection: new THREE.Vector3(0.74, 1, 0.22).normalize(),
        textureHeight: 1024,
        textureWidth: 1024,
        waterColor: variant === 'battle' ? '#2b6f8c' : '#3c86a9',
        waterNormals,
      },
    )

    surface.rotation.x = -Math.PI / 2
    surface.position.set(0, WATER_LEVEL - 0.005, 0)
    surface.renderOrder = -2

    const material = surface.material as THREE.ShaderMaterial
    material.transparent = true
    material.uniforms.size.value = variant === 'battle' ? 0.94 : 0.88

    return surface
  }, [variant, waterNormals])

  useFrame((state) => {
    const currentWater = waterRef.current
    if (!currentWater) return

    const material = currentWater.material as THREE.ShaderMaterial
    if (material.uniforms.time) {
      material.uniforms.time.value = state.clock.getElapsedTime() * 0.2
    }
  })

  useEffect(() => {
    waterRef.current = water

    return () => {
      waterRef.current = null
      water.geometry.dispose()
      water.material.dispose()
      waterNormals.dispose()
    }
  }, [water, waterNormals])

  return <primitive object={water} />
}

function WorldTerrainDetails() {
  const forestClusters = useMemo(() => WORLD_FOREST_LAYOUT.flatMap(([x, z], clusterIndex) => {
    const base = sampleTerrainHeight(x, z)
    if (base <= WATER_LEVEL + 0.1) return []

    return [
      [0, 0],
      [1.2, -0.7],
      [-1.0, 0.8],
      [0.7, 1.1],
    ].map(([dx, dz], offsetIndex) => {
      const worldX = x + dx * (1.2 + clusterIndex * 0.04)
      const worldZ = z + dz * (1.2 + clusterIndex * 0.04)
      const ground = sampleTerrainHeight(worldX, worldZ)
      return {
        color: offsetIndex % 2 === 0 ? '#46593f' : '#5c6e51',
        scale: 1.6 + fbm2d(worldX * 0.18 + clusterIndex, worldZ * 0.18 - clusterIndex) * 0.9,
        x: worldX,
        y: ground + 0.7,
        z: worldZ,
      }
    })
  }), [])

  return (
    <group>
      <Instances castShadow limit={forestClusters.length} receiveShadow>
        <coneGeometry args={[0.8, 2.4, 7]} />
        <meshStandardMaterial metalness={0.02} opacity={0.8} roughness={0.94} transparent />
        {forestClusters.map((tree, treeIndex) => (
          <Instance
            key={`world-tree-${treeIndex}`}
            color={tree.color}
            position={[tree.x, tree.y * 0.98, tree.z]}
            scale={[tree.scale, tree.scale, tree.scale]}
          />
        ))}
      </Instances>
    </group>
  )
}

function CapitalComplex({
  accent,
  progress,
  selectedDistrict,
  team,
  winnerBoost,
}: {
  accent: typeof TEAM_ACCENTS[Faction]
  progress: ProgressSet
  selectedDistrict: DistrictKey | null
  team: StrategicMapTeam
  winnerBoost: number
}) {
  const crownRef = useRef<THREE.Mesh>(null)
  const haloRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    const elapsed = state.clock.getElapsedTime()
    if (crownRef.current) crownRef.current.rotation.y = elapsed * 0.28
    if (haloRef.current) {
      haloRef.current.rotation.z = elapsed * 0.24
      const pulse = 1 + Math.sin(elapsed * 0.9) * 0.04 + progress.sys * 0.08
      haloRef.current.scale.setScalar(pulse)
    }
  })

  const coreGlow = selectedDistrict === 'agi' ? DISTRICT_TONES.agi.glow : accent.glow
  const heightBoost = 1 + progress.agi * 0.85 + progress.pts * 0.35 + team.heroCount * 0.06 + winnerBoost * 0.1

  return (
    <group position={[0, MESA_TOP_Y + 0.15, 0]}>
      <mesh castShadow receiveShadow position={[0, 0.4, 0]}>
        <cylinderGeometry args={[5.8, 7.2, 0.9, 12]} />
        <meshStandardMaterial
          color={blendColor('#9a9078', accent.core, 0.18)}
          metalness={0.12}
          roughness={0.72}
        />
      </mesh>

      <mesh castShadow receiveShadow position={[0, 1.55 + heightBoost * 0.3, 0]}>
        <cylinderGeometry args={[2.8, 3.7, 3.1 * heightBoost, 10]} />
        <meshStandardMaterial
          color={accent.core}
          emissive={coreGlow}
          emissiveIntensity={0.18 + progress.agi * 0.18 + progress.pts * 0.08 + winnerBoost * 0.12}
          metalness={0.28}
          roughness={0.28}
        />
      </mesh>

      <mesh castShadow receiveShadow position={[0, 3.25 + heightBoost * 1.34, 0]}>
        <octahedronGeometry args={[1.2, 0]} />
        <meshStandardMaterial
          color={blendColor('#f5e8ca', accent.shield, 0.35)}
          emissive={accent.glow}
          emissiveIntensity={0.2}
          metalness={0.28}
          roughness={0.18}
        />
      </mesh>

      {([-1, 1] as const).flatMap((xSign) => ([-1, 1] as const).map((zSign) => (
        <group key={`${xSign}-${zSign}`} position={[xSign * 3.8, 0, zSign * 3.8]}>
          <mesh castShadow receiveShadow position={[0, 1.1, 0]}>
            <cylinderGeometry args={[0.7, 0.9, 2.2 + progress.sys, 8]} />
            <meshStandardMaterial
              color={blendColor('#918c83', accent.shield, 0.16)}
              emissive={accent.glow}
              emissiveIntensity={0.04 + progress.sys * 0.05}
              metalness={0.14}
              roughness={0.38}
            />
          </mesh>
          <mesh castShadow receiveShadow position={[0, 2.45 + progress.sys * 0.5, 0]}>
            <coneGeometry args={[0.58, 0.92, 8]} />
            <meshStandardMaterial
              color={blendColor('#f6ead7', accent.shield, 0.26)}
              emissive={accent.glow}
              emissiveIntensity={0.06}
              metalness={0.22}
              roughness={0.24}
            />
          </mesh>
        </group>
      )))}

      <mesh ref={haloRef} position={[0, 0.86, 0]} rotation-x={Math.PI / 2}>
        <torusGeometry args={[8.6, 0.22, 14, 48]} />
        <meshBasicMaterial
          color={selectedDistrict === 'sys' ? DISTRICT_TONES.sys.glow : accent.shield}
          transparent
          opacity={0.12 + progress.sys * 0.12 + winnerBoost * 0.05}
        />
      </mesh>

      <mesh ref={crownRef} position={[0, 4.8 + heightBoost * 1.1, 0]} rotation-x={Math.PI / 2}>
        <torusGeometry args={[2.9, 0.18, 10, 40]} />
        <meshBasicMaterial color={accent.glow} transparent opacity={0.15 + progress.agi * 0.08} />
      </mesh>
    </group>
  )
}

function DistrictMonument({
  accent,
  district,
  emphasis,
  progress,
  team,
}: {
  accent: typeof TEAM_ACCENTS[Faction]
  district: DistrictKey
  emphasis: boolean
  progress: number
  team: StrategicMapTeam
}) {
  const tone = DISTRICT_TONES[district]
  const supportCount = getVisibleBuildings(progress, DISTRICT_SUPPORT_LAYOUT[district].length)
  const rootRef = useRef<THREE.Group>(null)
  const ringRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    const elapsed = state.clock.getElapsedTime()
    if (rootRef.current) {
      rootRef.current.position.y = MESA_TOP_Y + 0.16 + Math.sin(elapsed * (0.7 + tone.pulseSpeed * 0.12)) * 0.05 * progress
    }
    if (ringRef.current) {
      ringRef.current.rotation.z = elapsed * 0.28 * (district === 'esc' ? -1 : 1)
      const pulse = 1 + Math.sin(elapsed * tone.pulseSpeed) * 0.05 + progress * 0.08
      ringRef.current.scale.setScalar(pulse)
    }
  })

  let icon: JSX.Element
  switch (district) {
    case 'agi':
      icon = (
        <mesh castShadow receiveShadow position={[0, 2.15 + progress * 0.8, 0]}>
          <cylinderGeometry args={[0.55, 1.05, 2.9 + progress * 1.2, 10]} />
          <meshStandardMaterial
            color={blendColor(accent.core, tone.base, 0.58)}
            emissive={emphasis ? tone.windows : tone.glow}
            emissiveIntensity={0.12 + progress * 0.12}
            metalness={0.24}
            roughness={0.28}
          />
        </mesh>
      )
      break
    case 'esc':
      icon = (
        <mesh castShadow receiveShadow position={[0, 1.92 + progress * 0.7, 0]} rotation-x={Math.PI}>
          <coneGeometry args={[1.1, 2.8 + progress * 1.2, 7]} />
          <meshStandardMaterial
            color={blendColor(accent.core, tone.base, 0.64)}
            emissive={emphasis ? tone.windows : tone.glow}
            emissiveIntensity={0.12 + progress * 0.12}
            metalness={0.18}
            roughness={0.32}
          />
        </mesh>
      )
      break
    case 'sys':
      icon = (
        <mesh castShadow receiveShadow position={[0, 1.75 + progress * 0.55, 0]} rotation-y={Math.PI / 6}>
          <cylinderGeometry args={[1.2, 1.2, 1.9 + progress * 0.9, 6]} />
          <meshStandardMaterial
            color={blendColor(accent.core, tone.base, 0.56)}
            emissive={emphasis ? tone.windows : tone.glow}
            emissiveIntensity={0.1 + progress * 0.12}
            metalness={0.2}
            roughness={0.28}
          />
        </mesh>
      )
      break
    case 'pts':
      icon = (
        <mesh castShadow receiveShadow position={[0, 1.96 + progress * 0.62, 0]}>
          <octahedronGeometry args={[1.22 + progress * 0.24, 0]} />
          <meshStandardMaterial
            color={blendColor(accent.core, tone.base, 0.62)}
            emissive={emphasis ? tone.windows : tone.glow}
            emissiveIntensity={0.12 + progress * 0.12}
            metalness={0.22}
            roughness={0.26}
          />
        </mesh>
      )
      break
  }

  return (
    <group ref={rootRef}>
      <mesh castShadow receiveShadow position={[0, 0.18, 0]}>
        <cylinderGeometry args={[3.25, 3.9, 0.52, 24]} />
        <meshStandardMaterial
          color={blendColor('#9d8f78', tone.base, 0.14)}
          emissive={emphasis ? tone.glow : accent.glow}
          emissiveIntensity={0.02 + progress * 0.08 + (emphasis ? 0.08 : 0)}
          metalness={0.08}
          roughness={0.88}
        />
      </mesh>

      <mesh rotation-x={Math.PI / 2} position={[0, 0.52, 0]}>
        <ringGeometry args={[3.5, 4.05, 32]} />
        <meshBasicMaterial color={tone.accent} transparent opacity={0.08 + progress * 0.08 + (emphasis ? 0.08 : 0)} />
      </mesh>

      <mesh ref={ringRef} rotation-x={Math.PI / 2} position={[0, 0.76, 0]}>
        <torusGeometry args={[4.45, 0.14, 8, 40]} />
        <meshBasicMaterial color={emphasis ? tone.windows : tone.glow} transparent opacity={0.08 + progress * 0.08} />
      </mesh>

      {emphasis && (
        <mesh position={[0, 2.7 + progress * 1.6, 0]}>
          <cylinderGeometry args={[0.26, 0.78, 4.2 + progress * 2.2, 10, 1, true]} />
          <meshBasicMaterial color={tone.glow} transparent opacity={0.08 + progress * 0.08} side={THREE.DoubleSide} />
        </mesh>
      )}

      {icon}

      {DISTRICT_SUPPORT_LAYOUT[district].map(([x, z], supportIndex) => {
        if (supportIndex >= supportCount) return null

        const height = 0.8 + progress * (1.2 + supportIndex * 0.2) + (supportIndex % 2) * 0.24
        return (
          <group key={`${district}-${x}-${z}`} position={[x, 0, z]}>
            <mesh castShadow receiveShadow position={[0, 0.35 + height * 0.45, 0]}>
              <boxGeometry args={[0.72, height, 0.72]} />
              <meshStandardMaterial
                color={blendColor('#b9b4a5', tone.accent, 0.32)}
                emissive={tone.glow}
                emissiveIntensity={0.04 + progress * 0.06}
                metalness={0.14}
                roughness={0.38}
              />
            </mesh>
            <mesh castShadow receiveShadow position={[0, 0.9 + height * 0.9, 0]}>
              <coneGeometry args={[0.34, 0.52, 6]} />
              <meshStandardMaterial
                color={blendColor('#f8efde', tone.windows, 0.32)}
                emissive={tone.glow}
                emissiveIntensity={0.08}
                metalness={0.18}
                roughness={0.24}
              />
            </mesh>
          </group>
        )
      })}

      {district === 'agi' && team.heroCount > 0 && (
        <mesh position={[0, 4.25 + progress * 1.6, 0]}>
          <sphereGeometry args={[0.32 + team.heroCount * 0.06, 14, 14]} />
          <meshBasicMaterial color={tone.windows} transparent opacity={0.6} />
        </mesh>
      )}
    </group>
  )
}

function MesaRoads({
  accent,
  progress,
  selectedDistrict,
}: {
  accent: typeof TEAM_ACCENTS[Faction]
  progress: ProgressSet
  selectedDistrict: DistrictKey | null
}) {
  const roadColor = selectedDistrict ? DISTRICT_TONES[selectedDistrict].accent : '#c4b38c'

  return (
    <>
      {[
        [0, 0, 1.0, 17.4, 0],
        [0, 0, 17.4, 1.0, 0],
        [0, 0, 19.8, 0.48, Math.PI / 4],
        [0, 0, 19.8, 0.48, -Math.PI / 4],
      ].map(([x, z, width, depth, rotation], roadIndex) => (
        <mesh
          key={`road-${roadIndex}`}
          position={[x, MESA_TOP_Y + 0.05, z]}
          rotation-x={-Math.PI / 2}
          rotation-z={rotation}
        >
          <planeGeometry args={[width, depth]} />
          <meshBasicMaterial color={roadColor} transparent opacity={0.12 + progress.sys * 0.04 + progress.agi * 0.03} />
        </mesh>
      ))}

      <mesh position={[0, MESA_TOP_Y + 0.09, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[11.6, 12.4, 56]} />
        <meshBasicMaterial color={accent.shield} transparent opacity={0.05 + progress.pts * 0.035} />
      </mesh>
    </>
  )
}

function FactionTerritory({
  age,
  index,
  pointsLeader,
  selectedType,
  team,
  winner,
}: {
  age: 1 | 2 | 3
  index: 0 | 1
  pointsLeader: number
  selectedType?: CardType | null
  team: StrategicMapTeam
  winner?: 0 | 1 | 'tie' | null
}) {
  const accent = TEAM_ACCENTS[team.faction]
  const progress = getDistrictProgress(team, pointsLeader)
  const selectedDistrict = selectedType ? DISTRICT_SELECTED_BY_TYPE[selectedType] ?? null : null
  const winnerBoost = winner === index ? 0.16 : 0
  const rootX = index === 0 ? -FACTION_MESA_OFFSET : FACTION_MESA_OFFSET
  const rootY = sampleTerrainHeight(rootX, 0)
  const pointsWeight = team.production.energy + team.production.materials + team.production.compute

  const cityBlocks = useMemo(() => CITY_BLOCK_LAYOUT.map(([x, z, width, depth], blockIndex) => {
    const district = districtForPosition(x, z)
    const districtProgress = progress[district]
    const localNoise = fbm2d(x * 0.7 + blockIndex * 0.3, z * 0.7 - blockIndex * 0.2)
    const height = 1.1
      + age * 0.18
      + districtProgress * (1.8 + (blockIndex % 3) * 0.18)
      + progress.pts * 0.34
      + progress.sys * 0.22
      + (pointsWeight / 12) * 0.22
      + localNoise * 0.46

    return {
      color: blendColor(
        blockIndex % 2 === 0 ? '#9c947f' : '#c1b79c',
        selectedDistrict === district ? DISTRICT_TONES[district].accent : accent.core,
        selectedDistrict === district ? 0.42 : 0.18,
      ),
      depth,
      height,
      width,
      x,
      z,
    }
  }), [accent.core, age, pointsWeight, progress, selectedDistrict])

  const treeClusters = useMemo(() => TREE_LAYOUT.flatMap(([x, z], treeIndex) => {
    const spread = [
      [0, 0],
      [0.6, 0.4],
      [-0.5, 0.3],
    ]

    return spread.map(([dx, dz], clusterIndex) => {
      const noise = fbm2d((x + dx) * 0.18 + treeIndex, (z + dz) * 0.18 - treeIndex)
      return {
        color: clusterIndex % 2 === 0 ? accent.forest : blendColor(accent.forest, '#698159', 0.22),
        scale: 1 + noise * 0.45 + progress.agi * 0.08,
        x: x + dx,
        z: z + dz,
      }
    })
  }), [accent.forest, progress.agi])

  return (
    <group position={[rootX, rootY, 0]}>
      <mesh position={[0, -2.1, 0]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[18.5, 64]} />
        <meshBasicMaterial
          color={accent.territory}
          transparent
          opacity={0.04 + progress.pts * 0.03 + winnerBoost * 0.04}
        />
      </mesh>

      <MesaRoads accent={accent} progress={progress} selectedDistrict={selectedDistrict} />

      {FIELD_LAYOUT.map(([x, z, width, depth, color, rotation], fieldIndex) => (
        <mesh
          key={`field-${fieldIndex}`}
          castShadow
          receiveShadow
          position={[x, MESA_TOP_Y + 0.04, z]}
          rotation-x={-Math.PI / 2}
          rotation-z={rotation}
        >
          <planeGeometry args={[width, depth]} />
          <meshStandardMaterial
            color={blendColor(color, accent.soil, 0.08)}
            metalness={0.02}
            opacity={0.88}
            roughness={0.98}
            transparent
          />
        </mesh>
      ))}

      <Instances castShadow limit={treeClusters.length} receiveShadow>
        <coneGeometry args={[0.7, 1.9, 7]} />
        <meshStandardMaterial metalness={0.02} roughness={0.92} />
        {treeClusters.map((tree, treeIndex) => (
          <Instance
            key={`tree-${treeIndex}`}
            color={tree.color}
            position={[tree.x, MESA_TOP_Y + 0.75 * tree.scale, tree.z]}
            scale={[tree.scale, tree.scale, tree.scale]}
          />
        ))}
      </Instances>

      <Instances castShadow limit={cityBlocks.length} receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial metalness={0.12} roughness={0.48} />
        {cityBlocks.map((block, blockIndex) => (
          <Instance
            key={`block-${blockIndex}`}
            color={block.color}
            position={[block.x, MESA_TOP_Y + block.height * 0.5, block.z]}
            scale={[block.width, block.height, block.depth]}
          />
        ))}
      </Instances>

      <Instances castShadow limit={cityBlocks.length} receiveShadow>
        <coneGeometry args={[0.56, 0.6, 6]} />
        <meshStandardMaterial color="#efe5cc" metalness={0.16} roughness={0.24} />
        {cityBlocks.map((block, blockIndex) => (
          <Instance
            key={`roof-${blockIndex}`}
            position={[block.x, MESA_TOP_Y + block.height + 0.34, block.z]}
            scale={[block.width * 0.32, 1, block.depth * 0.32]}
          />
        ))}
      </Instances>

      {DISTRICT_ORDER.map((district) => {
        const [x, z] = DISTRICT_LAYOUT[district]
        return (
          <group key={district} position={[x, 0, z]}>
            <DistrictMonument
              accent={accent}
              district={district}
              emphasis={selectedDistrict === district}
              progress={progress[district]}
              team={team}
            />
          </group>
        )
      })}

      <CapitalComplex
        accent={accent}
        progress={progress}
        selectedDistrict={selectedDistrict}
        team={team}
        winnerBoost={winnerBoost}
      />

      <mesh position={[0, MESA_TOP_Y + 0.22, 0]} rotation-x={Math.PI / 2}>
        <torusGeometry args={[17.8, 0.24, 18, 72]} />
        <meshBasicMaterial color={accent.shield} transparent opacity={0.05 + progress.sys * 0.03 + winnerBoost * 0.03} />
      </mesh>

      <mesh position={[0, MESA_TOP_Y + 3.9 + progress.agi * 2.4 + winnerBoost * 0.8, 0]}>
        <cylinderGeometry args={[0.34, 0.92, 8.2 + progress.agi * 3.2 + team.heroCount * 0.8, 12, 1, true]} />
        <meshBasicMaterial
          color={selectedDistrict === 'agi' ? DISTRICT_TONES.agi.glow : accent.glow}
          side={THREE.DoubleSide}
          transparent
          opacity={0.04 + progress.agi * 0.06 + (team.active ? 0.03 : 0)}
        />
      </mesh>
    </group>
  )
}

function ConflictFlows({
  phase,
  selectedType,
  teams,
  variant,
}: {
  phase?: GamePhase
  selectedType?: CardType | null
  teams: [StrategicMapTeam, StrategicMapTeam]
  variant: SceneVariant
}) {
  const tone = resolveTypeTone(selectedType)
  const missileRefs = useRef<THREE.Mesh[]>([])
  const dataRefs = useMemo(() => Array.from({ length: 8 }, (_, flowIndex) => ({
    direction: flowIndex % 2 === 0 ? 1 : -1,
    laneOffset: (flowIndex - 3.5) * 1.5,
    speed: 0.09 + flowIndex * 0.012,
  })), [])

  useFrame((state) => {
    const elapsed = state.clock.getElapsedTime()
    missileRefs.current.forEach((mesh, index) => {
      const flow = dataRefs[index]
      if (!mesh) return

      const progress = (elapsed * flow.speed + index * 0.17) % 1
      const path = flow.direction === 1 ? progress : 1 - progress
      mesh.position.x = THREE.MathUtils.lerp(-24, 24, path)
      mesh.position.y = 5.2 + Math.sin(progress * Math.PI) * 5.4
      mesh.position.z = flow.laneOffset + Math.sin(progress * Math.PI * 2 + index) * 4.8
      mesh.rotation.z = flow.direction === 1 ? -Math.PI / 2 : Math.PI / 2
      mesh.rotation.x = 0.3 - Math.sin(progress * Math.PI) * 0.44
    })
  })

  const escalationPressure = clamp((teams[0].escalation + teams[1].escalation) / 12, 0, 1)
  const heroFocus = deriveHeroFocus(teams)
  const showBattleTraffic = variant === 'battle'

  return (
    <group visible={showBattleTraffic}>
      {dataRefs.map((flow, index) => (
        <mesh
          key={`flow-${flow.direction}-${index}`}
          ref={(mesh) => {
            if (mesh) missileRefs.current[index] = mesh
          }}
          castShadow
        >
          <coneGeometry args={[0.32 + (selectedType === 'MILITARY' ? 0.08 : 0), 1.7, 8]} />
          <meshStandardMaterial
            color={selectedType === 'MILITARY' ? DISTRICT_TONES.esc.accent : tone.beam}
            emissive={selectedType === 'MILITARY' ? DISTRICT_TONES.esc.glow : tone.glow}
            emissiveIntensity={0.3 + escalationPressure * 0.2 + heroFocus * 0.03}
            metalness={0.16}
            opacity={phase === 'AGE_TRANSITION' ? 0.9 : 0.78}
            roughness={0.26}
            transparent
          />
        </mesh>
      ))}
    </group>
  )
}

function MapEffects({
  heavyEffects,
  phase,
  selectedType,
  variant,
}: {
  heavyEffects: boolean
  phase?: GamePhase
  selectedType?: CardType | null
  variant: SceneVariant
}) {
  const { camera, gl, scene, size } = useThree()
  const composerRef = useRef<PostEffectComposer | null>(null)

  useEffect(() => {
    const composer = new PostEffectComposer(gl, {
      frameBufferType: THREE.HalfFloatType,
      multisampling: heavyEffects ? 4 : 0,
    })
    const renderPass = new RenderPass(scene, camera)
    const mainBloom = new BloomEffect({
      intensity: phase === 'AGE_TRANSITION' ? 0.9 : variant === 'hero' ? 0.72 : 0.52,
      luminanceSmoothing: 0.25,
      luminanceThreshold: 0.62,
      mipmapBlur: true,
    })
    const accentBloom = new BloomEffect({
      intensity: selectedType ? 0.24 : 0.1,
      luminanceSmoothing: 0.6,
      luminanceThreshold: 0.86,
      mipmapBlur: true,
    })
    const grain = new NoiseEffect({
      blendFunction: BlendFunction.SOFT_LIGHT,
      premultiply: true,
    })
    grain.blendMode.opacity.value = variant === 'hero' ? 0.018 : 0.012
    const vignette = new VignetteEffect({
      darkness: variant === 'hero' ? 0.52 : 0.44,
      offset: 0.22,
    })

    const effectPass = new EffectPass(camera, mainBloom, accentBloom, grain, vignette)
    effectPass.renderToScreen = true
    composer.addPass(renderPass)
    composer.addPass(effectPass)
    composer.setSize(size.width, size.height)

    composerRef.current = composer

    return () => {
      composer.dispose()
      composerRef.current = null
    }
  }, [camera, gl, heavyEffects, phase, scene, selectedType, size.height, size.width, variant])

  useFrame((_, delta) => {
    composerRef.current?.render(delta)
  }, 1)

  return null
}

function MapScene({
  age,
  heavyEffects,
  phase,
  selectedType,
  teams,
  variant,
  winner,
}: {
  age: 1 | 2 | 3
  heavyEffects: boolean
  phase?: GamePhase
  selectedType?: CardType | null
  teams: [StrategicMapTeam, StrategicMapTeam]
  variant: SceneVariant
  winner?: 0 | 1 | 'tie' | null
}) {
  const pointsLeader = Math.max(...teams.map((team) => team.projectedPoints), 1)
  const pulseTone = resolveTypeTone(selectedType)
  const heroFocus = deriveHeroFocus(teams)

  return (
    <>
      <fogExp2 attach="fog" args={['#94a8b0', variant === 'battle' ? 0.00115 : 0.0017]} />
      <Sky distance={450000} mieCoefficient={0.0015} mieDirectionalG={0.82} rayleigh={1.6} sunPosition={[48, 22, -28]} turbidity={3.25} />

      <ambientLight intensity={0.42} />
      <hemisphereLight args={['#f5f9ff', '#5c6855', 0.76]} />
      <directionalLight
        castShadow
        color="#fff6ea"
        intensity={2.08}
        position={[34, 58, 22]}
        shadow-bias={-0.00006}
        shadow-camera-bottom={-70}
        shadow-camera-left={-84}
        shadow-camera-right={84}
        shadow-camera-top={70}
        shadow-mapSize-height={2048}
        shadow-mapSize-width={2048}
      />
      <directionalLight color="#9cc7ff" intensity={0.18} position={[-46, 32, -20]} />
      <pointLight color={pulseTone.glow} distance={84} intensity={0.32 + heroFocus * 0.04} position={[0, 9, 0]} />

      <CameraRig selectedType={selectedType} variant={variant} />
      <Sparkles
        color={pulseTone.glow}
        count={variant === 'battle' ? 34 : 24}
        opacity={0.28}
        scale={[156, 32, 112]}
        size={3.2}
        speed={0.18}
      />

      <WaterSurface variant={variant} />
      <Bvh enabled firstHitOnly>
        <TerrainBoard selectedType={selectedType} variant={variant} />
        <WorldTerrainDetails />
        <FactionTerritory
          age={age}
          index={0}
          pointsLeader={pointsLeader}
          selectedType={selectedType}
          team={teams[0]}
          winner={winner}
        />
        <FactionTerritory
          age={age}
          index={1}
          pointsLeader={pointsLeader}
          selectedType={selectedType}
          team={teams[1]}
          winner={winner}
        />
        <ConflictFlows phase={phase} selectedType={selectedType} teams={teams} variant={variant} />
      </Bvh>

      <mesh position={[0, 0.26, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[10.6, 15.4, 72]} />
        <meshBasicMaterial color={pulseTone.beam} transparent opacity={0.025 + (phase === 'AGE_TRANSITION' ? 0.06 : 0)} />
      </mesh>

      <mesh position={[0, 0.44, 0]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[6.8, 56]} />
        <meshBasicMaterial color={pulseTone.glow} transparent opacity={0.02 + (selectedType ? 0.015 : 0)} />
      </mesh>

      <MapEffects heavyEffects={heavyEffects} phase={phase} selectedType={selectedType} variant={variant} />
      <AdaptiveDpr pixelated />
    </>
  )
}

function StrategicMapBackground({
  age,
  className,
  phase,
  selectedType,
  showPresentationOverlays = true,
  teams,
  variant = 'battle',
  winner,
}: StrategicMapBackgroundProps) {
  const [heavyEffects, setHeavyEffects] = useState(true)

  return (
    <div className={`strategic-map-shell ${className ?? ''}`}>
      <div className="strategic-map-host">
        <Canvas
          camera={{
            far: 260,
            fov: variant === 'battle' ? 40 : 43,
            near: 0.1,
            position: variant === 'battle' ? BATTLE_CAMERA.toArray() : HERO_CAMERA.toArray(),
          }}
          dpr={heavyEffects ? [1, 1.75] : [1, 1.2]}
          gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
          onCreated={({ gl, scene }) => {
            gl.setClearColor('#000000', 0)
            gl.outputColorSpace = THREE.SRGBColorSpace
            gl.shadowMap.enabled = true
            gl.shadowMap.type = THREE.PCFSoftShadowMap
            gl.toneMapping = THREE.ACESFilmicToneMapping
            gl.toneMappingExposure = variant === 'battle' ? 1.06 : 1.1
            scene.background = null
          }}
          shadows
        >
          <PerformanceMonitor
            flipflops={2}
            onChange={({ factor }) => {
              setHeavyEffects(factor > 0.5)
            }}
          >
            <MapScene
              age={age}
              heavyEffects={heavyEffects}
              phase={phase}
              selectedType={selectedType}
              teams={teams}
              variant={variant}
              winner={winner}
            />
          </PerformanceMonitor>
        </Canvas>
      </div>
      {showPresentationOverlays && (
        <>
          <div className={`strategic-map-wash strategic-map-wash-${variant}`} />
          <div className={`strategic-map-grid strategic-map-grid-${variant}`} />
        </>
      )}
    </div>
  )
}

export default StrategicMapBackground
