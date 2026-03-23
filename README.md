# UNMI.IO - 域名资产管理与展示系统

基于 **Nuxt 3 + SQLite** 构建的本地优先域名资产管理与公开展示平台。

**线上地址：** https://beta.unmi.io

---

## 系统概述

本系统包含两个子系统：

| 子系统 | 入口 | 认证 | 用途 |
|--------|------|------|------|
| **域名展示系统** | `/show` | 无需登录 | 面向公众，展示在售域名、搜索筛选、询价 |
| **域名管理系统** | `/unlock` → `/dashboard` | 密码登录 | 内部管理域名资产、统计分析、设置展示 |

---

## 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 框架 | Nuxt 3 (v3.14) | 全栈框架，SSR 渲染 |
| 运行时 | Node.js 20 | LTS 版本 |
| 数据库 | SQLite (better-sqlite3) | 本地嵌入式数据库，WAL 模式 |
| 样式 | Tailwind CSS | 原子化 CSS |
| 状态管理 | Pinia | Vue 3 官方状态管理 |
| 图标 | @nuxt/icon (Iconify) | material-symbols 图标集 |
| 图表 | ECharts + vue-echarts | 统计分析可视化 |
| 加密 | AES-256-GCM + scrypt + bcrypt | 敏感数据加密存储 |
| 进程管理 | PM2 | 生产环境守护进程 |
| 反向代理 | Nginx | HTTPS + gzip |
| SSL | Let's Encrypt | 自动续期 |

---

## 项目结构

```
/www/wwwroot/unmi.io/
├── pages/                          # 20 个页面
│   ├── index.vue                   # 入口（重定向到 /show）
│   ├── unlock.vue                  # 登录/创建账号
│   ├── dashboard.vue               # 管理仪表盘
│   ├── domains/                    # 域名 CRUD
│   │   ├── index.vue               #   列表（搜索/筛选/排序/批量操作）
│   │   ├── create.vue              #   新增（自动识别 + 价格参考 + 估值）
│   │   └── [id]/
│   │       ├── index.vue           #   详情（续费记录/Whois/标签）
│   │       └── edit.vue            #   编辑
│   ├── statistics.vue              # 统计分析（图表 + 估值 + 续费预算）
│   ├── whois.vue                   # WHOIS 查询（RDAP + 传统 WHOIS）
│   ├── import-export.vue           # Excel/CSV 导入导出
│   ├── backup-sync.vue             # 备份与恢复
│   ├── settings.vue                # 系统设置
│   ├── showcase-settings.vue       # 展示设置（4 个 Tab）
│   ├── about.vue                   # 关于项目
│   └── show/                       # 公开展示页面
│       ├── index.vue               #   展示首页（Hero + 精品推荐 + 分类）
│       ├── domains/
│       │   ├── index.vue           #   域名市场（搜索/筛选/排序）
│       │   └── [name].vue          #   域名详情（估值 + 询价）
│       ├── inquiry.vue             #   询价表单
│       ├── faq.vue                 #   常见问题
│       └── about.vue               #   关于我们
│
├── server/
│   ├── database/index.ts           # SQLite 初始化 + 11 张表 + 迁移
│   ├── api/                        # 49 个 API 端点
│   │   ├── auth/                   #   认证（setup/unlock/status）
│   │   ├── domains/                #   域名 CRUD + 统计 + 导入导出
│   │   ├── tags/                   #   标签管理
│   │   ├── renewal-records/        #   续费记录
│   │   ├── whois/                  #   WHOIS 查询 + 自动填充
│   │   ├── pricing/                #   续费价格查询（nazhumi.com API）
│   │   ├── appraisal/              #   域名估值
│   │   ├── backup/                 #   备份导入导出
│   │   ├── settings/               #   系统设置
│   │   ├── show/                   #   公开 API（无需认证）
│   │   └── showcase/               #   展示管理 API
│   └── utils/                      # 8 个工具模块
│       ├── whois.ts                #   WHOIS/RDAP 查询引擎（100+ TLD）
│       ├── pricing.ts              #   续费价格查询（nazhumi.com）
│       ├── appraisal.ts            #   域名估值引擎
│       ├── crypto.ts               #   AES-256-GCM 加密
│       ├── keystore.ts             #   密钥管理（scrypt 派生）
│       ├── ratelimit.ts            #   令牌桶速率限制
│       ├── clientip.ts             #   真实 IP 获取
│       └── account.ts              #   账号 ID 提取
│
├── components/
│   ├── common/                     # 7 个通用组件
│   │   ├── StatusBadge.vue         #   状态标签
│   │   ├── DaysRemaining.vue       #   剩余天数（颜色标识）
│   │   ├── StatCard.vue            #   统计卡片
│   │   ├── Pagination.vue          #   分页器
│   │   ├── Modal.vue               #   弹窗
│   │   ├── ConfirmDialog.vue       #   确认对话框
│   │   └── Toast.vue               #   消息提示
│   └── show/                       # 3 个展示组件
│       ├── DomainCard.vue          #   域名展示卡片
│       ├── SearchBar.vue           #   搜索栏
│       └── InquiryModal.vue        #   询价弹窗
│
├── layouts/
│   ├── default.vue                 # 管理系统布局（侧栏 + 顶栏）
│   ├── showcase.vue                # 展示系统布局（导航 + 页脚）
│   └── auth.vue                    # 登录页布局
│
├── stores/
│   ├── auth.ts                     # 认证状态（accountId/unlocked）
│   └── app.ts                      # 应用状态（sidebar/title）
│
├── composables/useToast.ts         # Toast 通知
├── middleware/auth.global.ts       # 全局认证守卫
├── plugins/
│   ├── api-auth.ts                 # 自动附加 x-account-id 头
│   └── echarts.client.ts           # ECharts SSR 兼容
│
├── data/domain-manager.db          # SQLite 数据库文件
├── nuxt.config.ts
├── tailwind.config.ts
├── ecosystem.config.cjs            # PM2 配置
└── package.json
```

