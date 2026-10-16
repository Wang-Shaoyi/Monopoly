# 棋盘图标 · 第一轮样稿

这一轮只绘制五个图标供审阅，不修改棋盘、代码或地名配置。美国题材按聊天中最新确认的地名方案选取，尚未写入现有棋盘配置。

| 文件 | 用途 | 选择的图形 |
| --- | --- | --- |
| zh-jingdezhen-porcelain-v1.png | 中文版：景德镇 | 圆润青花瓷瓶，精简蓝色花叶纹 |
| zh-huangshan-pine-v1.png | 中文版：黄山 | 花岗岩山峰、横生松树、少量云雾 |
| en-las-vegas-sign-v1.png | 英文版：Las Vegas | 星芒、复古菱形灯牌，用图形代替细小文字 |
| en-seattle-space-needle-v1.png | 英文版：Seattle | 太空针塔的碟形观景台和支撑腿 |
| shared-water-works-v1.png | 中英共用：自来水厂 / Water Works | 水龙头和水滴 |

## 画风与后续摆放

参照现有 Shibagy 和 Ada 头像的柔和粉彩、圆润形状与轻微水彩质感，保持物件轮廓简洁。独立透明底 PNG，不添加圆形头像框、不绘制棋盘。后续城市图标可覆盖棋盘边线，功能格图标可放在格子内部；实际尺寸、遮挡与锚点等通过风格审阅后再确定。

## 搜索依据

- 景德镇：市政府介绍青花瓷及传统陶瓷技艺。https://www.jdz.gov.cn/zwgk/zfgb/2024n/d3q/szfwj/t958190.shtml
- 黄山：UNESCO 对花岗岩山峰、古松及云海的介绍。https://whc.unesco.org/en/list/547
- 拉斯维加斯：旅游局关于 Welcome to Fabulous Las Vegas 灯牌的介绍。https://www.visitlasvegas.com/experience/post/a-brief-history-of-the-welcome-to-fabulous-las-vegas-sign/
- 西雅图：旅游局将太空针塔列为主要景点。https://visitseattle.org/press/press-kit/seattles-major-attractions/
- 共用水务图标采用通用水龙头与水滴符号，不使用特定国家或公司标识。

## 生成记录

使用内置 image_gen 生成。完整英文提示词存于 prompts.json。原始生成结果以独立 PNG 保留，未做后期绘画修改。

这五张通过审阅后，再按用户授权继续余下图标：中国车站共用高铁图形，美国机场共用机场图形，电力和水务中美共用，其他功能格各有对应图标。
