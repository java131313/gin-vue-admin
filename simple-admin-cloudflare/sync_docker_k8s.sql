-- 同步「学Docker」「学K8s」到线上 D1（幂等：INSERT OR IGNORE）
-- 来源：simple-admin/server/core/seed_custom.go
INSERT OR IGNORE INTO custom_modules (id, name, icon, description, sort, created_at) VALUES (10, '学Docker', '🐳', '通用模板示例：容器化技术的必学基础', 10, '2026-11-24T05:26:12.092169+00:00');
INSERT OR IGNORE INTO custom_items (id, module_id, title, content, tag, sort, created_at) VALUES (123, 10, 'Docker 是什么', 'Docker 是容器化平台：把应用和依赖打包成标准单元（容器），在任何环境一致运行。

与虚拟机的区别：虚拟机虚拟整台机器（重、分钟级启动），容器共享宿主机内核（轻、秒级启动），底层靠 Linux namespace（隔离视图）+ cgroup（限制资源）实现。', '基础', 1, '2026-11-24T05:26:12.092169+00:00');
INSERT OR IGNORE INTO custom_items (id, module_id, title, content, tag, sort, created_at) VALUES (124, 10, '镜像与容器', '镜像（Image）是只读的打包模板，容器（Container）是镜像的运行实例——一个镜像可跑多个容器。

镜像是分层存储的：Dockerfile 每条指令产生一层，相同层全局复用缓存——这是构建快、拉取省流量的原因。', '核心', 2, '2026-11-24T05:26:12.092169+00:00');
INSERT OR IGNORE INTO custom_items (id, module_id, title, content, tag, sort, created_at) VALUES (125, 10, 'Dockerfile', '描述镜像构建步骤的文本文件：FROM 基础镜像、RUN 构建时执行、COPY 拷文件、CMD 启动命令。

本项目的 server/Dockerfile 就是真实案例：多阶段构建——先用 golang 镜像编译，再把二进制拷进 alpine 运行，最终镜像只有十几 MB。', '核心', 3, '2026-11-24T05:26:12.092169+00:00');
INSERT OR IGNORE INTO custom_items (id, module_id, title, content, tag, sort, created_at) VALUES (126, 10, '常用命令', 'docker run 启动（-d 后台 --name 起名）、ps 列表、logs -f 跟踪日志、exec -it 容器 bash 进容器调试、stop/start 停启、rm 删除容器、rmi 删镜像。

排障三件套：docker ps -a 看状态 → docker logs 看日志 → docker exec -it 容器 sh 进现场。', '基础', 4, '2026-11-24T05:26:12.092169+00:00');
INSERT OR IGNORE INTO custom_items (id, module_id, title, content, tag, sort, created_at) VALUES (127, 10, '端口映射与数据卷', '容器是隔离沙箱：-p 8080:80 把宿主 8080 转发到容器 80；-v 宿主机目录：容器目录 挂载数据，容器删了数据还在。

数据库容器必须配数据卷，否则容器一删数据全丢——新手最常见的事故。', '核心', 5, '2026-11-24T05:26:12.092169+00:00');
INSERT OR IGNORE INTO custom_items (id, module_id, title, content, tag, sort, created_at) VALUES (128, 10, '镜像仓库', 'Docker Hub 是公共仓库：docker pull nginx 拉镜像、docker tag 打标签、docker push 推上去。

国内网络慢可配镜像加速（registry-mirrors）；企业用 Harbor 搭私有仓库；本项目前端的镜像发布在 ghcr.io（GitHub 的仓库）。', '基础', 6, '2026-11-24T05:26:12.092169+00:00');
INSERT OR IGNORE INTO custom_items (id, module_id, title, content, tag, sort, created_at) VALUES (129, 10, '容器网络', '默认 bridge 网络：容器间用容器名互相访问（同一自定义网络内）。

docker compose 启动的所有容器自动在同一个网络里——这就是为什么本项目 web 容器能用 http://server:8888 直接访问后端。', '进阶', 7, '2026-11-24T05:26:12.092169+00:00');
INSERT OR IGNORE INTO custom_items (id, module_id, title, content, tag, sort, created_at) VALUES (130, 10, 'Docker Compose', '用一个 YAML 描述多容器应用：服务、端口、环境变量、依赖关系，docker compose up -d 一键起全套。

本项目的 docker-compose.yml 就是三件套：db（Postgres）+ server（Go）+ web（Nginx），还有健康检查控制启动顺序。', '核心', 8, '2026-11-24T05:26:12.092169+00:00');
INSERT OR IGNORE INTO custom_items (id, module_id, title, content, tag, sort, created_at) VALUES (131, 10, '数据卷类型', 'volume（Docker 管理，推荐）：docker volume create；bind mount（绑定宿主目录，开发常用）：-v ./data:/app/data。

volume 由 Docker 全权管理更干净；bind mount 改宿主文件容器里立即生效，适合开发调试。', '进阶', 9, '2026-11-24T05:26:12.092169+00:00');
INSERT OR IGNORE INTO custom_items (id, module_id, title, content, tag, sort, created_at) VALUES (132, 10, '多阶段构建', '构建过程也需要编译器、依赖，但运行不需要——多阶段构建把「编译环境」和「运行环境」分开：

FROM golang:1.26 AS builder（编译）→ FROM alpine（只拷贝二进制）。镜像从 800MB 瘦到 20MB，攻击面也小——现代镜像的标准做法。', '进阶', 10, '2026-11-24T05:26:12.092169+00:00');
INSERT OR IGNORE INTO custom_items (id, module_id, title, content, tag, sort, created_at) VALUES (133, 10, '日志与调试', 'docker logs -f 容器 跟踪输出；docker exec -it 容器 sh 进容器；docker inspect 容器 看完整配置（IP、挂载、环境变量）。

容器没有后台服务时立即退出：docker ps -a 看退出码，logs 看报错——80% 的「容器起不来」这样就定位了。', '核心', 11, '2026-11-24T05:26:12.092169+00:00');
INSERT OR IGNORE INTO custom_items (id, module_id, title, content, tag, sort, created_at) VALUES (134, 10, '构建缓存与 .dockerignore', 'Dockerfile 指令按层缓存：某层变了它之后的层全部重建——把不常变的（依赖安装）放前面，常变的（业务代码）放后面。

.dockerignore 排除 node_modules、.git 等：构建上下文小，上传快，也避免把密钥打进镜像。', '进阶', 12, '2026-11-24T05:26:12.092169+00:00');
INSERT OR IGNORE INTO custom_items (id, module_id, title, content, tag, sort, created_at) VALUES (135, 10, '为什么需要编排', 'Docker 解决单机打包，但生产环境要管成百上千台机器上的容器：挂了自动重启、流量大了自动扩容、滚动升级不停机——单机 Docker 做不到。

这就是 Kubernetes 的舞台：从「管一个容器」到「管一个集群」。', '进阶', 13, '2026-11-24T05:26:12.092169+00:00');
INSERT OR IGNORE INTO custom_items (id, module_id, title, content, tag, sort, created_at) VALUES (136, 10, '生产最佳实践', '1) 小镜像：alpine/distroless 基础镜像；2) 非 root 运行（USER 指令），被攻击时危害最小化；3) 一个容器干一件事，别当虚拟机用；4) 加 HEALTHCHECK 让平台知道你的服务活没活。

这四条做到，Docker 使用就超过了大部分初学者。', '工程', 14, '2026-11-24T05:26:12.092169+00:00');
INSERT OR IGNORE INTO custom_modules (id, name, icon, description, sort, created_at) VALUES (11, '学K8s', '☸️', '通用模板示例：容器编排平台的核心概念', 11, '2026-11-24T05:26:12.092169+00:00');
INSERT OR IGNORE INTO custom_items (id, module_id, title, content, tag, sort, created_at) VALUES (137, 11, 'Kubernetes 是什么', 'K8s 是谷歌开源的容器编排平台：自动化部署、扩缩容、服务发现、故障自愈。

核心思想是声明式：你提交「我要 3 个副本」的期望状态，K8s 持续把实际状态拉向期望状态——挂了自动补齐，这就是「编排」。', '基础', 1, '2026-11-24T05:26:12.092169+00:00');
INSERT OR IGNORE INTO custom_items (id, module_id, title, content, tag, sort, created_at) VALUES (138, 11, '集群架构', '控制平面（管理大脑）：API Server（唯一入口，所有组件经它对话）、etcd（持久化集群状态的键值库）、Scheduler（给 Pod 挑节点）、Controller Manager（维持期望状态的循环）。

工作节点（干活的）：kubelet（节点代理，管本机容器）、kube-proxy（网络规则，Service 的实现）。', '核心', 2, '2026-11-24T05:26:12.092169+00:00');
INSERT OR IGNORE INTO custom_items (id, module_id, title, content, tag, sort, created_at) VALUES (139, 11, 'Pod', 'K8s 最小调度单位，一个 Pod 可含多个紧密协作的容器，共享网络和存储卷。

最常见是单容器 Pod；多容器场景如：主应用 + 边车日志收集。Pod 是短暂的——IP 会变，所以有了 Service。', '核心', 3, '2026-11-24T05:26:12.092169+00:00');
INSERT OR IGNORE INTO custom_items (id, module_id, title, content, tag, sort, created_at) VALUES (140, 11, 'Deployment', '管理无状态应用：声明 replicas: 3，它就维持 3 个 Pod 运行；支持滚动更新（逐个替换旧 Pod）和回滚。

生产部署的标准选择：kubectl create deployment nginx --image=nginx --replicas=3。', '核心', 4, '2026-11-24T05:26:12.092169+00:00');
INSERT OR IGNORE INTO custom_items (id, module_id, title, content, tag, sort, created_at) VALUES (141, 11, 'Service', '为一组 Pod 提供稳定访问入口（固定虚拟 IP + DNS 名）， Pod 换了 IP 也不影响访问。

类型：ClusterIP（集群内）、NodePort（节点端口暴露）、LoadBalancer（云厂商负载均衡）。Service 靠 label selector 找到它的 Pod。', '核心', 5, '2026-11-24T05:26:12.092169+00:00');
INSERT OR IGNORE INTO custom_items (id, module_id, title, content, tag, sort, created_at) VALUES (142, 11, 'Ingress', '集群的 HTTP/HTTPS 入口：按域名/路径把流量路由到不同 Service——一个公网 IP 承载多个站点。

如 a.com/api → api-service，a.com/web → web-service。Nginx Ingress Controller 是最常用的实现。', '进阶', 6, '2026-11-24T05:26:12.092169+00:00');
INSERT OR IGNORE INTO custom_items (id, module_id, title, content, tag, sort, created_at) VALUES (143, 11, 'ConfigMap 与 Secret', '配置与镜像分离：ConfigMap 存普通配置（数据库地址、端口号），Secret 存敏感信息（密码、密钥，Base64 编码存储）。

改配置不用重新打镜像：改 ConfigMap 后重启 Pod 生效。本项目的 KIMI_API_KEY、JWT_SECRET 就属于该放 Secret 的东西。', '核心', 7, '2026-11-24T05:26:12.092169+00:00');
INSERT OR IGNORE INTO custom_items (id, module_id, title, content, tag, sort, created_at) VALUES (144, 11, '持久化存储', '容器删除数据即失，数据库需要持久化：PV（持久卷，实际存储）← PVC（申请单，用户声明要多大）← Pod 挂载。

StorageClass 让云厂商自动按需创建 PV——声明 10Gi，云平台自动开出云盘挂上来。', '进阶', 8, '2026-11-24T05:26:12.092169+00:00');
INSERT OR IGNORE INTO custom_items (id, module_id, title, content, tag, sort, created_at) VALUES (145, 11, 'Namespace', '集群内的资源隔离边界：default、kube-system（系统组件）是内置的；企业常按 dev/test/prod 划分。

kubectl get pod -n kube-system 看系统组件；不指定 -n 默认 default。资源配额（ResourceQuota）可按命名空间限制总量。', '基础', 9, '2026-11-24T05:26:12.092169+00:00');
INSERT OR IGNORE INTO custom_items (id, module_id, title, content, tag, sort, created_at) VALUES (146, 11, '资源配额与调度', '每个容器声明 requests（申请多少 CPU/内存，调度依据）和 limits（上限，超限限流/杀容器）。

QoS 三档：Guaranteed（requests=limits，最重要，最后被杀）、Burstable、BestEffort——节点资源紧张时按这个顺序驱逐 Pod。', '进阶', 10, '2026-11-24T05:26:12.092169+00:00');
INSERT OR IGNORE INTO custom_items (id, module_id, title, content, tag, sort, created_at) VALUES (147, 11, '健康探针', '三种探针：liveness（活没活，挂了重启容器）、readiness（能不能接流量，没好就不挂到 Service）、startup（启动慢的兜底，成功前另外两种不生效）。

合理的探针是自愈能力的前提——本项目 compose 里 db 的 healthcheck 就是同样思想。', '核心', 11, '2026-11-24T05:26:12.092169+00:00');
INSERT OR IGNORE INTO custom_items (id, module_id, title, content, tag, sort, created_at) VALUES (148, 11, 'kubectl 常用命令', 'kubectl get pods -A 看全部 Pod（-o wide 看详情）、describe pod 排查事件、logs -f 跟日志、exec -it 进容器、apply -f xxx.yaml 应用清单、delete 删除。

排查四连：get 看状态 → describe 看事件 → logs 看日志 → exec 进现场——和 Docker 排障一脉相承。', '基础', 12, '2026-11-24T05:26:12.092169+00:00');
INSERT OR IGNORE INTO custom_items (id, module_id, title, content, tag, sort, created_at) VALUES (149, 11, 'Helm', 'K8s 的包管理器：一个 chart（模板化 YAML 集合）描述整套应用，helm install 一键部署，参数化适配不同环境。

类比：apt 之于 Ubuntu、npm 之于 Node——装个数据库 helm install bitnami/postgresql，比自己手写十几份 YAML 强太多。', '进阶', 13, '2026-11-24T05:26:12.092169+00:00');
INSERT OR IGNORE INTO custom_items (id, module_id, title, content, tag, sort, created_at) VALUES (150, 11, 'K8s 与 Docker 的关系', 'K8s 不直接依赖 Docker：它通过 CRI（容器运行时接口）对接底层，1.24 起移除了 dockershim，主流用 containerd（Docker 底层同款运行时）。

Docker 擅长开发打包，K8s 擅长生产编排——学习路径：Docker 单机跑顺 → Compose 管多容器 → K8s 管集群，本系统三个层次的例子都齐了。', '进阶', 14, '2026-11-24T05:26:12.092169+00:00');
