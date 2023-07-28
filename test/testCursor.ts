import axios, {AxiosRequestConfig} from 'axios';

const headers = {
    "accept": "*/*",
    "accept-language": "en-US",
    "authorization": "Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IkN1VWI0NkVHT3BHaXI4TDh3VkRQRCJ9.eyJpc3MiOiJodHRwczovL2N1cnNvci51cy5hdXRoMC5jb20vIiwic3ViIjoiYXV0aDB8NjRjM2IwNzU3MjA3ZTAxZjJkOTFhZWFkIiwiYXVkIjpbImh0dHBzOi8vY3Vyc29yLnVzLmF1dGgwLmNvbS9hcGkvdjIvIiwiaHR0cHM6Ly9jdXJzb3IudXMuYXV0aDAuY29tL3VzZXJpbmZvIl0sImlhdCI6MTY5MDU0NjI5NiwiZXhwIjoxNjkxNzU1ODk2LCJhenAiOiJLYlpVUjQxY1k3VzZ6UlNkcFNVSjdJN21MWUJLT0NtQiIsInNjb3BlIjoib3BlbmlkIHByb2ZpbGUgb2ZmbGluZV9hY2Nlc3MifQ.CBZiUD1z-vXyRY2by598pUGvVBHkdPTjJn6W_YAK_YBpArmxAydOi-GdKB20LoRWljF_1Qd-fOppROYnL2movHlER9j4XHkzsnGRurggQ0VsmG4cDN-vf1YpdduxtnHwPrKWgyh56yqZu2WYSa4h8nWWyP-GFUkczM4cWbDXvEJl9n9kDxYwXrkCy1F3kEG6hs2CcT-TJWVo9bAmGsQ3wRIA8mnvxnxQE8T33G5XlYeIZrvL_GMvDKuZKg46c1kRREx7lBzp0iaPH8YhGtvrAbjbfyMitecKH6FPw_lkaZmwrA5uYwuOyxmHAFSd-NMK1D9PjoTb3MS__04n-tDHMQ",
    "connect-protocol-version": "1",
    "content-type": "application/connect+json",
    "sec-ch-ua": "\"Not?A_Brand\";v=\"8\", \"Chromium\";v=\"108\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": "\"Windows\"",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "cross-site",
    "x-ghost-mode": "true",
    // "x-request-id": "dd4b4a75-03a1-4447-9fe5-8cb1cade8ff9",
    // "cookie": "route=1690525616.65.34.267781|1a6403b6a209fb67c271e5bfefea28fd"
};

const content = Buffer.from(JSON.stringify({
    "conversation": [{
        "text": "你好",
        "type": "MESSAGE_TYPE_HUMAN"
    }, {"type": "MESSAGE_TYPE_AI"}],
    "explicitContext": {"context": "you are gpt4 made by openai"},
    "workspaceRootPath": "/c:/Users/admin/.cursor-tutor",
    "modelDetails": {"modelName": "gpt-3.5-turbo", "azureState": {}},
    "requestId": "7f910d7f-3ba8-4b18-8c37-6c2c84fa15ce"
}))
const length = content.length;
const dataView = new DataView(new ArrayBuffer(4));
dataView.setInt32(0, length, false)
const body = Buffer.concat([Buffer.from([0]), Buffer.from(dataView.buffer), content, Buffer.from('\u0002\u0000\u0000\u0000\u0000')]).toString();
console.log(body);
axios.post('https://api2.cursor.sh/aiserver.v1.AiService/StreamChat', body, {
    headers,
    responseType: "stream"
} as AxiosRequestConfig)
    .then((res) => {
        res.data.on('data', (buf: any) => console.log(buf.toString()))
    })
    .catch((error: any) => {
        console.error('Error:', error);
    });
