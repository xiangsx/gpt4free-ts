// Represents the audio file formats supported for transcription.
import { ModelType } from './base';
import FormData from 'form-data';
import exp from 'constants';
import { Clip } from './suno/define';

type AudioFileFormat =
  | 'flac'
  | 'mp3'
  | 'mp4'
  | 'mpeg'
  | 'm4a'
  | 'ogg'
  | 'wav'
  | 'webm';

// Supported languages in ISO-639-1 format for input audio.
type LanguageISO639_1 = string; // Placeholder, replace with actual ISO-639-1 type if available

// Defines the available response formats for the transcription.
type ResponseFormat = 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt';

// Defines the granularity options for timestamping in the transcription.
type TimestampGranularity = 'word' | 'segment';

// Interface describing the structure for the request to create a transcription.
export interface TranscriptionRequest {
  form: FormData;
  /**
   * The audio file object to be transcribed. It must be one of the defined audio file formats.
   */
  file: any; // Use 'Blob' type for file data in a TypeScript context

  /**
   * The model identifier used for transcription. Currently, only 'whisper-1' is available.
   */
  model: ModelType;

  /**
   * (Optional) The language of the input audio in ISO-639-1 format.
   * Providing this helps improve the accuracy and latency of the transcription.
   */
  language?: LanguageISO639_1;

  /**
   * (Optional) An additional text prompt to guide the transcription model's style or to continue a previous audio segment.
   * The provided prompt should be in the same language as the audio content.
   */
  prompt?: string;

  /**
   * (Optional) Specifies the format of the transcript output. Defaults to 'json'.
   */
  response_format?: ResponseFormat;

  /**
   * (Optional) A number between 0 and 1 that sets the sampling temperature.
   * Higher values can produce more random results, whereas lower values result in more deterministic transcriptions.
   * If set to 0, the model will use log probability to automatically adjust temperature.
   */
  temperature?: number;

  /**
   * (Optional) An array specifying the granularity of timestamps to be included in the transcription.
   * The 'response_format' must be set to 'verbose_json' to utilize this feature.
   * Note that there's no additional latency for segment timestamps, but word timestamps may incur additional latency.
   */
  timestamp_granularities?: TimestampGranularity[];
}

export interface CreateVideoTaskRequest {
  prompt?: string;
  image?: string;
  model: ModelType;
}

export interface QueryVideoTaskRequest {
  model: ModelType;
  id: string;
}

export interface ImageEditRequest {
  form: FormData;
  /**
   * The image to edit. This should be a valid PNG file, less than 4MB in size,
   * and square in dimension. Transparency in the image will be used as the mask
   * if no separate mask is provided.
   */
  image: string;

  /**
   * A text description of the desired image edit. The description should be
   * concise yet detailed, with a maximum length of 1000 characters.
   */
  prompt: string;

  /**
   * An optional mask image which defines areas to leave untouched (where alpha is zero)
   * during editing. This should be a valid PNG file, less than 4MB in size,
   * and have the same dimensions as the `image` field.
   */
  mask: string;

  /**
   * The model used for image generation. Currently, only `dall-e-2` is supported.
   * Defaults to 'dall-e-2' if not specified.
   */
  model?: ModelType.DallE3 | ModelType.DallE2;

  /**
   * The number of images to generate. Can be any integer from 1 to 10. Defaults to 1
   * if not specified.
   */
  n?: number;

  /**
   * The size of the generated images. This can be one of the predefined sizes:
   * 256x256, 512x512, or 1024x1024. Defaults to 1024x1024 if not specified.
   */
  size?: '256x256' | '512x512' | '1024x1024';

  /**
   * The format in which the generated images are returned. Can be either a URL or
   * a base64-encoded JSON object. URLs are only valid for 60 minutes after generation.
   * Defaults to 'url' if not specified.
   */
  response_format?: 'url' | 'b64_json';

  /**
   * An optional unique identifier representing the end-user, which helps OpenAI to monitor
   * and detect abuse of the service.
   */
  user?: string;
}
