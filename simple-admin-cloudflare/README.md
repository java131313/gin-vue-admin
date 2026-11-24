# simple-admin-cloudflare —— Cloudflare Workers 全功能移植版

simple-admin（Go + Vue 学习平台）的 **Cloudflare 原生移植版**：
**TypeScript + Hono + D1（SQLite）**，前端 Vue 静态资源由同一个 Worker 同源托管。

线上地址：**https://simple-admin.java13131305626.workers.dev**
（演示账号 admin / admin123，visitor / 123456）

## 架构对照

| 组件 | Go 版 | Cloudflare 版 |
| --- | --- | --- |
| HTTP 框架 | Gin | Hono |
| 数据库 | PostgreSQL + GORM | **D1（SQLite）**，直接写 SQL |
| 自动建表 | GORM AutoMigrate | 启动时 `CREATE TABLE IF NOT EXISTS` |
| 种子数据 | Go 代码逐条 upsert | **从 PG 经 JSON 中转导出的 591 条 SQL**，首启自动导入 |
| JWT | golang-jwt | jose |
| 密码哈希 | x/crypto/bcrypt | bcryptjs |
| 前端部署 | Nginx 容器 | **Workers Static Assets**（SPA 回退） |
| 服务器 | Docker 容器 | Cloudflare 全球边缘节点 |

功能与 Go 版完全一致：RBAC 权限、学语言（背单词/双语阅读）、数学（KaTeX 公式/函数作图）、
考试中心（自动判分/错题本）、学AI编程（Kimi 代理）、学Golang（在线运行）、
五门课程（Node/Vue/React/Java/Python）、自定义学习模板。

## 目录结构

```
├── wrangler.toml        # Worker 配置（D1 绑定 + 静态资源 + 环境变量）
├── src/
│   ├── index.ts         # 入口：启动建表/种子、中间件挂载、全部路由
│   ├── core.ts          # 统一响应 / JWT / 登录与权限中间件 / 工具函数
│   ├── schema.ts        # 全部建表语句（D1 = SQLite 方言）
│   ├── seed.ts          # 591 条种子 SQL（自动生成，勿手改）
│   └── routes/          # auth / learn / content / exam / custom
├── web/                 # 前端 Vue 工程（与 Go 版共用代码，npm run build 产物由 Worker 托管）
└── seed.sql             # 种子数据的可读副本
```

## 本地开发

```bash
npm install
cd web && npm install && npm run build && cd ..
npx wrangler dev        # http://localhost:8787（本地 D1 自动建表+种子）
```

## 部署

```bash
# 首次：创建 D1 数据库并把 database_id 填进 wrangler.toml
npx wrangler d1 create simple-admin

# 部署（代码 + 前端静态资源）
npx wrangler deploy

# 可选：配置 Kimi AI 助手
npx wrangler secret put KIMI_API_KEY

# 可选：生产环境覆盖 JWT 密钥
npx wrangler secret put JWT_SECRET
```

首次访问线上地址时，首个请求会自动建表并导入 591 条种子数据（约几秒，仅一次）。

## 重新生成种子数据

如果 Go 版的数据有更新，可以从本地 PostgreSQL 重新导出（需要本地 docker 在跑）：

```bash
python3 - <<'EOF'
import json, subprocess
TABLES = ['users','roles','menus','words','articles','formulas','ai_contents','go_contents','course_contents','custom_modules','custom_items']
JOINS = ['user_roles','role_menus']
def esc(v):
    if v is None: return 'NULL'
    if isinstance(v, bool): return '1' if v else '0'
    if isinstance(v, (int, float)): return str(v)
    return "'" + str(v).replace("'", "''") + "'"
stmts = []
for t in TABLES + JOINS:
    sql = f'SELECT json_agg(row_to_json(x)) FROM (SELECT * FROM {t} ORDER BY id) x' if t not in JOINS else f'SELECT json_agg(row_to_json({t})) FROM {t}'
    out = subprocess.run(['docker','exec','simple-admin-db','psql','-U','postgres','-d','simple_admin','-A','-t','-c',sql], capture_output=True, text=True).stdout.strip()
    for row in (json.loads(out) if out else []):
        stmts.append(f"INSERT OR IGNORE INTO {t} ({', '.join(row)}) VALUES ({', '.join(esc(v) for v in row.values())});")
open('src/seed.ts','w').write('export const SEED_SQL: string[] = ' + json.dumps(stmts, ensure_ascii=False) + ';\n')
EOF
npx wrangler deploy   # 然后删除线上 D1 数据或换库重新导入
```
