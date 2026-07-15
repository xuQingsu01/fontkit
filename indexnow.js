#!/usr/bin/env node
/**
 * IndexNow 批量提交脚本
 * 用法：
 *   node indexnow.js                  → 提交 SITE_URLS 中的全部 URL
 *   node indexnow.js /path /about     → 提交指定路径（自动拼接域名）
 *
 * IndexNow 规范：https://www.indexnow.org/documentation
 */

import https from "https";
import { URL } from "url";

// ── 配置 ──────────────────────────────────────────────────────────────────────
const KEY = "5c9d8fb70877467abe3dfe3926e5c9e1";

/**
 * 从 sitemap.xml 读取 URL 或在此处维护页面列表。
 * 每新增一个页面，在这里追加一行。
 */
const SITE_URLS = [
  "https://fontkit.qingsu.link/",
];

// IndexNow 支持的搜索引擎端点（任意提交一次，其余引擎自动同步）
const INDEXNOW_HOST = "api.indexnow.org";
const INDEXNOW_PATH = "/indexnow";

// ── 工具函数 ──────────────────────────────────────────────────────────────────
function post(hostname, path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request(
      {
        hostname,
        path,
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Length": Buffer.byteLength(data),
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk) => (raw += chunk));
        res.on("end", () =>
          resolve({ status: res.statusCode, body: raw })
        );
      }
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

// ── 主逻辑 ────────────────────────────────────────────────────────────────────
async function submit(urls) {
  if (!urls.length) {
    console.error("❌  没有要提交的 URL");
    process.exit(1);
  }

  // 统一确保是完整 URL
  const fullUrls = urls.map((u) => {
    if (u.startsWith("http")) return u;
    // 以 / 开头的路径，拼接当前站点域名
    const base = new URL(SITE_URLS[0]).origin;
    return base + (u.startsWith("/") ? u : "/" + u);
  });

  // 从第一个 URL 中提取 host
  const host = new URL(fullUrls[0]).host;

  const payload = {
    host,
    key: KEY,
    keyLocation: `https://${host}/${KEY}.txt`,
    urlList: fullUrls,
  };

  console.log(`\n📤  提交 ${fullUrls.length} 个 URL 到 IndexNow...`);
  fullUrls.forEach((u) => console.log(`   → ${u}`));

  try {
    const { status, body } = await post(INDEXNOW_HOST, INDEXNOW_PATH, payload);
    if (status === 200 || status === 202) {
      console.log(`\n✅  成功！HTTP ${status}`);
    } else {
      console.error(`\n⚠️  返回 HTTP ${status}：${body}`);
    }
  } catch (err) {
    console.error("\n❌  请求失败：", err.message);
    process.exit(1);
  }
}

// CLI：node indexnow.js 或 node indexnow.js /page1 /page2
const args = process.argv.slice(2);
const targets = args.length > 0 ? args : SITE_URLS;
submit(targets);
