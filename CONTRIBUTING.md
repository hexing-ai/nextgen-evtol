# 参与 Nextgen eVTOL

感谢你体验香港的下一种出行方式。[在线 Demo](https://hexing-ai.github.io/nextgen-evtol/) · [开发指南](docs/DEVELOPMENT.md)

当前最有帮助的参与方式是可复现的问题反馈、设备表现记录、地理数据来源和观景航线建议。Issue 可使用中文或英文；无需先搭建开发环境。

## 报告问题

从 [Issues](https://github.com/hexing-ai/nextgen-evtol/issues/new/choose) 选择问题模板，写明：

- 浏览器、操作系统、屏幕或设备型号，GPU 如已知。
- 从登机开始的具体步骤，乘客/轻驾驶模式、镜头和大致航程时间。
- 期待结果、实际结果；截图和控制台错误如有。
- 是否在当前在线 Demo 重现。

不要附带 token、cookie、账户资料或其他私密内容。

## 提议功能与数据

请先搜索现有 Issue。说明玩家在什么场景下会用到它；航线建议请给出起终点与沿途景观。推荐三维资产或数据时附来源、许可与覆盖范围。优先关注观景体验、视觉质量、操作和性能；当前不扩展到无人机物流或真实航空运营。

## 代码改动

较大改动先用 Issue 说明问题与范围。开发入口与命令见 [DEVELOPMENT.md](docs/DEVELOPMENT.md)。提交前运行 `npm run check`；界面变更附实际运行截图，飞行规则变更补充能验证行为的测试。不要提交 `node_modules`、`dist`、自动复制的 Cesium 资源或凭证。

原创代码的开源许可尚未确定。提交代码前请先与维护者明确该改动的许可与接收方式；本指南不新增 CLA，也不为原有代码授予许可。OSM 数据和第三方资源须保留各自署名与条款，见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
