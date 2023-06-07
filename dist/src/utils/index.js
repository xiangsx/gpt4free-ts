"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptWithAes256Cbc = exports.parseJSON = exports.randomStr = exports.md5 = exports.toEventStream = exports.toEventCB = void 0;
const event_stream_1 = __importDefault(require("event-stream"));
const stream_1 = require("stream");
const crypto = __importStar(require("crypto"));
const uuid_1 = require("uuid");
function toEventCB(arr, emit) {
    const pt = new stream_1.PassThrough();
    pt.write(arr);
    pt.pipe(event_stream_1.default.split(/\r?\n\r?\n/)) //split stream to break on newlines
        .pipe(event_stream_1.default.map(function (chunk, cb) {
        return __awaiter(this, void 0, void 0, function* () {
            const [eventStr, dataStr] = chunk.split(/\r?\n/);
            const event = eventStr.replace(/event: /, '');
            const data = dataStr.replace(/data: /, '');
            emit(event, data);
            cb(null, { data, event });
        });
    }));
}
exports.toEventCB = toEventCB;
function toEventStream(arr) {
    const pt = new stream_1.PassThrough();
    pt.write(arr);
    return pt;
}
exports.toEventStream = toEventStream;
function md5(str) {
    return crypto.createHash('md5').update(str).digest('hex');
}
exports.md5 = md5;
function randomStr() {
    return (0, uuid_1.v4)().split('-').join('').slice(-6);
}
exports.randomStr = randomStr;
function parseJSON(str, defaultObj) {
    try {
        return JSON.parse(str);
    }
    catch (e) {
        console.error(str, e);
        return defaultObj;
    }
}
exports.parseJSON = parseJSON;
function encryptWithAes256Cbc(data, key) {
    const hash = crypto.createHash('sha256').update(key).digest();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', hash, iv);
    let encryptedData = cipher.update(data, 'utf-8', 'hex');
    encryptedData += cipher.final('hex');
    return iv.toString('hex') + encryptedData;
}
exports.encryptWithAes256Cbc = encryptWithAes256Cbc;
