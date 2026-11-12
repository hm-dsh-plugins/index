# dsh-plugins

本仓库承载插件市场的索引（[`index.json`](index.json)）与发布说明。插件本身各自独立仓库，放在子目录里，不进入本仓库。

## 插件项目结构

### 目录与仓库约定

- 插件目录名与包名一致（`dsh-sidebar-notes/` ↔ `dsh-sidebar-notes`）。
- 每个仓库带 `.gitattributes`（`* text=auto eol=lf`）、`.gitignore`（`node_modules/`、`.dsh-notes/`）、`LICENSE`。
- `lib/` 提交进仓库：profile 用 `link:` 或 `github:` 安装时直接加载它，安装过程不构建。
- 索引只有一份，就是本仓库根的 [`index.json`](index.json)；插件仓库里不放索引文件。

### 文件布局

```
dsh-sidebar-notes/
├─ package.json          # dsh.bundle.patch + dsh.client（platform: web）
├─ cordis.patch.yml      # 把这一层插进 profile
├─ LICENSE
├─ README.md
├─ .gitattributes
├─ .gitignore
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
| `license` | 与 `LICENSE` 文件一致（本仓库统一 GPLv3） |
| `main` / `exports` | 指向 `lib/index.js`，并导出 `./client` 与 `./cordis.patch.yml` |
| `files` | 含 `lib`、`cordis.patch.yml`、`README.md`、`LICENSE`，排除 `lib/**/*.map` |
| `repository` / `keywords` | GitHub 地址与检索词 |
| `scripts.build` | `node scripts/build.mjs` |
| `scripts.prepack` | `npm run build`，打包前重建 `lib/` |
| `dsh.bundle.patch` | `./cordis.patch.yml` |
| `dsh.client` | `{ "platform": "web", "inject": [...] }` |
| `dsh.manifestVersion` | `1` |
| `engines.dsh` | DSH 版本范围，如 `>=0.2.0 <0.3.0` |
| `engines.node` | 与工具链实际要求一致，如 `^22.22.2 \|\| ^24.15.0 \|\| >=26.0.0` |
| `peerDependencies` | `@deepseek-ai/cordis` |

`engines.dsh` 由 DSH 的安装与启动检查求值，用的是 `semver.satisfies(..., { includePrerelease: true })`，所以 `0.2.2-rc.1` 满足 `>=0.2.0 <0.3.0`。写了 `engines.dsh` 之后，兼容性只由它决定，不再回退到 `@deepseek-ai/dsh*` 的 peer 范围。

### profile 的接线

profile 是 pnpm 项目，装包即接线，`dsh.profile.bundles` 由 DSH 的 bundle reconcile 维护，不手改。

## 安装

`dsh plugin --profile web <args>` 是 **pnpm 的透传**（`--help` 打出来就是 pnpm 的帮助），所以 `add` 接受 pnpm 能接受的一切：

| 传什么 | 得到什么 | 什么时候用 |
|---|---|---|
| 本地目录路径 | `link:` | 自己开发 |
| `file:./dsh-sidebar-editor` | 拷贝一份，之后改仓库不影响已装的 | 想固定住某个版本 |
| `./dsh-sidebar-editor-0.1.0.tgz` | 装 `npm pack` 的产物 | 内部传阅，不走 registry |
| `github:<owner>/<repo>` | 从 GitHub 拉 | 还没发 npm、但想让别人试 |
| `<name>` | 从 npm 拉 | 正式分发 |

后两种才是别人能用的。**直接从仓库装**的前提：仓库 public、包根就是仓库根、默认分支有内容、`lib/` 已提交。子目录里的包用 `github:<owner>/<repo>#path:/<subdir>`。装完重启 DSH。

## 发布

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

### 包内容

`npm pack --dry-run` 的产物（以 `dsh-sidebar-editor` 为例，10 个文件，约 437 KB）：

```
LICENSE                    1.1kB
README.md                 19.5kB
cordis.patch.yml           365B
lib/client.js              1.6MB
lib/host/protocol.js       3.4kB
lib/host/route.js          2.0kB
lib/host/text-file.js      7.7kB
lib/host/workspace-path.js 6.1kB
lib/index.js               1.7kB
package.json               2.3kB
```

`src/`、`scripts/`、`node_modules/` 不进包。`lib/client.js.map` 也不进：它比 bundle 本身还大（3.0 MB vs 1.6 MB），装插件的人用不到——浏览器按 `plugins/??<name>/client.js&rev=…` 加载，没有地方去取这份 map。

### 发一个版本

1. 改 `package.json` 的 `version`；
2. `npm run build`；
3. `git add -A`（确认 `lib/` 在本次改动里）并提交；
4. `git push && git push local`；
5. 发 npm（可选）：`npm publish`；
6. 在本索引仓库改 `index.json`：该版本的 `source` 用 `{ "type": "git", "url": …, "commit": "<40 位 sha>" }` 指向刚推送的提交，提交后 `git push && git push local`。

