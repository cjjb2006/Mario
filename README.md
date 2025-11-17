# 像素平台跳跃小游戏

经典横版卷轴跳跃游戏，含金币收集、敌人踩踏、终点旗杆等玩法。

## 体验地址（仅示例）

GitHub Pages 发布后会生成类似：https://你的账号.github.io/仓库名/

---

## 如何发布到 GitHub Pages？

### 1. 新建 Git 仓库并推送源码（仅首次）

假设你文件夹为 `Mario` ：

```bash
cd /Users/yl/Cursor/Mario
# 初始化仓库（如果还没 git init）
git init
git add .
git commit -m "init pixel platformer"
# 新建 github 仓库，然后关联远程
# 替换下面 YOUR_USER 和 YOUR_REPO
# 示例: git remote add origin https://github.com/YOUR_USER/Mario.git
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git push -u origin main
```

### 2. 设置 Github Pages

1. 进入你的仓库页面 → Settings（设置） → Pages 菜单。
2. 选择 **Branch: `main`**，目录为 `/` 或 `/root`。
3. 保存，稍等几分钟即可生成一个网址。

### 3. 注意事项

- **入口只需 `index.html`, `game.js`, `style.css`, `assets/` 文件夹。**
- 不需要 `.venv` 、开发依赖、py代码，仅保留静态资源。
- 路径全部采用相对路径（已适配）。
- 推送后几分钟就能打开网站。

### 4. 访问页面

- 地址类似：`https://你的账号.github.io/仓库名/`
- 打开即可游玩。


---

如需自适应手机等扩展功能，可以后续提Issue或进一步开发！ 如果还有疑问欢迎随时咨询~
