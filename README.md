# Surge Rule Studio

Surge Rule Studio 是一个自托管的 Surge 代理规则生成工具，用于分析网页域名、判断直连/代理/阻断分类，并导出 Surge `.list` 规则文件。

## 功能

- **域名提取** — 从目标网页的 HTML/CSS/JS/JSON 中自动提取所有域名
- **智能分类** — 将域名分为：国内直连、国外规则、区域敏感、阻断域名、广告/推广/跟踪
- **DNS 连通性检测** — 通过 DNS-over-HTTPS (Cloudflare/Google) 解析域名 IP，判断是否为中国 IP，显示直连/代理状态徽章
- **广告/追踪过滤** — 内置 263+ 广告/追踪域名后缀 + 子域名关键词匹配
- **域名分组** — 自动按基础域名聚合子域名，输入域名高亮显示
- **连通性筛选** — 按直连/代理/未知状态筛选域名列表
- **域名搜索** — 快速搜索定位域名
- **用途标签** — AI、Google、YouTube、Netflix 等标签分类管理规则
- **自定义标签** — 支持创建、持久化、删除自定义标签
- **Surge 证据** — 支持粘贴 Surge dump/log，识别 DIRECT/PROXY/BLOCKED 证据
- **GitHub 上传** — 增量保存规则到 GitHub 仓库

## 本地开发

```bash
npm install
npm run dev
```

打开 `http://localhost:3000`。

## 测试

```bash
npm run test            # 运行测试
npm run test -- --coverage  # 带覆盖率报告
```

覆盖率阈值：statements/branches/functions/lines 均 ≥ 95%。

## 技术栈

- Next.js + React + TypeScript
- Vitest + @testing-library/react
- Cloudflare Workers (部署目标)
- DNS-over-HTTPS (连通性检测)