打包内容核对：

```powershell
npm pack --pack-destination $env:TEMP
tar -tzf (Get-ChildItem "$env:TEMP\*.tgz" | Select-Object -First 1).FullName
```

### 发布到 npm

`prepack` 会自动跑 `npm run build`，所以 tarball 里的 `lib/` 一定来自当前 `src/`：

```powershell
npm run verify
npm pack --dry-run
npm publish
```

包名不带 scope 就是包名本身；如果改用 scope（`@你/<name>`），首次发布要加 `--access public`。

> 发出去就收不回来了：`npm unpublish` 有 72 小时窗口，而且**版本号不重用**，撤回也占着那个号。所以先在 `npm pack --dry-run` 上确认清楚。

安装方：`dsh plugin --profile web add <name>`，可锁版本 `<name>@0.2.0`。

## 索引源

### 自建索引源（出现在「发现」页）

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

参考实现：[`index.json`](index.json)（本仓库根目录），地址

```
https://raw.githubusercontent.com/hm-dsh-plugins/index/main/index.json
```

索引里的 `source.commit` 钉在插件的具体提交上，安装时按 `git+<url>#<commit>` 取包，不随分支浮动。每次发版只做一件事：把索引里这条的 `version`、`publishTimestamp`、`commit` 换成新提交，推 `index` 仓库。

### 官方目录（dsh-market 里能被搜到）

dsh-market 里的插件列表不是它自己维护的，而是每次打开时实时读 [awesome-dsh-plugin.com/plugins.json](https://awesome-dsh-plugin.com/plugins.json)。那个目录的源头是 GitHub 仓库 [awesome-dsh-plugin/awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)。

**做法就是向那个仓库提一个 PR，加一条。** market 自己仓库的 README 特意写明：别把插件条目 PR 到 market 那个 repo。

条目长这样（字段取自目录里真实的一条）：

```json
{
  "name": "dsh-sidebar-editor",
  "owner": "hm-dsh-plugins",
  "url": "https://github.com/hm-dsh-plugins/dsh-sidebar-editor",
  "category": "ui",
  "description": {
    "en": "Editable CodeMirror renderer for the Sidebar's document preview: open a text file and edit it like a notepad, with an LF/CRLF control.",
    "zh": "在侧边栏的文档预览里用 CodeMirror 直接编辑文本文件，并提供一个 LF/CRLF 行尾切换。"
  },
  "npm": "dsh-sidebar-editor"
}
```

`version`、`stars`、`downloads`、`install`、`capabilities`、`added` 这些**不用你写**，是它 CI 扫出来的。`npm` 为 null 时 `install` 生成成 `github:<owner>/<repo>` 形式。

`category` 从下面 24 个里选一个（`en` 是官方标签）：

| | | | |
|---|---|---|---|
| `agi` AGI 架构探索 | `ui` UI 增强 | `usage` 用量与计费 | `theme` 主题与外观 |
| `model` 模型与供应商 | `identity` 身份与通信 | `session` 会话与消息 | `memory` 记忆 |
| `tools` 工具与能力 | `wsl` WSL 与 Windows 互操作 | `browser` 浏览器与网络 | `vision` 视觉与多模态 |
| `voice` 语音与音频 | `docs` 文档与渲染 | `skill` 技能 | `workflow` 工作流与自动化 |
| `git` Git 与代码审查 | `notify` 通知与集成 | `dev` 开发与运行时 | `security` 安全与权限 |
| `remote` 远程与移动端 | `market` 插件市场与管理 | `fun` 娱乐 | |

**需要一个 GitHub 仓库。** 目录里每条都挂在 `owner` + `url` 上，纯 npm、没有源码仓库的插件没有位置。所以顺序是：

1. 发 npm（或至少把源码推到 GitHub）
2. 去 awesome-dsh-plugin 提 PR
3. 等一天左右，站点和 app 内的市场都会自动出现

在那之前别人也不是装不了，只是 market 里搜不到（它只允许装目录里列出来的源），得显式敲 `dsh plugin --profile web add <name>`。进入 DSH.SO 的「安装验证与安全审计」源需平台侧沙盒验证与安全审计通过。

## 当前状态

| 插件 | 版本 | npm | 官方目录 | 自建索引 | 远端 |
|---|---|---|---|---|---|
| `dsh-sidebar-notes` | 0.2.2 | 未发布 | 未提交 | 已收录 | GitHub + Forgejo |
| `dsh-sidebar-editor` | 0.1.0 | 未发布 | 未提交 | 已收录 | GitHub + Forgejo |
| `dsh-context-reminder` | 0.1.0 | 未发布 | 未提交 | 已收录 | GitHub + Forgejo |

三个插件统一使用 GPLv3（`GPL-3.0-or-later`），`lib/` 随仓库提交，`github:` 与 `link:` 两种安装方式都可用。
