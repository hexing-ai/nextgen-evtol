# Nextgen eVTOL

[在线体验](https://hexing-ai.github.io/nextgen-evtol/) · [GitHub 仓库](https://github.com/hexing-ai/nextgen-evtol)

以香港维多利亚港为场景的未来 eVTOL 出行体验。乘客观景与轻驾驶自由切换，可拍照、发现地标、暂停并恢复航程。

首版是可交互的浏览器三维原型：开放地形、真实建筑轮廓与原创概念机型。不是官方精细数字孪生，也不是飞行训练或导航软件。

## 本地运行

Node.js 22.12+。

```sh
npm ci
npm run dev
```

按终端输出打开本机地址，默认 5173，已占用时 Vite 会使用下一个空闲端口。

```sh
npm run check      # 航线校验、自动化测试、生产构建与静态接口导出
npm run preview    # 预览 dist，默认 4173
npm start          # 可选本地 REST API，127.0.0.1:8787
```

WebGL 2 和硬件加速是必要条件。首次加载需要下载三维运行库及本地地理资源；在线卫星影像、Google Fonts 需要联网。影像在后台加载，失败时保留三维地形和建筑。建议桌面浏览器；小屏提供触控方向按钮与流畅画质设置。

## 体验

- **乘客**：自动完成中环海滨 → 西九龙海滨的 5 分 30 秒概念航线。
- **轻驾驶**：W/S 前进与减速、A/D 转向、Q/E 上升与下降、空格减速悬停。可随时交还自动驾驶。
- **镜头**：舷窗、前舱、外部跟随；拖动画面环顾，点击回正视角恢复默认方向。
- **暂停**：点击暂停或按 Escape。离开页面自动暂停，恢复存档后也保持暂停。
- **摄影**：将当前三维画面保存到本机 IndexedDB 相册，最多 12 张，支持下载与删除。
- **存档**：飞行进度每 5 秒及主要操作时保存至本机 localStorage。没有云端账户；不同设备不共享进度。

## 地理数据与边界

- 香港区域 DEM：113.83–114.45°E，22.15–22.58°N，来源为 Mapzen Terrain Tiles，重采样为本地高度网格。
- 维港核心区约 7,748 个 OSM 建筑及建筑分层轮廓；有高度或层数时按标注使用，缺失时根据类型估算。未涵盖所有多面关系或最新建筑。
- IFC、ICC 等核心地标的轮廓是原创简化模型。坐标、高度和视线不是测绘验收结果。
- 起降平台、NG-01 六旋翼飞机和飞行航线均为未来概念设施。
- 游戏限制在维港观景区域，有边界、DEM 高度与建筑包围盒保护。不是全港自由飞行，未验证真实空域或工程安全。
- 香港地政总署官方 3D Tiles 服务已核查，需要授权 key；首版未接入该精细模型服务。

地理数据处理脚本：`scripts/fetch-terrain.mjs`、`prepare-geography.mjs`、`prepare-protection.mjs`。建筑提取使用 OSM 官方地图 API 的分块输出，准备脚本接受合并的 OSM JSON。原始节点数据不在此仓库中；公开的派生建筑数据库包含源 way ID。

## 架构与开源复用

React + Resium 管理页面与三维生命周期，CesiumJS 提供地理坐标、地形、建筑、模型与镜头渲染。参考 Flight3DView 的播放/镜头组织方式，没有复制其业务代码。UI、机型、航程状态与交互为本项目实现。

`backend/src/flight.mjs`、`geometry.mjs`、`validation.mjs` 同时供 Node API 与浏览器使用。前端直接使用同源版本化场景和共享逻辑，不向 Pages 发动态 POST 请求。

```text
frontend/             页面、三维场景、地形适配、摄影与声音
backend/data/         版本化场景、航线、障碍与资料来源
backend/src/          REST API 和浏览器共享飞行逻辑
backend/test/         飞行规则、地形保护、HTTP 集成测试
public/geo/           OSM 建筑数据库和地形高度网格
public/models/        原创 NG-01 glTF 机型
scripts/              资源准备、地理数据处理与静态接口导出
docs/                 接口与验收记录
```

## GitHub Pages

Pages 只托管静态文件。生产构建输出网页、场景资源、只读 `api/v1/*.json` 及共享 `runtime/*.mjs`，使用相对路径支持项目子目录。Node API 仅用于本机联调或另行部署。

`.github/workflows/pages.yml` 在 main 推送时运行全部检查并发布 `dist/`。仓库 Pages 构建源需设为 GitHub Actions。运行时不需要私密凭证；不要把私密 key 放入 `VITE_*` 环境变量或前端代码。

数据与第三方条款见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)，API 见 [docs/API.md](docs/API.md)。
