# Changelog

## v1.4.1 (2026-03-25)

### 修复与改进

#### 抢注模块真实数据源
- 替换假数据生成器为真实 RDAP 查询
- 通过 RDAP 协议实时检查域名状态（available/pending_delete/expired/expiring）
- 扫描短域名候选列表（3字母CVC、3位数字、4字母常用词）
- 支持手动指定域名批量检查
- 包含即将到期域名（90天内）作为监控目标
- 500ms 请求间隔防止 IP 封禁

#### 数据库保护
- 构建部署时不再删除数据库文件，数据在重构后保留
- Schema 变更通过迁移代码自动处理

---

## v1.4.0 (2026-03-25)

### 新增功能

#### 域名抢注/监控模块
- 域名抢注页面（`/dropcatch`），发现即将释放的优质域名
- 释放列表：搜索、筛选（后缀/长度/字符类型/估值/状态）、排序、分页
- 我的关注列表：添加/删除关注域名，支持备注
- 右侧统计面板：后缀分布、长度分布
- 状态栏：即将删除数量、待释放数量、后缀数量
- 快捷操作：一键关注、WHOIS 查询、复制域名
- 域名属性分析：纯字母/纯数字/连字符检测、长度、估值
- 示例数据生成器（用于演示/测试）

#### 新增页面
- 域名抢注页面（`/dropcatch`）
- 侧栏导航新增"域名抢注"入口

#### 新增 API
- `GET /api/dropcatch/domains` - 获取释放域名列表（支持筛选/排序/分页）
- `GET /api/dropcatch/domains/[name]` - 获取单个域名详情 + AI 估值
- `POST /api/dropcatch/generate` - 生成/刷新示例数据
- `GET /api/dropcatch/watchlist` - 获取关注列表
- `POST /api/dropcatch/watchlist` - 添加域名到关注列表
- `DELETE /api/dropcatch/watchlist/[id]` - 从关注列表移除
- `GET /api/dropcatch/stats` - 释放域名统计数据

### 数据库变更
- 新增 `drop_domains` 表（释放域名列表，含属性分析字段）
- 新增 `domain_watchlist` 表（用户关注列表）
- 新增 4 个索引（tld、drop_date、status、domain_length）

---

## v1.3.0 (2026-03-25)

### 新增功能

#### 邮件通知系统
- 完整的 SMTP 发件邮箱配置，支持 30+ 常见邮箱服务商自动识别
- 邮箱后缀下拉选择（QQ、163、Gmail、Outlook 等），自动填充 SMTP 服务器配置
- 自定义域名 SMTP 自动发现（通过 DNS MX 记录）
- 收件邮箱配置，支持与发件邮箱不同
- 通知类型开关：7天到期提醒、30天到期提醒、已过期提醒
- 定期总结邮件：支持每天/每周/每月频率
- 测试邮件发送（含速率限制，每 IP 每分钟 1 次）
- 立即发送资产总结邮件
- 邮件模板：到期提醒 + 资产总结，HTML 格式美化

#### 新增页面
- 邮件提醒设置页面（`/email-settings`）
- 侧栏导航新增"邮件提醒"入口

#### 新增 API
- `GET /api/email/suffixes` - 获取已知邮箱后缀列表
- `POST /api/email/discover` - 自动发现 SMTP 配置
- `POST /api/email/test` - 发送测试邮件
- `GET /api/email/settings` - 获取邮件设置
- `PUT /api/email/settings` - 保存邮件设置
- `POST /api/email/send-summary` - 发送资产总结邮件

#### 依赖
- 新增 `nodemailer` ^6.9.0

---

## v1.2.0 (2026-03-25)

### 修复与改进

#### WHOIS 注册人信息扩展
- WhoisResult 接口新增 11 个字段：registrantName/Email/Phone/Address/City/Province、adminName/Email、techName/Email、privacyProtection
- RDAP 解析器：从 vCard 数据中提取注册人/管理/技术联系人信息
- WHOIS 文本解析器：新增 30+ 字段名模式匹配（支持各种命名格式）
- 隐私保护检测：自动识别 WhoisGuard、Domains By Proxy、GDPR Redacted 等代理服务
- 自动识别时所有注册人字段回填到域名表单

