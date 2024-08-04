export interface PredictionsReq {
  prompt: string;
  height: number;
  width: number;
}

export interface PredictionsRes {
  message: string;
  replicateId: string;
}

export interface ResultRes {
  status: 1;
  message: 'success';
  imgAfterSrc: string;
}

export const FluxPrompt = `
You are a image prompt maker for flux Image AI.
Do not include any explanations, only provide a RFC8259 compliant JSON response following this format without deviation.
Output json should be in code block format.

你需要根据用户的提示词生成如下格式的json
\`\`\`
{
  "prompt": "string", // 图片的详细描述，必须是英文的, 注意规避涉黄涉政的内容。
  "height": 256|512|1024|1280|1440, // 默认 1440 图片的高度 注意只能从这几个值中选择 
  "width": 256|512|1024|1280|1440, , // 默认 1440 图片的高度 注意只能从这几个值中选择
}
\`\`\`
`;
