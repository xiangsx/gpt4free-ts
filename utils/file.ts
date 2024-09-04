import * as fs from 'fs';
import { PathOrFileDescriptor, WriteFileOptions } from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';
import path from 'path';
import { CreateNewAxios } from './proxyAgent';
import {
  downloadAndUploadCDN,
  downloadFile,
  replaceLocalUrl,
  uploadFile,
} from './index';
import { v4 } from 'uuid';
import { exec } from 'node:child_process';

class SyncFileDebouncer {
  private static instance: SyncFileDebouncer;
  private readonly debounceTime: number;
  private timers: { [path: string]: NodeJS.Timeout } = {};

  private constructor(debounceTime: number = 300) {
    this.debounceTime = debounceTime;
  }

  public static getInstance(debounceTime?: number): SyncFileDebouncer {
    if (!SyncFileDebouncer.instance) {
      SyncFileDebouncer.instance = new SyncFileDebouncer(debounceTime);
    }
    return SyncFileDebouncer.instance;
  }

  public writeFileSync(
    file: string,
    data: string | NodeJS.ArrayBufferView,
    options?: WriteFileOptions,
  ) {
    if (this.timers[file]) {
      clearTimeout(this.timers[file]);
    }

    this.timers[file] = setTimeout(() => {
      fs.writeFileSync(file, data);
      delete this.timers[file];
    }, this.debounceTime);
  }
}

// 使用示例
export const fileDebouncer = SyncFileDebouncer.getInstance(500); // 100ms 的 debounce 时间

export function getImageExtension(contentType: string): string {
  switch (contentType) {
    case 'image/jpeg':
      return 'jpeg';
    case 'image/jpg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/gif':
      return 'gif';
    case 'image/bmp':
      return 'bmp';
    case 'image/webp':
      return 'webp';
    // Add other cases as needed
    default:
      throw new Error(`Unsupported content type: ${contentType}`);
  }
}

export function IsImageMineType(mimeType: string): boolean {
  return (
    mimeType === 'image/jpeg' ||
    mimeType === 'image/jpg' ||
    mimeType === 'image/png' ||
    mimeType === 'image/gif' ||
    mimeType === 'image/bmp' ||
    mimeType === 'image/webp'
  );
}

ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

/**
 * 提取视频的最后一帧并保存为图像文件
 * @param videoUrl 视频链接
 * @param outputImagePath 输出图像文件路径
 */
export async function extractVideoLastFrame(videoUrl: string): Promise<string> {
  const outputImagePath = `run/${v4()}.png`;
  const videoPath = `run/${v4()}.mp4`;

  // 下载视频到本地临时文件
  const localURL = await downloadAndUploadCDN(videoUrl);
  const url = replaceLocalUrl(localURL);
  const response = await CreateNewAxios({}, { proxy: false }).get(url, {
    responseType: 'stream',
  });
  const writer = fs.createWriteStream(videoPath);

  response.data.pipe(writer);

  await new Promise<void>((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });

  // 使用 ffmpeg 提取最后一帧
  await new Promise<void>((resolve, reject) => {
    ffmpeg(videoPath)
      .inputOptions('-sseof', '-1')
      .outputOptions('-vframes', '1')
      .output(outputImagePath)
      .on('end', () => {
        console.log(`提取最后一帧完成：${outputImagePath}`);
        resolve();
      })
      .on('error', (err) => {
        console.error('提取最后一帧时出错:', err);
        reject('extract last frame failed');
      })
      .run();
  });

  // 删除临时视频文件
  fs.unlinkSync(videoPath);
  const imageURL = await uploadFile(outputImagePath);
  fs.unlinkSync(outputImagePath);
  return imageURL;
}

/**
 * 获取视频的时长和帧率
 * @param videoPath 视频文件路径
 */
async function getVideoInfo(videoPath: string): Promise<{
  duration: number;
  frameRate: number;
  codec: string;
  width: number;
  height: number;
}> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        return reject('get video info failed');
      }
      const duration = metadata.format.duration!;
      const frameRate = eval(metadata.streams[0].r_frame_rate || '') || 0; // 计算帧率
      const codec = metadata.streams[0].codec_name!;
      const width = metadata.streams[0].width!;
      const height = metadata.streams[0].height!;
      resolve({ duration, frameRate, codec, width, height });
    });
  });
}

/**
 * 转换第一个视频为第二个视频的格式
 * @param inputPath 输入视频文件路径
 * @param outputPath 输出视频文件路径
 * @param codec 编码格式
 * @param width 视频宽度
 * @param height 视频高度
 * @param frameRate 视频帧率
 */