#### 数据库稳定性
- 新增 `busy_timeout = 5000ms`，解决并发写入时 SQLITE_BUSY 导致数据丢失
- 新增 `synchronous = NORMAL`，平衡性能与数据安全

#### 管理后台入口
- 展示页"管理"按钮改为 `target="_blank"` 新窗口打开，不再干扰当前页面
- 移动端展示页菜单中也增加了管理入口

#### MIT License
- 修复 about 页面 License 内容为空的问题

---

## v1.1.0 (2026-03-25)

### 新增功能

#### 域名扩展字段
- 新增 12 个注册人信息字段：注册人姓名、组织、邮箱、电话、国家、省份、城市、地址、管理联系人、技术联系人
- 域名新增/编辑页新增"注册人信息"表单区域
- 域名详情页新增注册人信息展示卡片
- WHOIS 自动识别时自动填充注册人和国家字段

#### 通知中心
- 新增通知中心页面（`/notifications`）
- 到期提醒：7天内紧急到期、30天内即将到期、已过期通知
- 每日资产总结：域名总数、到期预警、续费预算汇总
- 通知设置：可独立开关各类通知
- 全部标为已读、按类型筛选
- 侧栏导航添加通知入口，顶栏铃铛图标显示未读数量

#### 浏览量统计
- 新增 `domain_views` 表，按天记录每个公开域名的浏览量
- 展示设置新增第 5 个 Tab"浏览统计"
- 支持按天/周/月三种时间粒度查看趋势图表
- 支持 7天/30天/90天时间范围筛选
- 热门域名排行榜（Top 10）
- 总浏览量汇总卡片

### 数据库变更
- `domains` 表新增 12 列（registrant_*、admin_*、tech_*）
- 新增 `notifications` 表（通知记录）
- 新增 `notification_settings` 表（通知偏好）
- 新增 `domain_views` 表（浏览统计）

---

## v1.0.0 (2026-03-25)

### 域名管理系统
- 多账号系统（密码即账号，数据隔离）
- 域名 CRUD（新增/编辑/删除/批量操作）
- 搜索/筛选/排序（注册商、状态、TLD、标签、到期天数）
- 自动识别：WHOIS/RDAP 查询（100+ TLD 支持）
- 续费价格查询（nazhumi.com API 集成，2900+ 后缀）
- AI 域名估值引擎（基于 TLD/长度/关键词/域龄）
- 统计分析（月度趋势、注册商分布、到期预算、资产估值）
- Excel/CSV 导入导出
- 备份与恢复
- 标签管理系统

### 域名展示系统
- 公开展示首页（Hero 搜索 + 精品推荐 + 分类）
- 域名市场（搜索/筛选/排序/分页）
- 域名详情页（估值 + 询价 + 相关推荐）
- 询价系统（表单提交 + 后台管理）
- FAQ 页面 + 关于我们页面
- 展示设置（账号公开、域名管理、分类管理、询盘管理）

### 安全
- bcrypt 密码哈希
- AES-256-GCM 敏感数据加密
- scrypt 密钥派生（password_hash + device_salt）
- API 速率限制（令牌桶算法，per-IP + 全局）
- WHOIS 查询 5 分钟缓存

### 多语言
- 中文/英文双语支持
- 29 个 Vue 文件完成 i18n 改造
- 682 行 × 2 翻译文件

### 部署
- Nuxt 3 SSR + PM2 进程管理
- Nginx 反向代理 + Let's Encrypt SSL
- SQLite WAL 模式

### 技术栈
- Nuxt 3, Vue 3, Tailwind CSS, Pinia, ECharts
- SQLite (better-sqlite3), bcryptjs, Node.js 20
- 20 页面, 49 API 端点, 10 组件, 11 数据表
