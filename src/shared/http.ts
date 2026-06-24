import http from "node:http";
import https from "node:https";
import zlib from "node:zlib";

import { TowngasRequestError, TowngasTimeoutError } from "./errors.js";

export function requestText(url: any, options: any = {}) {
  const target = typeof url === "string" ? new URL(url) : url;
  const transport = target.protocol === "https:" ? https : http;
  const body = options.body;

  return new Promise((resolve, reject) => {
    const request = transport.request(
      target,
      {
        method: options.method ?? "GET",
        headers: options.headers,
        rejectUnauthorized: options.rejectUnauthorized ?? false
      },
      (response) => {
        const chunks = [];

        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          try {
            // 港华接口可能返回 gzip/br/deflate，这里统一解压为 UTF-8 文本。
            const buffer = decodeBody(Buffer.concat(chunks), response.headers["content-encoding"]);
            resolve({
              status: response.statusCode ?? 0,
              headers: response.headers,
              text: buffer.toString("utf8")
            });
          } catch (error) {
            reject(new TowngasRequestError(`响应解码失败: ${error.message}`, { cause: error }));
          }
        });
      }
    );

    request.on("error", (error) => {
      if (error instanceof TowngasTimeoutError) {
        reject(error);
        return;
      }
      reject(new TowngasRequestError(error.message, { cause: error }));
    });

    if (options.timeoutMs) {
      request.setTimeout(options.timeoutMs, () => {
        request.destroy(new TowngasTimeoutError(`请求在 ${options.timeoutMs}ms 后超时`));
      });
    }

    if (body) {
      request.write(body);
    }

    request.end();
  });
}

function decodeBody(buffer, contentEncoding = "") {
  const encoding = String(contentEncoding).toLowerCase();
  if (encoding.includes("br")) {
    return zlib.brotliDecompressSync(buffer);
  }
  if (encoding.includes("gzip")) {
    return zlib.gunzipSync(buffer);
  }
  if (encoding.includes("deflate")) {
    return zlib.inflateSync(buffer);
  }
  return buffer;
}
