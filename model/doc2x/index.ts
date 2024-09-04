import { Chat, ChatRequest, getFilesFromContent, ModelType } from '../base';
import { downloadFile, EventStream, sleep } from '../../utils';
import { Account } from './define';
import { Pool } from '../../utils/pool';
import { Config } from '../../utils/config';
import FormData from 'form-data';
import { v4 } from 'uuid';
import { Child } from './child';
import fs from 'fs';

export class Doc2x extends Chat {
  pool = new Pool<Account, Child>(
    this.options?.name || 'claude-api',
    () => Config.config.doc2x?.size || 0,
    (info, options) => {
      return new Child(this.options?.name || '', info, options);
    },
    (v) => {
      if (!v.apikey) {
        return false;
      }
      return true;
    },
    {
      delay: 1000,
      serial: () => Config.config.doc2x?.serial || 1,
      needDel: (info) => !info.apikey,
      preHandleAllInfos: async (allInfos) => {
        const oldSet = new Set(allInfos.map((v) => v.apikey));
        for (const v of Config.config.doc2x?.apikey_list || []) {
          if (!oldSet.has(v)) {
            allInfos.push({
              id: v4(),
              apikey: v,
            } as Account);
          }
        }
        return allInfos;
      },
    },
  );

  support(model: ModelType): number {
    switch (model) {
      case ModelType.Pdf2Text:
        return 5000;
      case ModelType.Pdf2TextOcr:
        return 5000;
      case ModelType.pdf2textProgress:
        return 5000;
      case ModelType.pdf2textProgressOcr:
        return 5000;
      case ModelType.Pdf2Json:
        return 5000;
      case ModelType.Pdf2JsonOCR:
        return 5000;
      default:
        return 0;
    }
  }

  async handlePDF(req: ChatRequest, stream: EventStream) {
    const child = await this.pool.pop();
    const files = getFilesFromContent(
      req.messages[req.messages.length - 1].content,
    );
    const file = files[files.length - 1];
    const { outputFilePath, file_name, mime } = await downloadFile(file);
    await sleep(5000);
    const ocr = req.model.endsWith('ocr');
    try {
      const form = new FormData();
      form.append('file', fs.createReadStream(outputFilePath), {
        filename: file_name,
        contentType: mime,
      });
      form.append('ocr', `${ocr}`);
      if (req.model.indexOf('json') !== -1) {
        return child.pdfToJSONStream(form, stream);
      }
      if (req.model.indexOf('progress') !== -1) {
        return child.pdfToMDWithProgressStream(form, stream);
      }
      return child.pdfToMDStream(form, stream);
    } catch (e: any) {
      this.logger.error(`handlePDF failed, err: ${e.message}`);
      throw e;
    }
  }

  async askStream(req: ChatRequest, stream: EventStream): Promise<void> {
    if (req.model.startsWith('pdf')) {
      return this.handlePDF(req, stream);
    }
  }
}
