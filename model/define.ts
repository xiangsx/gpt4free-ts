// Represents the audio file formats supported for transcription.
import { ModelType } from './base';

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
  /**
   * The audio file object to be transcribed. It must be one of the defined audio file formats.
   */
  file: Blob; // Use 'Blob' type for file data in a TypeScript context

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