---

## 数据库设计

### 表结构（11 张表）

```
accounts            # 多账号系统（密码即账号）
├── id, name, password_hash (bcrypt)
├── is_public, contact_email, contact_wechat
│
domains             # 域名主表（按 account_id 隔离）
├── 基础: domain_name, tld, registrar, status
├── 时间: registration_date, expiry_date, auto_renew
├── 财务: purchase_price, renewal_price, hold_cost (明文+加密双存)
├── 展示: is_public, show_price, price_type, show_description, is_featured
├── 安全: encrypted_data (AES-256-GCM 加密的财务数据)
│
renewal_records     # 续费记录
tags                # 标签
domain_tags         # 域名-标签关联
show_categories     # 展示分类
inquiries           # 询盘记录
whois_query_logs    # WHOIS 查询缓存
sync_backup_logs    # 备份日志
settings            # 系统配置（含 device_salt）
migrations          # 迁移版本
faqs                # 常见问题
```

### 索引（16 个）

domains 表: `account_id`, `domain_name`, `tld`, `registrar`, `status`, `expiry_date`, `is_public`, `is_featured`, `show_category_id`, `account_id+domain_name` (唯一)

---

## 核心功能模块

### 1. 多账号系统
- 密码即账号：每个密码对应独立的数据空间
- 数据隔离：所有域名数据按 `account_id` 分离
- 登录页提供「登录」和「创建账号」两个入口

### 2. 域名管理
- 完整 CRUD + 批量操作
- 搜索/筛选/排序（注册商、状态、TLD、标签、到期天数）
- 自动识别：输入域名 → WHOIS + 续费价格 + 估值一键填充

### 3. WHOIS/RDAP 查询引擎
- RDAP 优先（IANA 引导文件自动发现服务器）
- 传统 WHOIS 兜底（原生 TCP Socket，100+ TLD 服务器映射）
- 特殊格式解析：.jp/.de/.br/.uk/.fr/.cn
- 5 分钟查询缓存，避免重复请求

### 4. 续费价格查询
- 集成 nazhumi.com 免费 API
- 并行查询注册/续费/转入价格
- 覆盖 2900+ 后缀、59+ 注册商
- 最低价高亮 + 一键应用价格

### 5. 域名估值引擎
- 基于规则的估值算法（非外部 API 依赖）
- 评估因素：TLD 等级（5 级）、域名长度、字符组成、关键词、域龄
- 特殊模式加成：数字域名（吉利数字/重复/顺子）、CVCV 音节
- 输出 USD/CNY 估值 + 置信度 + 因素分析

### 6. 统计分析
- 概览卡片：域名总数、到期预警、续费预算
- 图表：月度趋势、注册商分布、后缀分布、到期分布
- 域名资产估值：总估值 vs 总成本、ROI、逐域名估值明细
- 时间范围/注册商/后缀筛选联动

### 7. 域名展示系统
- 公开首页：Hero 搜索 + 精品推荐 + 分类导航
- 域名市场：多维筛选（TLD/分类/价格/长度）+ 排序 + 分页
- 域名详情：估值分析 + 询价表单 + 相关推荐
- 展示管理：批量设置公开/精品/价格/描述、分类管理、询盘跟进
- 隐私控制：无名账号不可展示，内部字段不对外暴露

