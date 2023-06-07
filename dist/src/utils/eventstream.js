"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReadEventStream = exports.WriteEventStream = void 0;
const stream_1 = require("stream");
class WriteEventStream {
    constructor() {
        this.stream = new stream_1.PassThrough();
    }
    write(event, data) {
        if (!this.stream.closed) {
            this.stream.write(`event: ${event}\n`);
            this.stream.write(`data: ${data}\n\n`);
        }
    }
    end(cb) {
        var _a;
        (_a = this.stream) === null || _a === void 0 ? void 0 : _a.end(cb);
    }
}
exports.WriteEventStream = WriteEventStream;
class ReadEventStream {
    constructor(stream) {
        this.stream = stream;
    }
    read(dataCB, doneCB) {
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
                dataCB({ event: lineEvent, data: lineData });
                index = buffer.indexOf('\n\n');
            }
        });
        this.stream.on('close', doneCB);
    }
}
exports.ReadEventStream = ReadEventStream;
