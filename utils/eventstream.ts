import {PassThrough, Stream} from "stream";
import {parseJSON} from "./index";

export class WriteEventStream {
    public stream: PassThrough;

    constructor() {
        this.stream = new PassThrough();
    }

    write(event: string, data: string) {
        if (!this.stream.closed) {
            this.stream.write(`event: ${event}\n`);
            this.stream.write(`data: ${JSON.stringify(data)}\n\n`);
        }
    }

    end(cb?: () => void) {
        this.stream?.end(cb);
    }
}

export class ReadEventStream {
    private readonly stream: Stream;

    constructor(stream: Stream) {
        this.stream = stream;
    }

    read(dataCB: ({event, data}: { event: string, data: string }) => void, doneCB: () => void) {
        let buffer = '';
        this.stream.on('data', data => {
            buffer += data.toString();
            let index = buffer.indexOf('\n\n');
            while (index !== -1) {
                const v = buffer.slice(0, index).trim();
                buffer = buffer.slice(index + 2);

                const lines = v.split('\n');
                const lineEvent = lines[0].replace('event: ', '');
                const lineData = lines[1].replace('data: ', '');
                dataCB({event: lineEvent, data: JSON.parse(lineData)});
                index = buffer.indexOf('\n\n');
            }
        });
        this.stream.on('close', doneCB);
    }
}
