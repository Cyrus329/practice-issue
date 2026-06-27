# v19 手机图片加载修复报告

修复内容：

- 图片路径统一加 `./` 和版本号，避免手机端读取旧缓存。
- 停用并清理旧 Service Worker 缓存，避免继续加载旧版缺图资源。
- 增加图片加载失败后的内置图片包 fallback：即使 `question-images` 文件夹没被完整上传，也会从 `image-pack-*.js` 读取图片。
- 放大弹窗同样支持 fallback，不再只显示问号图标。

新增文件：

- `image-pack-comp.js`：计算机官方解析图备用包。
- `image-pack-wrongbook.js`：高数错题本原图备用包。
- `image-pack-math-eng.js`：高数函数、英语解析图备用包。

说明：正常情况下仍优先加载 `question-images` 文件夹里的图片；如果手机端显示问号，会自动读取备用包。
