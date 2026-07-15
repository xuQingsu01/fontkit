#!/usr/bin/env node
/**
 * sitemap.xml 生成脚本
 *
 * 用法：
 *   node scripts/generate-sitemap.js
 *
 * 在 package.json 中配置为 build 步骤：
 *   "scripts": { "build": "node scripts/generate-sitemap.js" }
 *
 * 新增页面时，只需在 PAGES 数组里追加一条记录即可。
 */

import { writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── 站点配置 ──────────────────────────────────────────────────────────────────
const BASE_URL = "https://fontkit.qingsu.link";

/**
 * 页面列表
 *
 * loc         - 相对路径（会自动拼接 BASE_URL）
 * lastmod     - 最近修改日期，格式 YYYY-MM-DD；留空则使用今天
 * changefreq  - always / hourly / daily / weekly / monthly / yearly / never
 * priority    - 0.0 ~ 1.0
 *
 * 规则：
 *   - 删除页面 / 404 页面 / noindex 页面 → 不要加入此列表
 *   - 不要出现重复 URL
 */
const PAGES = [
  {
    loc: "/",
    lastmod: "",           // 留空 = 自动使用今天日期
    changefreq: "monthly",
    priority: "1.0",
  },
  // ── 新增页面示例 ───────────────────────────────────────────────────────────
  // {
  //   loc: "/about",
  //   lastmod: "2026-07-15",
  //   changefreq: "yearly",
  //   priority: "0.8",
  // },
];

// ── 生成逻辑 ──────────────────────────────────────────────────────────────────
const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

function buildEntry(page) {
  const url = BASE_URL + page.loc;
  const lastmod = page.lastmod || today;
  return [
    "  <url>",
    `    <loc>${url}</loc>`,
    `    <lastmod>${lastmod}</lastmod>`,
    `    <changefreq>${page.changefreq}</changefreq>`,
    `    <priority>${page.priority}</priority>`,
    "  </url>",
  ].join("\n");
}

const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...PAGES.map(buildEntry),
  "</urlset>",
  "",
].join("\n");

const outPath = resolve(__dirname, "../sitemap.xml");
writeFileSync(outPath, xml, "utf8");
console.log(`✅  sitemap.xml 已生成：${outPath}`);
console.log(`   共 ${PAGES.length} 个 URL`);
