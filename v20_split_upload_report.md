# v20 GitHub 上传修复版

问题：GitHub 网页上传单个文件限制约 25MB，v19 的 `image-pack-wrongbook.js` 约 79MB，无法通过网页上传。

处理：

- 删除大文件 `image-pack-wrongbook.js`
- 拆分为 4 个小文件：
- image-pack-wrongbook-01.js
- image-pack-wrongbook-02.js
- image-pack-wrongbook-03.js
- image-pack-wrongbook-04.js
- 每个拆分文件均小于 25MB
- `app.js` 已改为按需加载所有拆分图片包
- 版本号更新为 `v20-split-image-packs`

上传 GitHub 时请上传解压后的全部文件和文件夹，不要上传 zip 本身。
