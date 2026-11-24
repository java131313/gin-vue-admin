// 认证与用户 / 角色 / 菜单管理 —— 对应 Go 版 api/auth.go、api/user.go、api/role.go、api/menu.go
import { Hono } from 'hono'
import bcrypt from 'bcryptjs'
import { AppCtx, Env, ok, fail, pager, buildTree, userMenus, signToken } from '../core'

// 公开接口：只有登录
export const loginRoute = new Hono<{ Bindings: Env; Variables: { userID: number } }>()

// POST /auth/login —— 校验账号密码，签发 JWT
loginRoute.post('/auth/login', async (c: AppCtx) => {
  const { username, password } = await c.req.json().catch(() => ({}))
  if (!username || !password) return fail(c, 1, '用户名和密码不能为空')

  const user = await c.env.DB.prepare('SELECT * FROM users WHERE username = ?').bind(username).first<any>()
  if (!user || !bcrypt.compareSync(String(password), user.password)) {
    return fail(c, 1, '用户名或密码错误')
  }
  if (user.status !== 1) return fail(c, 1, '账号已被禁用，请联系管理员')

  const token = await signToken(user.id, user.username, c.env.JWT_SECRET)
  return ok(c, { token })
})

// 需登录的接口：当前用户 + 用户/角色/菜单管理
export const authRoutes = new Hono<{ Bindings: Env; Variables: { userID: number } }>()

// GET /auth/info —— 当前用户信息 + 角色 + 权限 + 菜单树
authRoutes.get('/auth/info', async (c: AppCtx) => {
  const userID = c.get('userID')
  const user = await c.env.DB.prepare('SELECT id, username, nickname, avatar, status, created_at AS createdAt FROM users WHERE id = ?').bind(userID).first()
  if (!user) return fail(c, 1, '用户信息查询失败')

  const roles = (await c.env.DB.prepare(
    `SELECT r.* FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = ?`
  ).bind(userID).all<any>()).results || []

  const menus = await userMenus(c.env.DB, userID)
  const permSet = new Set<string>()
  const walk = (list: any[]) => list.forEach((m) => { if (m.perm) permSet.add(m.perm); walk(m.children || []) })
  walk(menus)

  return ok(c, {
    user,
    roles: roles.map((r) => r.code),
    perms: [...permSet],
    menus: buildTree(menus),
  })
})

// POST /auth/logout —— JWT 无状态，服务端占位（与 Go 版一致）
authRoutes.post('/auth/logout', (c: AppCtx) => ok(c, null))

// ---------- 用户管理（需要 user:* 权限） ----------

