# UNMI.IO — 域名资产管理与展示平台

<p align="center">
  <img src="https://img.shields.io/badge/Nuxt-3.14-00DC82?style=flat-square&logo=nuxt.js" alt="Nuxt 3" />
  <img src="https://img.shields.io/badge/SQLite-WAL-003B57?style=flat-square&logo=sqlite" alt="SQLite" />
  <img src="https://img.shields.io/badge/Tailwind-CSS-38B2AC?style=flat-square&logo=tailwindcss" alt="Tailwind" />
  <img src="https://img.shields.io/badge/TypeScript-5.6-3178C6?style=flat-square&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="MIT" />
  <img src="https://img.shields.io/npm/v/unmi-domain-manager?style=flat-square&color=red" alt="npm" />
</p>

<p align="center">
  <a href="./README.md">English</a> | <b>中文</b>
</p>

一套功能完整的本地优先域名资产管理系统，包含公开展示、域名抢注、WHOIS 查询和企业级安全认证。基于 **Nuxt 3 + SQLite + Tailwind CSS** 构建。

**在线演示：** [https://beta.unmi.io](https://beta.unmi.io)

---

## 安装

```bash
# npm
npm install unmi-domain-manager

# 或克隆仓库
git clone https://github.com/wresource/unmi_web.git
cd unmi_web && npm install
```

---

## 功能特性

### 域名管理系统
- **多账号** — 密码即账号，数据隔离
- **域名 CRUD** — 新增、编辑、删除、批量操作、标签管理
- **WHOIS/RDAP 自动识别** — 支持 100+ TLD，自动填充注册信息
- **续费价格对比** — nazhumi.com API，2900+ 后缀，59+ 注册商
- **AI 域名估值** — 基于 TLD 等级、长度、关键词、域龄的估值引擎
- **统计分析** — 续费预算、月度趋势、注册商分布、资产总估值
- **12 个注册人字段** — 姓名、组织、邮箱、电话、地址、管理/技术联系人
- **导入导出** — Excel (.xlsx) 和 CSV 格式

### 域名展示系统（公开）
- **dn.com 风格** 的公开域名市场
- **搜索筛选** — TLD、分类、价格区间、域名长度
- **域名详情页** — 估值、询价表单、SEO meta
- **询价系统** — 表单提交 + 后台管理

### 域名抢注模块
- **DropCatch.com API** 集成 — 真实拍卖数据
- **AllAuctions CSV 全量数据** — 每次刷新 27,000+ 域名
- **智能价格补充** — 36 次 API 调用覆盖更多价格
- **全部拍卖类型** — Dropped、PrivateSeller、PreRelease
- **每日自动更新** — 定时任务凌晨 2:00 执行
- **实时倒计时** — 校准 DropCatch ET 时区（19:00 UTC = 3PM ET）

### 通知与邮件
- **通知中心** — 到期提醒（7天/30天）、每日资产总结
- **邮件通知** — SMTP 配置，30+ 邮箱服务商预置，定期总结邮件

### 安全认证
- **三种认证方式：**
  - 密码 + TOTP（Google Authenticator 兼容，RFC 6238）
  - 授权设备 + 密码（ECDSA P-256 挑战-响应，不可导出私钥）
  - Passkey / WebAuthn（FIDO2，支持 iCloud 钥匙串同步）
- **10 个备份码**（一次性使用）
- **每账号最多 10 台授权设备**
- **AES-256-GCM** 敏感数据加密
- **可配置会话超时**（30 分钟 ~ 7 天）

### 多语言
- 中文 / 英文双语支持，900+ 翻译键
- 页面内一键切换

---

## 快速开始

### 环境要求
- Node.js 18+（推荐 20 LTS）
- npm 8+

### 开发模式

```bash
npm install
npm run dev
# 浏览器打开 http://localhost:3000
```

### 生产部署

```bash
npm run build
cp ecosystem.config.example.cjs ecosystem.config.cjs
# 编辑 ecosystem.config.cjs 配置端口和路径
pm2 start ecosystem.config.cjs
```

---

## 配置

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `3000` | 服务端口 |
| `HOST` | `localhost` | 监听地址 |
| `DB_PATH` | `./data/domain-manager.db` | SQLite 数据库路径 |
| `DROPCATCH_CLIENT_ID` | — | DropCatch.com API 客户端 ID |
| `DROPCATCH_CLIENT_SECRET` | — | DropCatch.com API 密钥 |
| `WEBAUTHN_RP_ID` | `beta.unmi.io` | WebAuthn 依赖方 ID |
| `WEBAUTHN_ORIGIN` | `https://beta.unmi.io` | WebAuthn 来源 URL |

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Nuxt 3, Vue 3, Nitro |
| 数据库 | SQLite (better-sqlite3, WAL 模式) |
| 样式 | Tailwind CSS |
| 图表 | ECharts + vue-echarts |
| 认证 | bcryptjs, otpauth (TOTP), @simplewebauthn (WebAuthn) |
| 加密 | Web Crypto API (ECDSA P-256), AES-256-GCM |
| 邮件 | Nodemailer |
| 进程 | PM2 |

---

## 项目规模

- **22 个页面** · **55+ API 端点** · **18 张数据表** · **10 个组件**
- **900+ i18n 翻译键** · **8 个服务端工具模块** · **3 个布局**

---

## 开源协议

[MIT](LICENSE) © 2026 [wresource](https://github.com/wresource)
