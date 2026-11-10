# dsh-plugins

本仓库承载插件市场的索引（[`index.json`](index.json)）与发布说明。插件本身各自独立仓库，放在子目录里，不进入本仓库。

## 插件项目结构

### 目录与仓库约定

- 插件目录名与包名一致（`dsh-sidebar-notes/` ↔ `dsh-sidebar-notes`）。
- 每个仓库带 `.gitattributes`（`* text=auto eol=lf`）、`.gitignore`（`node_modules/`、`.dsh-notes/`）、`LICENSE`。
- `lib/` 提交进仓库：profile 用 `link:` 或 `github:` 安装时直接加载它，安装过程不构建。

### 文件布局

```
dsh-sidebar-notes/
├─ package.json          # dsh.bundle.patch + dsh.client（platform: web）
├─ cordis.patch.yml      # 把这一层插进 profile
├─ LICENSE
├─ README.md
├─ .gitattributes
├─ .gitignore
├─ market/index.json     # 可选：自建索引源
├─ src/index.js          # Host 入口：注册路由
├─ src/host/             # 路由、协议、存储（唯一信任边界）
├─ src/client/           # 页面、状态、样式、文案
├─ lib/                  # 构建产物（提交）
└─ scripts/build.mjs     # src → lib
```

### package.json 关键字段

| 字段 | 要求 |
|---|---|
| `name` | 发布前用 `npm view <name> version` 确认未被占用 |
| `version` | 语义化版本，不从 `0.0.0` 起 |
| `private` | 发 npm 前删除 |
| `license` | 与 `LICENSE` 文件一致 |
| `main` / `exports` | 指向 `lib/index.js`，并导出 `./client` 与 `./cordis.patch.yml` |
| `files` | 含 `lib`、`cordis.patch.yml`、`README.md`、`LICENSE`，排除 `lib/**/*.map` |
| `repository` / `keywords` | GitHub 地址与检索词 |
| `scripts.build` | `node scripts/build.mjs` |
| `scripts.prepack` | `npm run build` |
| `dsh.bundle.patch` | `./cordis.patch.yml` |
| `dsh.client` | `{ "platform": "web", "inject": [...] }` |
| `peerDependencies` | `@deepseek-ai/cordis` |
| `engines.node` | 与工具链实际要求一致 |

### profile 的接线

profile 是 pnpm 项目，装包即接线，`dsh.profile.bundles` 由 DSH 的 bundle reconcile 维护，不手改。

## 发布方法

### 远端

| remote | 主机 | 用途 |
|---|---|---|
| `origin` | github.com | 默认源，`git push` |
| `local` | git.daveny.cn:2222 | 自建镜像，`git push local` |

首次接线：

```powershell
git remote add origin git@github.com:<owner>/<repo>.git
git remote add local  ssh://git@git.daveny.cn:2222/<owner>/<repo>.git
git config remote.local.push "refs/heads/*:refs/heads/*"
git push -u origin main
git push local
```

之后每次发布：`git push && git push local`。

### 发一个版本

1. 改 `package.json` 的 `version`；
2. `npm run build`；
3. `git add -A`（确认 `lib/` 在本次改动里）并提交；
4. `git push && git push local`；
5. 发 npm（可选）：`npm publish`；
6. 更新 `market/index.json` 的 `versions`。

打包内容核对：

```powershell
npm pack --pack-destination $env:TEMP
tar -tzf (Get-ChildItem "$env:TEMP\*.tgz" | Select-Object -First 1).FullName
```

### 分发方式

**1. 直接从仓库装**（不需要 npm）

```powershell
dsh plugin --profile web add github:<owner>/<repo>
```

前提：仓库 public、包根就是仓库根、默认分支有内容、`lib/` 已提交。子目录里的包用 `github:<owner>/<repo>#path:/<subdir>`。装完重启 DSH。

**2. 发布到 npm**

```powershell
npm publish
```

安装方：`dsh plugin --profile web add <name>`，可锁版本 `<name>@0.2.0`。

**3. 自建索引源**（出现在「发现」页）

把一份 `index.json` 放到任意 HTTPS 地址，在插件市场的「管理索引源」里添加。格式 `format: 1`：

```json
{
  "format": 1,
  "title": { "en": "my index", "zh": "自建源" },
  "metadata": {
    "categories": { "ui": { "title": { "en": "UI enhancements", "zh": "UI 增强" } } },
    "labels": {},
    "sortKeys": {}
  },
  "plugins": [{
    "name": "<package-name>",
    "description": { "en": "...", "zh": "..." },
    "author": "<owner>",
    "repository": { "url": "https://github.com/<owner>/<repo>" },
    "metadata": { "category": "ui", "keywords": [], "labels": [], "sortKeys": { "stars": 0 } },
    "versions": [{
      "version": "0.1.0",
      "publishTimestamp": 1794326943,
      "source": { "type": "npm" }
    }]
  }]
}
```

`source` 两种形态：`{ "type": "npm" }` 或 `{ "type": "git", "url": "...", "commit": "<40 位 sha>" }`。

`labels` 里的 `install-verified`、`risk-low` 来自平台沙盒安装与安全审计，`stars-*`、`npm-*` 由平台扫描，自建源保持为空。

参考实现：[index.json](index.json)（本仓库根目录）。

**4. 进官方目录**

向 [awesome-dsh-plugin/awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) 提 PR 加一条，字段 `name` / `owner` / `url` / `category` / `description{en,zh}` / `npm`（可为 null）。`version`、`stars`、`downloads`、`install`、`capabilities` 由目录 CI 扫描生成。

`npm` 为 null 时 `install` 生成成 `github:owner/repo` 形式。进入 DSH.SO 的「安装验证与安全审计」源需平台侧沙盒验证与安全审计通过。