// GET /users —— 分页列表
authRoutes.get('/users', async (c: AppCtx) => {
  const { pageSize, offset } = pager(c)
  const kw = c.req.query('keyword') || ''
  let where = '1=1'
  const binds: any[] = []
  if (kw) { where += ' AND (username LIKE ? OR nickname LIKE ?)'; binds.push(`%${kw}%`, `%${kw}%`) }

  const total = (await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM users WHERE ${where}`).bind(...binds).first<any>())!.n as number

  const rows = (await c.env.DB.prepare(
    `SELECT id, username, nickname, avatar, status, created_at AS createdAt FROM users WHERE ${where} ORDER BY id LIMIT ? OFFSET ?`
  ).bind(...binds, pageSize, offset).all<any>()).results || []

  // 补上每个用户的角色
  for (const u of rows) {
    u.roles = (await c.env.DB.prepare(
      `SELECT r.* FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = ?`
    ).bind(u.id).all<any>()).results || []
  }
  return ok(c, { list: rows, total })
})

// POST /users —— 新增用户（bcrypt 加密密码）
authRoutes.post('/users', async (c: AppCtx) => {
  const { username, password, nickname, status, role_ids } = await c.req.json().catch(() => ({} as any))
  if (!username || username.length < 3 || !password || password.length < 6) {
    return fail(c, 1, '参数错误：用户名3~32位，密码至少6位')
  }
  const exists = await c.env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(username).first()
  if (exists) return fail(c, 1, '用户名已存在')

  const hash = bcrypt.hashSync(String(password), 10)
  const r = await c.env.DB.prepare('INSERT INTO users (username, password, nickname, status) VALUES (?, ?, ?, ?)')
    .bind(username, hash, nickname || '', status ?? 1).run()

  const uid = r.meta.last_row_id as number
  for (const rid of role_ids || []) {
    await c.env.DB.prepare('INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)').bind(uid, rid).run()
  }
  return ok(c, { id: uid })
})

// PUT /users/:id —— 编辑用户（密码留空不修改）
authRoutes.put('/users/:id', async (c: AppCtx) => {
  const id = Number(c.req.param('id'))
  const { nickname, password, status, role_ids } = await c.req.json().catch(() => ({} as any))
  const user = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(id).first()
  if (!user) return fail(c, 1, '用户不存在')

  if (password) {
    await c.env.DB.prepare('UPDATE users SET nickname = ?, status = ?, password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .bind(nickname || '', status ?? 1, bcrypt.hashSync(String(password), 10), id).run()
  } else {
    await c.env.DB.prepare('UPDATE users SET nickname = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .bind(nickname || '', status ?? 1, id).run()
  }
  // 重新分配角色
  await c.env.DB.prepare('DELETE FROM user_roles WHERE user_id = ?').bind(id).run()
  for (const rid of role_ids || []) {
    await c.env.DB.prepare('INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)').bind(id, rid).run()
  }
  return ok(c, null)
})

// DELETE /users/:id —— 删除用户（保护自己和内置管理员）
authRoutes.delete('/users/:id', async (c: AppCtx) => {
  const id = Number(c.req.param('id'))
  if (id === c.get('userID')) return fail(c, 1, '不能删除当前登录的账号')
  const target = await c.env.DB.prepare('SELECT username FROM users WHERE id = ?').bind(id).first<any>()
  if (!target) return fail(c, 1, '用户不存在')
  if (target.username === 'admin') return fail(c, 1, '内置管理员账号不可删除')

  await c.env.DB.prepare('DELETE FROM user_roles WHERE user_id = ?').bind(id).run()
  await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run()
  return ok(c, null)
})

// ---------- 角色管理 ----------

// GET /roles —— 全部角色（含菜单，用户表单下拉用；登录即可）
authRoutes.get('/roles', async (c: AppCtx) => {
  const roles = (await c.env.DB.prepare('SELECT * FROM roles ORDER BY id').all<any>()).results || []
  for (const r of roles) {
    r.menus = (await c.env.DB.prepare(
      `SELECT m.* FROM role_menus rm JOIN menus m ON m.id = rm.menu_id WHERE rm.role_id = ?`
    ).bind(r.id).all<any>()).results || []
  }
  return ok(c, roles)
})

// POST /roles —— 新增角色（分配菜单）
authRoutes.post('/roles', async (c: AppCtx) => {
  const { name, code, description, menu_ids } = await c.req.json().catch(() => ({} as any))
  if (!name || !code) return fail(c, 1, '角色名称和编码不能为空')
  const exists = await c.env.DB.prepare('SELECT id FROM roles WHERE code = ?').bind(code).first()
  if (exists) return fail(c, 1, '角色编码已存在')

  const r = await c.env.DB.prepare('INSERT INTO roles (name, code, description) VALUES (?, ?, ?)')
    .bind(name, code, description || '').run()
  const rid = r.meta.last_row_id as number
  for (const mid of menu_ids || []) {
    await c.env.DB.prepare('INSERT OR IGNORE INTO role_menus (role_id, menu_id) VALUES (?, ?)').bind(rid, mid).run()
  }
  return ok(c, { id: rid })
})

// PUT /roles/:id —— 编辑角色
authRoutes.put('/roles/:id', async (c: AppCtx) => {
  const id = Number(c.req.param('id'))
  const { name, code, description, menu_ids } = await c.req.json().catch(() => ({} as any))
  const role = await c.env.DB.prepare('SELECT * FROM roles WHERE id = ?').bind(id).first<any>()
  if (!role) return fail(c, 1, '角色不存在')
  if (role.code === 'admin' && code !== 'admin') return fail(c, 1, '内置管理员角色的编码不可修改')

  await c.env.DB.prepare('UPDATE roles SET name = ?, code = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .bind(name, code, description || '', id).run()
  await c.env.DB.prepare('DELETE FROM role_menus WHERE role_id = ?').bind(id).run()
  for (const mid of menu_ids || []) {
    await c.env.DB.prepare('INSERT OR IGNORE INTO role_menus (role_id, menu_id) VALUES (?, ?)').bind(id, mid).run()
  }
  return ok(c, null)
})

// DELETE /roles/:id —— 删除角色（保护 admin、检查是否已分配用户）
authRoutes.delete('/roles/:id', async (c: AppCtx) => {
  const id = Number(c.req.param('id'))
  const role = await c.env.DB.prepare('SELECT code FROM roles WHERE id = ?').bind(id).first<any>()
  if (!role) return fail(c, 1, '角色不存在')
  if (role.code === 'admin') return fail(c, 1, '内置管理员角色不可删除')

  const used = (await c.env.DB.prepare('SELECT COUNT(*) AS n FROM user_roles WHERE role_id = ?').bind(id).first<any>())!.n as number
  if (used > 0) return fail(c, 1, '该角色已分配给用户，请先移除相关用户后再删除')

  await c.env.DB.prepare('DELETE FROM role_menus WHERE role_id = ?').bind(id).run()
  await c.env.DB.prepare('DELETE FROM roles WHERE id = ?').bind(id).run()
  return ok(c, null)
})

// ---------- 菜单管理 ----------

// GET /menus —— 菜单树（管理页树形表格用）
authRoutes.get('/menus', async (c: AppCtx) => {
  const rows = (await c.env.DB.prepare('SELECT * FROM menus ORDER BY sort, id').all<any>()).results || []
  return ok(c, buildTree(rows))
})

// POST /menus —— 新增菜单
authRoutes.post('/menus', async (c: AppCtx) => {
  const b = await c.req.json().catch(() => ({} as any))
  if (!b.title) return fail(c, 1, '菜单名称不能为空')
  const r = await c.env.DB.prepare(
    'INSERT INTO menus (parent_id, title, name, path, component, icon, type, perm, sort) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(b.parentId || 0, b.title, b.name || '', b.path || '', b.component || '', b.icon || '', b.type ?? 0, b.perm || '', b.sort ?? 0).run()
  return ok(c, { id: r.meta.last_row_id })
})

// PUT /menus/:id —— 编辑菜单
authRoutes.put('/menus/:id', async (c: AppCtx) => {
  const id = Number(c.req.param('id'))
  const b = await c.req.json().catch(() => ({} as any))
  const menu = await c.env.DB.prepare('SELECT id FROM menus WHERE id = ?').bind(id).first()
  if (!menu) return fail(c, 1, '菜单不存在')
  if (b.parentId === id) return fail(c, 1, '父菜单不能是自己')

  await c.env.DB.prepare(
    'UPDATE menus SET parent_id = ?, title = ?, name = ?, path = ?, component = ?, icon = ?, type = ?, perm = ?, sort = ? WHERE id = ?'
  ).bind(b.parentId || 0, b.title, b.name || '', b.path || '', b.component || '', b.icon || '', b.type ?? 0, b.perm || '', b.sort ?? 0, id).run()
  return ok(c, null)
})

// DELETE /menus/:id —— 删除菜单（有子节点不允许）
authRoutes.delete('/menus/:id', async (c: AppCtx) => {
  const id = Number(c.req.param('id'))
  const menu = await c.env.DB.prepare('SELECT id FROM menus WHERE id = ?').bind(id).first()
  if (!menu) return fail(c, 1, '菜单不存在')

  const children = (await c.env.DB.prepare('SELECT COUNT(*) AS n FROM menus WHERE parent_id = ?').bind(id).first<any>())!.n as number
  if (children > 0) return fail(c, 1, '该菜单下有子节点，请先删除子节点')

  await c.env.DB.prepare('DELETE FROM role_menus WHERE menu_id = ?').bind(id).run()
  await c.env.DB.prepare('DELETE FROM menus WHERE id = ?').bind(id).run()
  return ok(c, null)
})
