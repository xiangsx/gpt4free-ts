import { ComInfo } from '../../utils/pool';
import { Protocol } from 'puppeteer';

export interface Account extends ComInfo {
  email: string;
  password: string;
  recovery: string;
  token: string;
  user_id: string;
  cookies: Protocol.Network.CookieParam[];
}

export interface GenRequestOptions {
  aspectRatio: number;
  frameRate: number;
  camera: Record<string, unknown>; // Assuming `camera` is an object without a fixed schema
  parameters: {
    guidanceScale: number;
    motion: number;
    negativePrompt: string;
  };
  extend: boolean;
}

export interface GenFormDataBody {
  promptText: string;
  options: GenRequestOptions;
  userId: string;
}

// Additional interface for handling multipart form data might be needed depending on the setup

export interface GenerationResponse {
  success: boolean;
  data: {
    id: string;
    generation: {
      id: string;
      promptText: string;
      params: {
        options: {
          aspectRatio: number;
          frameRate: number;
          camera: {
            zoom: null | number;
            pan: null | number;
            tilt: null | number;
            rotate: null | number;
          };
          parameters: {
            motion: number;
            guidanceScale: number;
            negativePrompt: string;
            seed: null | number;
          };
          extend: boolean;
        };
        userId: string;
        promptText: string;
      };
      adjusted: boolean;
      upscaled: boolean;
      extended: number;
      videos: Array<{
        id: string;
        status: string;
      }>;
    };
  };
}

export interface LibraryVideo {
  success: boolean;
  data: {
    results: Array<{
      id: string;
      promptText: string;
      params: {
        options: {
          aspectRatio: number;
          frameRate: number;
          camera: {
            zoom: null | number;
            pan: null | number;
            tilt: null | number;
            rotate: null | number;
          };
          parameters: {
            motion: number;
            guidanceScale: number;
            negativePrompt: string;
            seed: null | number;
          };
          extend: boolean;
        };
        userId: string;
        promptText: string;
        sfx: false;
      };
      adjusted: boolean;
      upscaled: false;
      extended: number;
      videos: Array<{
        id: string;
        status: string;
        progress: number;
        seed?: number; // Optional to accommodate for different states
        resultUrl?: string;
        videoPoster?: string;
        imageThumb?: string;
        duration?: number;
        feedback?: number;
      }>;
    }>;
  };
}
