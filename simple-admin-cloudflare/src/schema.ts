// D1 数据库表结构（SQLite 方言）
//
// 与 Go 版本（PostgreSQL + GORM AutoMigrate）完全对应：
// 三张核心 RBAC 表 + 学习类内容表 + 进度/考试/错题表。
// 所有建表语句都是 IF NOT EXISTS，每次冷启动执行一遍无副作用。

export const SCHEMA_SQL: string[] = [
  // ---------- RBAC 权限体系 ----------
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    nickname TEXT DEFAULT '',
    avatar TEXT DEFAULT '',
    status INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    description TEXT DEFAULT '',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS menus (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_id INTEGER DEFAULT 0,
    title TEXT NOT NULL,
    name TEXT DEFAULT '',
    path TEXT DEFAULT '',
    component TEXT DEFAULT '',
    icon TEXT DEFAULT '',
    type INTEGER DEFAULT 0,
    perm TEXT DEFAULT '',
    sort INTEGER DEFAULT 0
  )`,
  // 多对多关联表（GORM 自动建的两张表，这里显式声明）
  `CREATE TABLE IF NOT EXISTS user_roles (
    user_id INTEGER NOT NULL,
    role_id INTEGER NOT NULL,
    PRIMARY KEY (user_id, role_id)
  )`,
  `CREATE TABLE IF NOT EXISTS role_menus (
    role_id INTEGER NOT NULL,
    menu_id INTEGER NOT NULL,
    PRIMARY KEY (role_id, menu_id)
  )`,

  // ---------- 学语言：单词卡片 + 记忆进度 ----------
  `CREATE TABLE IF NOT EXISTS words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    language TEXT NOT NULL DEFAULT 'en',
    word TEXT NOT NULL UNIQUE,
    phonetic TEXT DEFAULT '',
    meaning TEXT NOT NULL,
    example TEXT DEFAULT '',
    example_cn TEXT DEFAULT '',
    tag TEXT DEFAULT '',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS word_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    word_id INTEGER NOT NULL,
    mastered INTEGER DEFAULT 0,
    correct_cnt INTEGER DEFAULT 0,
    wrong_cnt INTEGER DEFAULT 0,
    last_review_at TEXT,
    UNIQUE (user_id, word_id)
  )`,

  // ---------- 学语言：阅读文章 ----------
  `CREATE TABLE IF NOT EXISTS articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    language TEXT NOT NULL DEFAULT 'en',
    title TEXT NOT NULL,
    summary TEXT DEFAULT '',
    content TEXT NOT NULL,
    content_cn TEXT DEFAULT '',
    tag TEXT DEFAULT '',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,

  // ---------- 学数学：公式 ----------
  `CREATE TABLE IF NOT EXISTS formulas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL DEFAULT 'algebra',
    name TEXT NOT NULL,
    formula TEXT NOT NULL,
    content TEXT NOT NULL,
    application TEXT DEFAULT '',
    tag TEXT DEFAULT '',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,

  // ---------- 考试中心：题库 / 试卷 / 作答 / 错题本 ----------
  `CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject TEXT NOT NULL,
    q_type TEXT NOT NULL,
    content TEXT NOT NULL,
    options TEXT DEFAULT '',
    answer TEXT NOT NULL,
    analysis TEXT DEFAULT '',
    source_id INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS exams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT DEFAULT '',
    total INTEGER DEFAULT 0,
    score INTEGER DEFAULT -1,
    status TEXT DEFAULT 'doing',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS exam_answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exam_id INTEGER NOT NULL,
    question_id INTEGER NOT NULL,
    user_answer TEXT DEFAULT '',
    correct INTEGER DEFAULT 0,
    checked INTEGER DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS wrongbook (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    question_id INTEGER NOT NULL,
    wrong_count INTEGER DEFAULT 1,
    last_wrong_at TEXT,
    UNIQUE (user_id, question_id)
  )`,

  // ---------- 学AI编程 ----------
  `CREATE TABLE IF NOT EXISTS ai_contents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT DEFAULT '',
    content TEXT DEFAULT '',
    event_date TEXT DEFAULT '',
    tag TEXT DEFAULT '',
    sort INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,

  // ---------- 学Golang ----------
  `CREATE TABLE IF NOT EXISTS go_contents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT DEFAULT '',
    content TEXT DEFAULT '',
    code TEXT DEFAULT '',
    tag TEXT DEFAULT '',
    difficulty TEXT DEFAULT '',
    sort INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,

  // ---------- 学NodeJS/Vue/React/Java/Python（五模块共用）----------
  `CREATE TABLE IF NOT EXISTS course_contents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    module TEXT NOT NULL,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT DEFAULT '',
    content TEXT DEFAULT '',
    code TEXT DEFAULT '',
    tag TEXT DEFAULT '',
    difficulty TEXT DEFAULT '',
    sort INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,

  // ---------- 自定义学习（通用模板）----------
  `CREATE TABLE IF NOT EXISTS custom_modules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    icon TEXT DEFAULT '',
    description TEXT DEFAULT '',
    sort INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS custom_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    module_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    tag TEXT DEFAULT '',
    sort INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS custom_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    item_id INTEGER NOT NULL,
    mastered INTEGER DEFAULT 0,
    correct_cnt INTEGER DEFAULT 0,
    wrong_cnt INTEGER DEFAULT 0,
    last_review_at TEXT,
    UNIQUE (user_id, item_id)
  )`,

  // 常用查询索引
  `CREATE INDEX IF NOT EXISTS idx_words_lang ON words (language)`,
  `CREATE INDEX IF NOT EXISTS idx_articles_lang ON articles (language)`,
  `CREATE INDEX IF NOT EXISTS idx_questions_subject ON questions (subject)`,
  `CREATE INDEX IF NOT EXISTS idx_exam_answers_exam ON exam_answers (exam_id)`,
  `CREATE INDEX IF NOT EXISTS idx_course_module ON course_contents (module, category)`,
  `CREATE INDEX IF NOT EXISTS idx_custom_items_module ON custom_items (module_id)`,
]