async function convertVideoFormat(
  inputPath: string,
  codec: string,
  width: number,
  height: number,
  frameRate: number,
): Promise<void> {
  const tempOutputPath = `run/${v4()}.mp4`;

  // 检测格式是不是已经是目标格式
  const {
    codec: inputCodec,
    width: inputWidth,
    height: inputHeight,
  } = await getVideoInfo(inputPath);
  if (inputCodec === codec && inputWidth === width && inputHeight === height) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    ffmpeg(inputPath)
      .size(`${width}x${height}`)
      .fps(frameRate)
      .aspect(`${width}:${height}`)
      .autopad(true, 'black')
      .output(tempOutputPath)
      .noAudio()
      .on('end', () => {
        fs.renameSync(tempOutputPath, inputPath); // 用转换后的文件覆盖原始文件
        console.log(`转换视频格式完成：${inputPath}`);
        resolve();
      })
      .on('error', (err) => {
        console.error(`转换视频格式时出错: ${err.message}`);
        reject('video format convert failed');
      })
      .run();
  });
}

/**
 * 合并两个视频并剔除第一个视频的最后一帧
 * @param videoPath1 第一个视频文件路径
 * @param videoPath2 第二个视频文件路径
 * @param outputVideoPath 输出合并视频文件路径
 */
export async function mergeVideosExcludeLastFrame(
  video_url1: string,
  video_url2: string,
): Promise<string> {
  const [video1, video2] = await Promise.all([
    downloadFile(video_url1),
    downloadFile(video_url2),
  ]);
  const outputVideoPath = `run/file/${v4()}.mp4`;

  const { duration, codec, width, height, frameRate } = await getVideoInfo(
    video2.outputFilePath,
  );
  await convertVideoFormat(
    video1.outputFilePath,
    codec,
    width,
    height,
    frameRate,
  );

  // 合并两个视频
  await new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input(video1.outputFilePath)
      .input(video2.outputFilePath)
      .on('end', () => {
        console.log(`视频合并完成：${outputVideoPath}`);
        resolve();
      })
      .on('error', (err) => {
        console.error('合并视频时出错:', err);
        reject('video merge failed');
      })
      .mergeToFile(outputVideoPath, path.join(__dirname, 'temp'));
  });

  // 删除临时视频文件
  const videoURL = await uploadFile(outputVideoPath);
  fs.unlinkSync(outputVideoPath);
  return videoURL;
}

export async function removeWatermarkFromVideo(
  video_url: string,
  watermarkX: number,
  watermarkY: number,
  watermarkWidth: number,
  watermarkHeight: number,
): Promise<string> {
  const video = await downloadFile(video_url);
  const outputVideoPath = `run/file/${v4()}.mp4`;

  // 获取视频信息
  const { codec, width, height, frameRate } = await getVideoInfo(
    video.outputFilePath,
  );

  // 确保水印坐标和尺寸在视频范围内
  const safeWatermarkX = Math.max(
    0,
    Math.min(watermarkX, width - watermarkWidth),
  );
  const safeWatermarkY = Math.max(
    0,
    Math.min(watermarkY, height - watermarkHeight),
  );
  const safeWatermarkWidth = Math.min(watermarkWidth, width - safeWatermarkX);
  const safeWatermarkHeight = Math.min(
    watermarkHeight,
    height - safeWatermarkY,
  );

  // 构建 FFmpeg 命令
  const ffmpegCommand = `${ffmpegInstaller.path} -i "${video.outputFilePath}" -vf "delogo=x=${safeWatermarkX}:y=${safeWatermarkY}:w=${safeWatermarkWidth}:h=${safeWatermarkHeight}:show=0" -c:v libx264 -preset fast -crf 22 -c:a copy "${outputVideoPath}"`;

  // 运行 FFmpeg 命令
  await new Promise<void>((resolve, reject) => {
    exec(ffmpegCommand, (error, stdout, stderr) => {
      if (error) {
        console.error('Error during watermark removal:', stderr);
        reject(error);
      } else {
        console.log('FFmpeg process completed:', stdout);
        resolve();
      }
    });
  });

  // 上传处理后的视频并删除本地文件
  const videoURL = await uploadFile(outputVideoPath);
  fs.unlinkSync(outputVideoPath);
  return videoURL;
}
/**
 * 获取音频文件的时长
 * @param filePath 音频文件的路径
 * @returns 一个 Promise，返回音频的时长（秒）
 */
export async function getAudioDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(err);
      } else {
        const duration = metadata.format.duration;
        if (!duration) {
          reject('get audio duration failed');
          return;
        }
        resolve(duration);
      }
    });
  });
}
