# 安装、开发与部署

[返回首页](../README.md) · [架构](ARCHITECTURE.md) · [API](API.md)

## 从零启动

安装 Git 和 Node.js 22.12+（推荐 Node 22 LTS，包含 npm），然后运行：

```sh
git clone https://github.com/hexing-ai/nextgen-evtol.git
cd nextgen-evtol
npm ci
npm run dev
```

nvm 用户可在项目目录先执行 `nvm install && nvm use`。打开终端打印的本地 URL，默认 `http://127.0.0.1:5173`。等「开始登机」可点击后体验；首次下载依赖和三维资源的耗时由网络决定。

不需要环境变量、账号、数据库或 API key。仓库已包含 DEM、建筑快照和机型；启动无需重抓地理数据。`dev` 和 `build` 会自动准备 Cesium 的 Workers、Assets、Widgets、ThirdParty 与声明文件。

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | Vite 开发网页与热更新 |
| `npm test` | Node 自动化测试，包含本机 HTTP 集成 |
| `npm run check:data` | 检查场景、航线和保护数据 |
| `npm run build` | 生成可部署的 `dist/` 和静态 API |
| `npm run check` | 数据校验、测试、生产构建和静态导出 |
| `npm run preview` | 预览已构建的 `dist/`，默认端口 4173 |
| `npm start` | 可选 Node REST API，默认 `127.0.0.1:8787` |
| `npm run assets:aircraft` | 重新生成原创 NG-01 模型，一般开发不需要 |

需要固定端口时：

```sh
npm run dev -- --port 5194 --strictPort
```

`Ctrl+C` 停止自己启动的服务。不要直接双击 `index.html` 或 `dist/index.html`；Cesium 的模块、Worker 和资源需要 HTTP 服务。

## 可选 API 联调

在另一个终端启动 `npm start`，再访问：

```sh
curl http://127.0.0.1:8787/healthz
curl http://127.0.0.1:8787/api/v1/manifest
```

Node 服务支持 `HOST`、`PORT`、`CORS_ORIGINS`，默认只监听本机；CORS 如需跨源联调，应设置准确来源。当前网页直接调用共享逻辑，启动 API 不会让网页自动改用网络计算。服务不保存用户飞行状态。完整输入、单位、错误格式见 [API 契约](API.md)。

## 发布到 GitHub Pages

仓库已有 `.github/workflows/pages.yml`：main 推送 → `npm ci` → `npm run check` → 上传 `dist/` → Pages 部署。PR 通过独立检查工作流验证。

部署自己的副本时：

1. 在自己的 GitHub 仓库中放入代码，并启用 Actions。
2. 打开 **Settings → Pages → Build and deployment → Source**，选择 **GitHub Actions**。
3. 推送到 `main`，或在 Actions 手动运行 **Verify and deploy Nextgen eVTOL**。
4. 等 build 和 deploy 都成功，访问 Pages 给出的 URL。
5. 更新自己仓库 README 的 Demo、徽章与仓库链接。

工作流已声明 Pages 所需权限；网页不需要部署私密凭证。不要把私密 key 放进 `VITE_*` 或前端代码。`base: './'` 支持项目子路径。Pages 只服务静态文件；需要动态 API 时另行托管 Node 服务。

公开代码的使用和再分发应先确认 [许可状态](../THIRD_PARTY_NOTICES.md)；以上部署说明本身不授予代码或数据许可。

## 常见问题

| 现象 | 排查方法 |
| --- | --- |
| npm 提示 Node 版本不满足 | 用 `node --version` 检查，升级至 Node 22.12+；nvm 用户运行 `nvm install && nvm use` |
| 安装中断或依赖缺失 | 确认 npm registry 可达，重新运行 `npm ci`；保留锁文件，不需先手动下载 Cesium |
| 网页打不开、只有 JSON | 网页运行 `npm run dev`；`npm start` 是 API；使用各自终端输出的 URL |
| 默认端口打不开 | 看 Vite 实际打印的端口；或使用上面的 `--port 5194 --strictPort` |
| 三维场景报错或空白 | 开启硬件加速，使用支持 WebGL 2 的现代浏览器；更新显卡驱动并重新加载 |
| 建筑出现但卫星地表模糊或缺失 | Esri 影像正在加载或请求失败，检查网络；地形与建筑来自本地资源 |
| 首载较慢或画面卡顿 | 等待 Cesium 和资源下载；设置切换「流畅」；关闭不必要的高 GPU 负载程序 |
| 按键不推动飞机 | 确认处于「轻驾驶」且未暂停、未打开弹窗；页面切回后需要继续飞行 |
| 相册或恢复记录消失 | 存档仅在同一浏览器、同一站点来源内有效；隐私模式或清除网站数据可能移除它，重要照片先下载 |
| 自动接回后悬停 | 保护规则可能拒绝当前路径；切回轻驾驶，在可驾驶区域内调整位置后再尝试接回 |
| 测试报监听权限错误 | HTTP 集成测试需允许本机回环端口；检查容器或沙箱限制 |

报告问题时请附浏览器/系统/GPU（如已知）、复现步骤、实际现象与截图。不要粘贴 cookie、token 或私密环境变量。

## 数据加工不是启动前置步骤

- `scripts/fetch-terrain.mjs`：从公开地形服务生成区域 DEM。
- `scripts/prepare-geography.mjs`：读取原始 OSM JSON，生成建筑与相关数据。原始节点全集未提交，派生数据库保留源 way ID。
- `scripts/prepare-protection.mjs`：更新地形保护网格。

更换数据应同时检查来源、许可、坐标/单位、版本与保护规则，再运行 `npm run check`。不要将更精细的可视模型直接视作已验证的安全网格。