### 8. 导入导出
- 支持 Excel (.xlsx) 和 CSV
- 客户端文件解析（SheetJS）
- 字段映射 + 预览 + 校验

---

## 安全架构

### 认证安全
| 措施 | 实现 |
|------|------|
| 密码存储 | bcrypt 哈希（10 轮 salt） |
| 会话隔离 | 服务端内存存储 accountId → 加密密钥 |
| 路由守卫 | 全局中间件，`/show` 路径公开，其余需认证 |

### 数据加密
| 措施 | 实现 |
|------|------|
| 加密算法 | AES-256-GCM（认证加密） |
| 密钥派生 | scrypt(password_hash + device_salt) |
| 加密字段 | 购入价、续费价、持有成本、备注 → `encrypted_data` |
| 双重保护 | 需要密码 + device_salt 才能解密 |

### API 安全
| 措施 | 实现 |
|------|------|
| 速率限制 | 令牌桶算法（per-IP + 全局） |
| WHOIS 限速 | 每 IP 10次突发/每3秒恢复1次；全局 2次/秒 |
| 询价限速 | 每 IP 3次/分钟 |
| 真实 IP | X-Real-IP → X-Forwarded-For → CF-Connecting-IP |
| 查询缓存 | WHOIS 结果 5 分钟缓存 |
| 数据隔离 | 公开 API 不暴露 purchase_price/hold_cost/memo/account_id |

---

## 部署架构

```
用户浏览器
    ↓ HTTPS (443)
Nginx (反向代理)
    ├── SSL 终止 (Let's Encrypt)
    ├── Gzip 压缩
    ├── 静态资源缓存 (30d)
    └── proxy_pass → 127.0.0.1:3001
          ↓
PM2 (进程守护)
    └── Nuxt 3 Server (Nitro)
          ├── SSR 页面渲染
          ├── API 路由处理
          └── SQLite 数据库 (WAL 模式)
                └── /www/wwwroot/unmi.io/data/domain-manager.db
```

### 环境要求
- Node.js >= 18
- PM2 (全局安装)
- Nginx (反向代理)

### 部署命令
```bash
# 安装依赖
npm install

# 构建生产版本
npm run build

# PM2 启动
pm2 start ecosystem.config.cjs

# PM2 开机自启
pm2 save && pm2 startup

# 查看日志
pm2 logs domain-manager

# 重启
pm2 restart domain-manager
```

### Nginx 配置要点
```nginx
server {
    listen 443 ssl;
    server_name beta.unmi.io;

    ssl_certificate /etc/letsencrypt/live/beta.unmi.io/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/beta.unmi.io/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header X-Real-IP $remote_addr;           # 传递真实 IP
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 外部 API 集成

| 服务 | 用途 | 认证 | 限制 |
|------|------|------|------|
| IANA RDAP Bootstrap | RDAP 服务器发现 | 无需 | 缓存 24h |
| 各注册局 RDAP 服务器 | 域名 WHOIS 信息 | 无需 | 速率限制保护 |
| 各注册局 WHOIS 服务器 | 域名 WHOIS 信息（TCP:43） | 无需 | 速率限制保护 |
| nazhumi.com API | 域名续费价格比较 | 无需 | 缓存 1h |
| Iconify API | 图标加载 | 无需 | CDN |

---

## 数据量与性能

- 设计支持单账号 10,000 条域名记录
- SQLite WAL 模式，支持并发读取
- 查询响应 < 1 秒（已建索引）
- WHOIS 查询结果缓存 5 分钟
- 价格查询结果缓存 1 小时
- 前端 SSR 首屏渲染，静态资源 30 天缓存

---

## 快速开始

### 环境要求

| 依赖 | 最低版本 | 说明 |
|------|---------|------|
| Node.js | 18+ | 推荐 20 LTS |
| npm | 8+ | 随 Node.js 安装 |
| PM2 | 5+ | `npm install -g pm2` |
| Nginx | 1.18+ | 反向代理（可选，开发模式不需要） |

### 1. 克隆项目

```bash
git clone https://github.com/你的用户名/unmi.io.git
cd unmi.io
```

### 2. 安装依赖

```bash
npm install
```

### 3. 本地开发

```bash
npm run dev
```

浏览器打开 `http://localhost:3000`，首次访问会进入登录页，创建账号即可开始使用。

### 4. 生产部署

#### 4.1 构建

```bash
npm run build
```

#### 4.2 配置 PM2

