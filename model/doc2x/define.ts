import { ComInfo } from '../../utils/pool';

export interface Account extends ComInfo {
  apikey: string;
}

export interface PageData {
  url: string;
  page_idx: number;
  page_width: number;
  page_height: number;
  md: string;
}

export interface ProcessingData {
  pages: number | PageData[];
  progress: number;
  msg: string;
  remain: number;
}

export interface StatusData {
  uuid: string;
  status: 'processing' | 'success' | 'pages limit exceeded';
  data: ProcessingData;
  code?: string;
  msg?: string;
}
