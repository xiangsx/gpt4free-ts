import * as fs from 'fs';
import { PathOrFileDescriptor, WriteFileOptions } from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';
import path from 'path';
import { CreateNewAxios } from './proxyAgent';
import { downloadAndUploadCDN, downloadFile, replaceLocalUrl, uploadFile } from './index';
import { v4 } from 'uuid';

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
  const response = await CreateNewAxios({}, { proxy: false }).get(url, { responseType: 'stream' });
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
        reject(err);
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
 * 合并两个视频并剔除第一个视频的最后一帧
 * @param videoPath1 第一个视频文件路径
 * @param videoPath2 第二个视频文件路径
 * @param outputVideoPath 输出合并视频文件路径
 */
export async function mergeVideosExcludeLastFrame(video_url1: string, video_url2: string): Promise<string> {
  const [video1, video2] = await Promise.all([downloadFile(video_url1), downloadFile(video_url2)]);
  const tempVideoPath1 = `run/${v4()}.mp4`;
  const outputVideoPath = `run/${v4()}.mp4`;

  let frame_rate = 30;
  // 获取第一个视频的时长
  const videoDuration = await new Promise<number>((resolve, reject) => {
    ffmpeg.ffprobe(video1.outputFilePath, (err, metadata) => {
      if (err) {
        return reject(err);
      }
      frame_rate = eval(metadata.streams[0].r_frame_rate || '30');
      resolve(metadata.format.duration || 0);
    });
  });

  // 剔除第一个视频的最后一帧
  await new Promise<void>((resolve, reject) => {
    ffmpeg(video1.outputFilePath)
      .setStartTime('0')
      .setDuration(videoDuration - 1 / 30) // 假设视频帧率为30fps，可以根据实际帧率调整
      .output(tempVideoPath1)
      .on('end', () => {
        console.log(`剔除第一个视频的最后一帧完成：${tempVideoPath1}`);
        resolve();
      })
      .on('error', (err) => {
        console.error('剔除最后一帧时出错:', err);
        reject(err);
      })
      .run();
  });

  // 合并两个视频
  await new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input(tempVideoPath1)
      .input(video2.outputFilePath)
      .on('end', () => {
        console.log(`视频合并完成：${outputVideoPath}`);
        resolve();
      })
      .on('error', (err) => {
        console.error('合并视频时出错:', err);
        reject(err);
      })
      .mergeToFile(outputVideoPath, path.join(__dirname, 'temp'));
  });

  // 删除临时视频文件
  fs.unlinkSync(tempVideoPath1);
  const videoURL = await uploadFile(outputVideoPath);
  fs.unlinkSync(outputVideoPath);
  return videoURL;
}