编辑 `ecosystem.config.cjs`，修改以下参数：

```js
module.exports = {
  apps: [{
    name: 'domain-manager',
    script: '.output/server/index.mjs',
    cwd: '/你的项目路径',          // ← 改为实际路径
    env: {
      PORT: 3001,                  // ← 修改端口
      HOST: '127.0.0.1',          // ← 0.0.0.0 可外网直接访问
      NODE_ENV: 'production',
      DB_PATH: '/你的项目路径/data/domain-manager.db',  // ← 数据库路径
    },
  }],
}
```

#### 4.3 启动

```bash
# 启动服务
pm2 start ecosystem.config.cjs

# 查看状态
pm2 status

# 查看日志
pm2 logs domain-manager

# 设置开机自启
pm2 save
pm2 startup
```

### 5. 绑定域名（Nginx 反向代理）

创建 Nginx 配置文件（例如 `/etc/nginx/sites-available/yourdomain.conf`）：

```nginx
# HTTP → HTTPS 重定向
server {
    listen 80;
    server_name yourdomain.com;  # ← 改为你的域名

    location ^~ /.well-known/acme-challenge/ {
        allow all;
        root /你的项目路径;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS
server {
    listen 443 ssl;
    http2 on;
    server_name yourdomain.com;  # ← 改为你的域名

    # SSL 证书路径（Let's Encrypt 示例）
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://127.0.0.1:3001;  # ← 与 PM2 端口一致
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;  # 重要：传递真实 IP
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        proxy_pass http://127.0.0.1:3001;
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;
    gzip_min_length 1k;
    gzip_comp_level 5;

    access_log /var/log/nginx/yourdomain.access.log;
    error_log /var/log/nginx/yourdomain.error.log;
}
```

```bash
# 启用配置
ln -s /etc/nginx/sites-available/yourdomain.conf /etc/nginx/sites-enabled/

# 测试配置
nginx -t

# 重载 Nginx
nginx -s reload
```

### 6. SSL 证书（Let's Encrypt）

```bash
# 安装 certbot
apt install certbot

# 获取证书（确保 Nginx 已配置 HTTP 并指向项目目录）
certbot certonly --webroot -w /你的项目路径 -d yourdomain.com

# 证书会自动续期（certbot 配置了 systemd timer）
```

### 7. 更新部署

```bash
cd /你的项目路径
git pull
npm install
npm run build
pm2 restart domain-manager
```

---

## 配置参考

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `3000` | 服务端口 |
| `HOST` | `localhost` | 监听地址，`0.0.0.0` 允许外网访问 |
| `NODE_ENV` | `development` | 生产环境设为 `production` |
| `DB_PATH` | `./data/domain-manager.db` | SQLite 数据库文件路径 |

### 数据库

数据库文件在首次启动时自动创建，无需手动初始化。默认位于 `data/domain-manager.db`。

**备份数据库：**
```bash
cp data/domain-manager.db data/backup-$(date +%Y%m%d).db
```

**迁移说明：** 程序启动时自动检测表结构并执行必要的迁移，无需手动操作。

### 多语言

系统支持中文和英文，通过页面上的 `EN / 中文` 按钮切换。语言偏好存储在浏览器 localStorage 中。

翻译文件位于 `i18n/zh-CN.json` 和 `i18n/en.json`，可自行扩展其他语言。

---

## 常见问题

**Q: 忘记密码怎么办？**
A: 密码以 bcrypt 哈希存储，无法恢复。可以删除数据库文件 `data/domain-manager.db` 重新初始化（数据将丢失），或通过 SQLite 工具直接删除 accounts 表中的记录。

**Q: 如何修改默认端口？**
A: 开发模式修改 `nuxt.config.ts` 中的 devServer 配置；生产模式修改 `ecosystem.config.cjs` 中的 `PORT` 环境变量。

**Q: 能否部署在子路径下（如 /admin/）？**
A: 当前不支持子路径部署，系统设计为根路径运行。

**Q: WHOIS 查询为什么有时候失败？**
A: 部分注册局限制查询频率。系统内置了速率限制（每 IP 每 3 秒 1 次）和 5 分钟缓存来保护服务器 IP 不被封禁。

**Q: 如何只部署展示系统不要管理后台？**
A: 不需要特殊配置。默认首页就是展示系统（`/show`），管理后台需要密码登录才能访问。未创建账号前，管理后台不可用。

---

## 开发

```bash
# 开发模式（热重载）
npm run dev

# 构建生产版本
npm run build

# 预览构建结果
npm run preview

# 类型检查
npx nuxi typecheck
```

---

## License

MIT
