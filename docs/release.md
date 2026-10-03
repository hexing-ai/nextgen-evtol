# 发布与验证记录

日期：2026-10-03。此记录区分已上线版本与仓库展示整理，不代表所有浏览器或硬件的兼容性承诺。

## 已上线的可玩版本

- Demo：https://hexing-ai.github.io/nextgen-evtol/
- 仓库：https://github.com/hexing-ai/nextgen-evtol
- 已验证代码提交：`8b7fd5adfd13bc11dbb55c09d05b7fe069686a4d`
- 成功发布：[GitHub Actions #37100809915](https://github.com/hexing-ai/nextgen-evtol/actions/runs/37100809915)
- 29 项自动化测试通过；生产构建与静态 JSON / runtime 导出成功。
- 公网浏览器已验证登机、乘客与轻驾驶切换、键盘操控、镜头、拍照、自动接回、完整抵达与暂停恢复。
- 390 × 844 视口检查无横向溢出；未据此宣称手机真机普遍适配。

完整实现与边界见 [前端验收记录](frontend-acceptance.md)。后端早期记录中的 26 项是当时数量，后续加入帧时间测试后为 29 项。

## 仓库展示整理

新增中英文 README、实机截图、三分钟体验路径、完整克隆启动步骤、架构图、安装与部署排错、贡献入口和 Issue 模板。同步修正旧 API 文档中“前端未开始”的历史描述。

Node 最低要求统一为 22.12，新增 `.nvmrc` 指向 Node 22。没有更改飞行逻辑或增加运行服务。

此次本地复核（Node 22.23.1 / npm 10.9.8）：

- 从 GitHub 新克隆副本，使用本次更新的 package 清单与锁文件，在无现有 node_modules 的条件下运行 `npm ci` 成功；审计报告当时为 0 vulnerabilities。
- `npm run check` 全部通过：29 项测试、航线数据校验、生产构建与 8 份 JSON 导出。
- `npm run dev -- --port 5194 --strictPort` 启动成功；后台浏览器确认页面标题、三维 canvas 与可点击的「开始登机」。
- 46 个 Markdown 本地链接检查通过；三张实机图已人工检查。
- 构建仍有已知 Cesium 大包提示，未将其隐藏或当作性能问题已解决。

## 验证范围与限制

首载需下载 Cesium 和地理资源；在线影像与字体依赖外部网络。建筑精度、游戏保护、数据许可和设备性能限制见 [架构文档](ARCHITECTURE.md) 与 [第三方声明](../THIRD_PARTY_NOTICES.md)。

最新部署状态以 [Pages 工作流](https://github.com/hexing-ai/nextgen-evtol/actions/workflows/pages.yml) 为准。
