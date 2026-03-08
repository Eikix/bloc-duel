declare module 'fastnoise-lite' {
  export default class FastNoiseLite {
    static NoiseType: {
      OpenSimplex2: string
      OpenSimplex2S: string
      Cellular: string
      Perlin: string
      ValueCubic: string
      Value: string
    }

    static FractalType: {
      None: string
      FBm: string
      Ridged: string
      PingPong: string
      DomainWarpProgressive: string
      DomainWarpIndependent: string
    }

    constructor(seed?: number)

    SetNoiseType(noiseType: string): void
    SetFrequency(frequency: number): void
    SetFractalType(fractalType: string): void
    SetFractalOctaves(octaves: number): void
    SetFractalLacunarity(lacunarity: number): void
    SetFractalGain(gain: number): void
    SetFractalWeightedStrength(weightedStrength: number): void
    GetNoise(x: number, y: number, z?: number): number
  }
}
