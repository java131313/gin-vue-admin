-- 同步「Agent知识」「学PostgreSQL」到线上 D1（幂等：INSERT OR IGNORE）
-- 来源：simple-admin/server/core/seed_custom.go
INSERT OR IGNORE INTO custom_modules (id, name, icon, description, sort, created_at) VALUES (12, 'Agent知识', '🤖', '通用模板示例：AI 智能体的核心概念与工程实践', 12, '2026-11-26T08:14:08.820329+00:00');
INSERT OR IGNORE INTO custom_items (id, module_id, title, content, tag, sort, created_at) VALUES (151, 12, 'Agent 是什么', 'AI Agent（智能体）= 大模型 + 规划 + 工具 + 记忆的循环系统：模型不再一问一答，而是自主拆解目标、调用工具、观察结果、迭代推进，直到完成任务。

与普通聊天的本质区别：聊天是「一次性问答」，Agent 是「带反馈回路的持续行动」——Claude Code、Devin 都是典型代表。', '基础', 1, '2026-11-26T08:14:08.820329+00:00');
INSERT OR IGNORE INTO custom_items (id, module_id, title, content, tag, sort, created_at) VALUES (152, 12, '核心循环：ReAct', 'ReAct（Reasoning + Acting）是 Agent 的基础范式：Thought（思考下一步）→ Action（调用工具）→ Observation（观察结果）→ 再思考，循环直到达成目标。

关键洞察：把「推理轨迹」显式写出来，模型的行动质量会显著提升——想清楚了再动手，错了能从观察中纠正。', '核心', 2, '2026-11-26T08:14:08.820329+00:00');
INSERT OR IGNORE INTO custom_items (id, module_id, title, content, tag, sort, created_at) VALUES (153, 12, '工具调用 Function Calling', '模型通过结构化输出（JSON）声明「我要调用某个函数、参数是什么」，由运行时真正执行并把结果喂回模型。

工具是 Agent 的手和眼：搜索、数据库、API、文件系统、浏览器……工具描述（名称/参数/用途）的写法直接决定模型会不会用、用得对不对。', '核心', 3, '2026-11-26T08:14:08.820329+00:00');
INSERT OR IGNORE INTO custom_items (id, module_id, title, content, tag, sort, created_at) VALUES (154, 12, '规划与任务拆解', '复杂任务先拆后做：把大目标分解为有序子任务（Plan），逐个执行并按需重规划（Replan）。

常见模式：Plan-and-Execute（先整体规划再执行）、TODO 列表驱动（Claude Code 的 TaskCreate）、反射式重规划（失败后分析原因调整计划）。', '核心', 4, '2026-11-26T08:14:08.820329+00:00');
INSERT OR IGNORE INTO custom_items (id, module_id, title, content, tag, sort, created_at) VALUES (155, 12, '记忆系统 Memory', '短期记忆 = 上下文窗口内的对话与中间结果；长期记忆 = 持久化存储（文件/数据库/向量库），跨会话召回。

向量检索（Embedding + 相似度）是长期记忆的主流实现：把历史经验向量化，用时按相关性捞回——记忆不是全带在身上，而是需要时能想起来。', '核心', 5, '2026-11-26T08:14:08.820329+00:00');
INSERT OR IGNORE INTO custom_items (id, module_id, title, content, tag, sort, created_at) VALUES (156, 12, 'Prompt 工程基础', '系统提示词是 Agent 的「人格与纪律」：角色定位、能力边界、输出格式、工具使用规约、安全红线。

经验法则：给具体指令而非抽象期望（「超过 3 步的任务先列 TODO」优于「要有计划性」）；给例子胜过给规则；重要约束放在提示词首尾。', '基础', 6, '2026-11-26T08:14:08.820329+00:00');
INSERT OR IGNORE INTO custom_items (id, module_id, title, content, tag, sort, created_at) VALUES (157, 12, 'RAG 检索增强', 'RAG（检索增强生成）：提问先检索相关知识片段，连同问题一起给模型——让模型基于「你给的资料」而非「它记忆里的世界」回答。

价值：知识可更新（不用重训模型）、答案可溯源、私有数据可用。调优三板斧：切分粒度、召回数量、重排序（rerank）。', '核心', 7, '2026-11-26T08:14:08.820329+00:00');
INSERT OR IGNORE INTO custom_items (id, module_id, title, content, tag, sort, created_at) VALUES (158, 12, '多 Agent 协作', '单个 Agent 能力有边界，复杂任务可以分工：规划者拆任务、执行者干活、审查者把关——像一个小型团队。

主流拓扑：主管-工人（Orchestrator-Workers）、流水线（A 的输出是 B 的输入）、辩论/评审（多视角互查）。代价是成本与延迟翻倍，简单任务别滥用。', '进阶', 8, '2026-11-26T08:14:08.820329+00:00');
INSERT OR IGNORE INTO custom_items (id, module_id, title, content, tag, sort, created_at) VALUES (159, 12, 'MCP 协议', 'MCP（Model Context Protocol）是工具接入的标准协议：工具方实现 MCP Server（暴露资源/工具/提示），Agent 作为 Client 统一接入——一次实现，处处可用。

类比：MCP 之于 Agent 工具，如同 USB-C 之于外设。本系统的开发环境就挂着 MCP 工具（chrome-devtools、数据库等）。', '进阶', 9, '2026-11-26T08:14:08.820329+00:00');
INSERT OR IGNORE INTO custom_items (id, module_id, title, content, tag, sort, created_at) VALUES (160, 12, '上下文工程', 'Context Engineering：窗口是稀缺资源，塞什么、怎么塞、何时压缩，直接决定 Agent 表现。

手段：工具结果裁剪（只留关键片段）、历史摘要压缩、相关记忆按需召回、子任务隔离上下文（子 Agent 只带必要信息）——垃圾进垃圾出，上下文质量就是输出质量。', '进阶', 10, '2026-11-26T08:14:08.820329+00:00');
INSERT OR IGNORE INTO custom_items (id, module_id, title, content, tag, sort, created_at) VALUES (161, 12, '评估与观测', 'Agent 的行为是概率性的，必须可观测：完整记录推理轨迹（每次思考/工具调用/结果），才能定位「哪一步想歪了」。

评估维度：任务成功率、步数效率、工具调用正确率、成本。方法：黄金集回归测试 +  LLM-as-Judge（用强模型给轨迹打分）。', '进阶', 11, '2026-11-26T08:14:08.820329+00:00');
INSERT OR IGNORE INTO custom_items (id, module_id, title, content, tag, sort, created_at) VALUES (162, 12, '常见框架', 'LangChain/LangGraph（生态最全，Graph 编排状态机）、AutoGen（多 Agent 对话）、CrewAI（角色分工）、OpenAI Agents SDK（轻量）。

选型建议：学习期先用裸 API + 手写循环理解本质，再上框架——框架封装的是模式，理解了 ReAct 和工具循环，看哪个框架都是熟人。', '工程', 12, '2026-11-26T08:14:08.820329+00:00');
INSERT OR IGNORE INTO custom_items (id, module_id, title, content, tag, sort, created_at) VALUES (163, 12, 'Agent 安全与护栏', 'Agent 能动手就有风险：误删文件、错误调用、被提示词注入带偏。

护栏四层：权限最小化（只给必需的工具和范围）、危险操作人工确认（destructive 操作二次确认）、输入输出过滤（防注入/防泄露）、沙箱隔离（代码在容器里跑）。', '进阶', 13, '2026-11-26T08:14:08.820329+00:00');
INSERT OR IGNORE INTO custom_items (id, module_id, title, content, tag, sort, created_at) VALUES (164, 12, '动手路径', '推荐进阶路线：1) 裸调 API 写一个 30 行的 ReAct 循环（理解本质）；2) 加 3 个工具（搜索/计算器/文件）；3) 加 TODO 规划；4) 加记忆与反思；5) 拆成多 Agent。

每一步都会踩到真实的坑（上下文爆炸、工具误用、死循环）——这些坑就是 Agent 工程的真知识，比看十篇文章都管用。', '工程', 14, '2026-11-26T08:14:08.820329+00:00');
INSERT OR IGNORE INTO custom_modules (id, name, icon, description, sort, created_at) VALUES (13, '学PostgreSQL', '🐘', '通用模板示例：最强开源关系数据库的核心知识', 13, '2026-11-26T08:14:08.820329+00:00');
INSERT OR IGNORE INTO custom_items (id, module_id, title, content, tag, sort, created_at) VALUES (165, 13, 'PostgreSQL 是什么', 'PostgreSQL（PG）是最强的开源关系数据库：35 年历史的学院派血统，以功能全面、标准兼容、扩展性强著称——Stack Overflow 调查多年「最受喜爱数据库」。

与 MySQL 的气质差异：PG 更严谨（标准 SQL、严格类型）、功能更深（JSONB/数组/全文检索/窗口函数），本系统（Go 版）的数据库就是它。', '基础', 1, '2026-11-26T08:14:08.820329+00:00');
INSERT OR IGNORE INTO custom_items (id, module_id, title, content, tag, sort, created_at) VALUES (166, 13, '安装与连接', '连接串格式：postgresql://user:password@host:5432/dbname；命令行客户端 psql 是瑞士军刀（\l 列库 \dt 列表 \d 表结构）。

本项目的 docker-compose 里 db 服务就是 postgres:16-alpine——容器网络内用服务名 db 作主机名直连，这也是本地开发的推荐姿势。', '基础', 2, '2026-11-26T08:14:08.820329+00:00');
INSERT OR IGNORE INTO custom_items (id, module_id, title, content, tag, sort, created_at) VALUES (167, 13, '数据类型', 'PG 的类型系统远超 MySQL：数值/文本/时间之外，还有 jsonb（二进制 JSON）、数组（text[]）、范围（int4range）、网络地址（inet）、几何类型、UUID、枚举。

选型建议：主键用 bigint 或 uuid；金额用 numeric（别用 float）；半结构化数据大胆用 jsonb（配 GIN 索引查询飞快）。', '基础', 3, '2026-11-26T08:14:08.820329+00:00');
INSERT OR IGNORE INTO custom_items (id, module_id, title, content, tag, sort, created_at) VALUES (168, 13, '基本 SQL：CRUD', '增 INSERT INTO ... RETURNING *（直接拿回插入行，含自增 ID——比 MySQL 的 last_insert_id 优雅）；查 SELECT；改 UPDATE；删 DELETE。

PG 特色：INSERT ... ON CONFLICT (key) DO UPDATE（upsert，本项目的复习进度表就用它）、DISTINCT ON（分组取首行）、RETURNING 全系列支持。', '基础', 4, '2026-11-26T08:14:08.820329+00:00');
INSERT OR IGNORE INTO custom_items (id, module_id, title, content, tag, sort, created_at) VALUES (169, 13, '索引', '默认 B-tree 覆盖 90% 场景（等值/范围/排序）；GIN 专配 jsonb/数组/全文检索（倒排索引）；GiST 用于几何/范围；BRIN 适合超大有序表。

复合索引遵循最左前缀；部分索引（WHERE 条件过滤）和表达式索引（对 lower(email) 建索引）是 PG 的精细武器——索引不是越多越好，写放大要算帐。', '核心', 5, '2026-11-26T08:14:08.820329+00:00');
INSERT OR IGNORE INTO custom_items (id, module_id, title, content, tag, sort, created_at) VALUES (170, 13, '事务与 ACID', 'BEGIN/COMMIT/ROLLBACK 标准事务，隔离级别四档：读未提交/读已提交（默认）/可重复读/串行化。

PG 默认「读已提交」且实现极其扎实：可重复读用快照实现（不是锁），串行化是SSI（可串行化快照隔离）——高性能与强一致的兼得，这是 PG 的硬核功底。', '核心', 6, '2026-11-26T08:14:08.820329+00:00');
INSERT OR IGNORE INTO custom_items (id, module_id, title, content, tag, sort, created_at) VALUES (171, 13, 'MVCC 多版本并发', 'MVCC 是 PG 并发的灵魂：每行数据保留多个版本，读不加锁（读旧快照）、写不阻塞读、读写互不干扰——高并发下吞吐量的根基。

代价是死元组（旧版本行）堆积，靠 VACUUM 定期清理（autovacuum 自动跑）；长事务会阻碍清理，是生产事故的常见根因。', '核心', 7, '2026-11-26T08:14:08.820329+00:00');
INSERT OR IGNORE INTO custom_items (id, module_id, title, content, tag, sort, created_at) VALUES (172, 13, '视图与物化视图', '视图（VIEW）是保存的查询（不存数据，简化复杂 SQL 复用）；物化视图（MATERIALIZED VIEW）把结果真正存下来（查询飞快，但需手动 REFRESH 刷新）。

典型用法：报表/仪表盘用物化视图（定时刷新换查询性能），业务逻辑复用用普通视图——本项目「学XX」模块的统计查询就很适合物化视图。', '核心', 8, '2026-11-26T08:14:08.820329+00:00');
INSERT OR IGNORE INTO custom_items (id, module_id, title, content, tag, sort, created_at) VALUES (173, 13, '窗口函数', 'OVER (PARTITION BY ... ORDER BY ...)：在不分组的前提下做组内计算——row_number 排名、lag/lead 取前后行、sum over 累计求和、ntile 分桶。

经典场景：每个分类下取 Top N（row_number + 子查询过滤 rn<=N）、同比环比（lag 取上期值）——写一次窗口函数，就再也不想用自连接了。', '进阶', 9, '2026-11-26T08:14:08.820329+00:00');
INSERT OR IGNORE INTO custom_items (id, module_id, title, content, tag, sort, created_at) VALUES (174, 13, 'JSONB 与文档查询', 'jsonb 让 PG 一半身子进了 NoSQL：-> 取 JSON 字段、->> 取文本、@> 包含查询（WHERE data @> ''{"tag":"核心"}''）、jsonb_array_elements 展开数组。

配 GIN 索引后包含查询毫秒级——「关系为主、文档为辅」的混合建模是 PG 的杀手锏，很多场景可以省掉一个 MongoDB。', '进阶', 10, '2026-11-26T08:14:08.820329+00:00');
INSERT OR IGNORE INTO custom_items (id, module_id, title, content, tag, sort, created_at) VALUES (175, 13, '锁与并发控制', '表锁（ACCESS SHARE 到 ACCESS EXCLUSIVE 八级）+ 行锁（SELECT ... FOR UPDATE 显式加锁）；死锁会被自动检测并牺牲一方（ERROR: deadlock detected）。

经验：更新按固定顺序访问多表防死锁；长事务是锁等待的头号来源；SELECT FOR UPDATE 配合 NOWAIT/SKIP LOCKED 实现队列语义（PG 当任务队列用的秘诀）。', '进阶', 11, '2026-11-26T08:14:08.820329+00:00');
INSERT OR IGNORE INTO custom_items (id, module_id, title, content, tag, sort, created_at) VALUES (176, 13, '性能分析 EXPLAIN', 'EXPLAIN 看执行计划（预估成本），EXPLAIN ANALYZE 真跑一遍看实际耗时与行数——优化 SQL 的第一步永远是看它。

关注点：Seq Scan（全表扫描，大表要警惕）vs Index Scan；rows 预估与实际差 10 倍以上说明统计信息过时（跑 ANALYZE 更新）；Buffers 看内存命中。', '工程', 12, '2026-11-26T08:14:08.820329+00:00');
INSERT OR IGNORE INTO custom_items (id, module_id, title, content, tag, sort, created_at) VALUES (177, 13, '备份与恢复', '逻辑备份 pg_dump（单库导出 SQL/自定义格式，pg_restore 恢复）；物理备份 + WAL 归档实现 PITR（时间点恢复，能回到任意一秒）。

本项目本地 PG 在 docker 卷里：docker exec simple-admin-db pg_dump -U postgres simple_admin > backup.sql 就是最小备份方案——数据无价，备份要演练过才算数。', '工程', 13, '2026-11-26T08:14:08.820329+00:00');
INSERT OR IGNORE INTO custom_items (id, module_id, title, content, tag, sort, created_at) VALUES (178, 13, 'PG 生态与扩展', '扩展是 PG 的超能力：PostGIS（地理信息，事实标准）、pgvector（向量检索，AI 时代新宠）、pg_trgm（模糊搜索）、TimescaleDB（时序）、 logical replication（逻辑复制做读写分离/数据同步）。

趋势观察：AI 应用偏爱 PG——业务数据 + 向量（pgvector）+ 全文检索一个库全包，「一个 PG 顶三个系统」是当下最实在的技术选型。', '工程', 14, '2026-11-26T08:14:08.820329+00:00');
