# Surge Rule Studio

自托管的 Surge 代理规则生成工具。分析网页域名，判断直连/代理/阻断分类，导出 Surge `.list` 规则文件。

## 功能

- **域名提取** — 从目标网页的 HTML/CSS/JS/JSON 中自动提取所有域名
- **智能分类** — 将域名分为：国内直连、国外规则、区域敏感、阻断域名、广告/推广/跟踪
- **DNS 连通性检测** — 通过 DNS-over-HTTPS（Cloudflare/Google）解析域名 IP，判断是否为中国 IP
- **广告/追踪过滤** — 内置 263+ 广告/追踪域名后缀 + 子域名关键词匹配
- **域名分组** — 自动按基础域名聚合子域名，输入域名高亮显示
- **连通性筛选** — 按直连/代理/未知状态筛选域名列表
- **域名搜索** — 快速搜索定位域名
- **用途标签** — AI、Google、YouTube、Netflix、Game、Podcast、Ads、Privacy 等标签
- **自定义标签** — 支持创建、持久化、删除自定义标签（localStorage）
- **Surge 证据** — 支持粘贴 Surge dump/log，识别 DIRECT/PROXY/BLOCKED 证据
- **GitHub 上传** — 增量保存规则到 GitHub 仓库

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Next.js 16（App Router） |
| 运行时 | Cloudflare Workers（vinext） |
| 数据库 | Cloudflare D1 |
| UI | React 19、Tailwind CSS 4、Lucide Icons |
| 测试 | Vitest、@testing-library/react、Playwright |
| 部署 | Cloudflare Workers / Docker |

## 快速开始

```bash
npm install
npm run dev
```

打开 `http://localhost:3000`。

## Docker

```bash
# 构建镜像
docker build -t surge-rule-studio .

# 本地运行
docker run -p 3000:3000 surge-rule-studio

# 使用 Docker Compose（见 docker-compose.yml）
docker compose up -d
```

## 部署

### Cloudflare Workers（推荐）

1. 在 GitLab → Settings → CI/CD → Variables 中设置：
   - `CLOUDFLARE_API_TOKEN` — Cloudflare API Token
   - `CLOUDFLARE_ACCOUNT_ID` — Cloudflare 账户 ID
2. 推送到 `main` 分支
3. 进入 CI/CD → Pipelines → 手动运行 `deploy` 任务

### GitLab CI/CD

`.gitlab-ci.yml` 定义两个阶段：
- **test** — 每次推送和合并请求时运行
- **deploy** — `main` 分支手动触发，部署到 Cloudflare Workers

### GitHub + Cloudflare Pages（镜像同步）

1. 在 GitLab → Settings → Repository → Mirrors 中添加 GitHub 作为推送镜像
2. 在 Cloudflare Pages 中连接 GitHub 仓库
3. 设置构建命令：`npm run build`，输出目录：`dist/client`

## 测试

```bash
npm run test            # 运行测试并生成覆盖率报告
npm run test:watch      # 监听模式
npm run test:e2e        # Playwright E2E 测试
```

覆盖率阈值（强制）：statements/branches/functions/lines 均 ≥ 95%。

## 项目结构

```
├── app/                    # Next.js App Router
│   ├── api/                # API 路由
│   │   ├── analyze/        # 域名分析接口
│   │   ├── connectivity/   # DNS 连通性检测
│   │   └── github/         # GitHub 上传接口
│   └── components/
│       └── RuleWorkbench.tsx   # 主界面组件
├── src/lib/
│   ├── surge.ts            # 域名提取、分类、规则生成
│   ├── connectivity.ts     # DNS-over-HTTPS + 中国 IP 检测
│   ├── probe.ts            # URL 分析编排器
│   └── github.ts           # GitHub Contents API 客户端
├── worker/
│   └── index.ts            # Cloudflare Worker 入口
├── tests/                  # 测试文件
├── Dockerfile
├── .gitlab-ci.yml
└── vitest.config.ts
```

## 许可证

[MIT](LICENSE)
