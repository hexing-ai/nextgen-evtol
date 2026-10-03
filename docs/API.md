# Nextgen eVTOL 后端契约

版本 v0.1.0。所有场景内容是概念数据。标准响应为 JSON；错误格式为 `{ "error": { "code", "message", "field"? } }`。

## HTTP 接口

| 方法 | 路径 | 作用 |
|---|---|---|
| GET | `/healthz` | 服务状态与内容就绪状态 |
| GET | `/api/v1/manifest` | 产品信息、数据版本与资源路径 |
| GET | `/api/v1/scene` | 完整概念场景 |
| GET | `/api/v1/routes` | 航线摘要 |
| GET | `/api/v1/routes/victoria-first-flight` | 时间化航点 |
| GET | `/api/v1/aircraft` | 概念机型和游戏参数 |
| GET | `/api/v1/landmarks` | 待核对可见性的地标信息 |
| GET | `/api/v1/sources` | 资料来源及状态 |
| GET | `/api/v1/openapi.json` | OpenAPI 3.1 文档 |
| POST | `/api/v1/flights` | 创建一个客户端持有的飞行状态，201 |
| POST | `/api/v1/flights/mode` | 计算模式切换后的状态 |
| POST | `/api/v1/flights/step` | 推进单次运动，限 0 至 0.25 秒 |
| POST | `/api/v1/flights/preview` | 导出航迹采样，采样间隔 0.25 至 30 秒 |
| POST | `/api/v1/checkpoints/validate` | 检查本地存档，返回暂停待恢复的状态 |

只读资源支持 HEAD、ETag 条件请求，以及 manifest 列出的 `.json` 静态别名。CORS 默认同源，可通过环境变量声明准确的开发域名。POST 使用 `application/json`，请求体最大 64 KiB；400 表示 JSON 损坏，413 表示超限，415 表示内容类型错误，422 表示业务参数无效。

创建：

```json
{ "routeId": "victoria-first-flight", "mode": "passenger" }
```

逐步计算：

```text
{ state: <上一响应或本地有效状态>, deltaSeconds: 0.0166667,
  input: { throttle: 0, turn: 0.5, climb: 0, hover: false } }
```

存档校验：

```text
{ schemaVersion: 1, savedAt: <ISO 时间字符串>, state: <飞行状态> }
```

接口不持久化上述状态。不是用户身份系统，也不提供全球排行榜防作弊承诺。客户端每帧应直接使用共享逻辑，HTTP step 用于联调及其他调用方，不要求每秒数十次联网。

## 浏览器共享模块

静态导出把 `geometry.mjs`、`flight.mjs`、`validation.mjs` 写入 `dist/runtime/`，不依赖 Node API。

```js
import { createFlight, stepFlight, setMode, setPaused } from './runtime/flight.mjs';
const manifestURL = new URL('api/v1/manifest.json', document.baseURI);
const manifest = await (await fetch(manifestURL)).json();
const scene = await (await fetch(new URL(manifest.resources.scene, manifestURL))).json();
let state = createFlight(scene, 'passenger');
state = setMode(scene, state, 'pilot');
state = stepFlight(scene, state, { throttle: 1 }, 1 / 60);
state = setPaused(state, 'focus');
```

这只是接口用法示例，前端实现尚未开始。保存状态读取后先调用 `validateCheckpoint`，由用户继续再清除暂停原因。输入系统需在失焦后清除按键，不得把后台累计时间传入 `stepFlight`。

## 状态与单位

- 位置使用局部东 x、北 y、示意高度 z，单位米；它不是已经校准的香港官方高程。
- 速度使用米/秒；时间使用秒；航向以北为 0，向东为正，单位弧度。
- `routeSeconds` 为自动航迹进度；`elapsedSeconds` 为有效体验时间，暂停不计时。
- `mode` 是乘客或轻驾驶；`control` 是自动航迹、驾驶、接回或悬停。
- `pauseReason` 为 null、user、focus、resources；模式与镜头不受暂停影响，但暂停时不推进位置。
- `setMode` 不直接改变位置、朝向、速度。接回段与正常驾驶均通过几何保护；路径受阻时悬停。
- `discoverLandmark` 只做已知 ID 和去重；实际可见性与用户打开行为由前端结合场景判断。
- 初版障碍代理是示意盒，不是香港实测建筑。正式地理集成后需替换与重验。

## GitHub Pages 兼容

`npm run export:static` 产生 8 份 JSON、校验和清单及共享模块。manifest 中资源是相对路径，可部署于 `/nextgen-evtol/` 等项目子路径，不依赖根路径或后端域名。当前导出不包含页面，也不会自行发布。

后续前端批准后合并 Vite 的静态构建，保留同一份数据版本和逻辑版本，新增 Pages 发布工作流。不要尝试让 Pages 执行 Node 服务器，也不要为没有云存档的体验新增数据库。
