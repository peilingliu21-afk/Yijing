# Yijing

Tools for I-Ching (周易) study. Approached as philosophy, not divination mysticism.

## 目录与使用

```text
site/                          网站；可直接双击 HTML 打开
  casting.html                 蓍草起卦页面
  reading.html                 六十四卦阅读页面
  data/
    text/                      64 卦原文数据（原 TEXT）
    phil/                      64 卦解释数据（原 PHIL）
materials/                     网站生成过程中的参考资料
  sources/ops/                 原始 XHTML 文献（原 OPS）
  research/                    64 卦完整研究笔记（原 RESEARCH）
scripts/
  parse_hexagrams.py           原始文献 → 网站原文数据
  requirements.txt            Python 解析脚本依赖
  workflows/                   AI 研究、提炼和体用拆分工作流
prompts/
  next_prompt.txt              后续字义分析与翻译任务草稿
notebooks/
  casting.ipynb                起卦算法实验（依赖 NumPy）
```

打开 `site/casting.html` 使用起卦页面，打开 `site/reading.html` 阅读卦义。网站无须安装依赖或构建；发布静态网站时可将 `site/` 作为发布目录，并指定页面入口。

### 更新资料

在仓库根目录执行以下命令，重新从原始 XHTML 提取原文（会覆盖 `site/data/text/` 中对应的文件）：

```sh
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install -r scripts/requirements.txt
python3 scripts/parse_hexagrams.py
```

Python 脚本根据自身位置定位仓库，从其他工作目录运行也可使用。

两个 AI 工作流位于 `scripts/workflows/`，研究和提炼 prompt 保留在相应脚本的 `build*Prompt` 函数中，便于与流程一起维护。它们需要提供 `agent`、`phase`、`log` 等接口的原有工作流运行器，不能直接作为普通 Node.js 脚本执行；仓库目前不包含该运行器的安装说明。请将运行器的工作目录设为仓库根目录，或在运行器中将 `globalThis.YIJING_ROOT` 设置为仓库的绝对路径。运行器还需支持脚本中指定的模型。

资料流程：`materials/sources/ops/` → `site/data/text/` → `materials/research/` → `site/data/phil/`。体用拆分工作流会直接更新 `site/data/phil/`，已经完成的文件会跳过。`prompts/next_prompt.txt` 仅是后续任务草稿，尚未接入工作流。

以下保留数据格式与页面功能说明。TEXT、PHIL、RESEARCH、OPS 是旧目录名称，分别对应上面的四类资料。

## Interpretation

Source text and analysis are processed in four stages:

| Directory | Contents | How produced |
|-----------|----------|--------------|
| `materials/sources/ops/` | Raw XHTML files from a Wikisource EPUB, one per hexagram plus the Ten Wings | Downloaded source |
| `site/data/text/` | Structured source text: hexagram number, name, ASCII art, 卦辭, 爻辭, 彖, 象 | `parse_hexagrams.py` — re-runnable |
| `materials/research/` | Verbose research notes per hexagram: modern sinological interpretation, structural logic, line positions, yin/yang meaning | `analyze_hexagrams_workflow.js` stage 1 (Opus, web search) |
| `site/data/phil/` | Clean interpretive skeleton per hexagram; each file contains both the original fields and the 體/用 split described below | `analyze_hexagrams_workflow.js` stage 2 (condensed from RESEARCH), then `split_ti_yong_workflow.js` |

Files in `site/data/text/` and `site/data/phil/` are `.js`, not `.json`: each one is a call to `HEX(kind, { ... })` wrapping the same object literal a `.json` file would hold. `reading.html` (below) loads them as `<script>` tags rather than fetching them as data, so it works straight off `file://` — no server, no build step. The object literal is still plain JSON internally; only the `HEX('text', ...)` / `HEX('phil', ...)` wrapper is new.

`analyze_hexagrams_workflow.js` is idempotent — re-running it skips hexagrams whose output files already exist, so partial runs continue automatically.

### 體/用 split

Each PHIL file separates descriptive content (體, tǐ — what the situation *is*) from prescriptive content (用, yòng — what to do, what to watch for, auspiciousness judgements). The split is applied in-place by `split_ti_yong_workflow.js`, which adds four fields before the original ones:

| Field | Content |
|-------|---------|
| `interpretation_ti` | Purely descriptive: what type of situation or state this hexagram names |
| `interpretation_yong` | Prescriptive: correct attitude, action direction, what to avoid |
| `structural_rationale_ti` | Which structural features of the hexagram produce the situation |
| `structural_rationale_yong` | What the structure implies one should or should not do (empty string if none) |

The original `interpretation` and `structural_rationale` fields are kept as legacy. The workflow is idempotent — files that already contain `interpretation_ti` are skipped.

## Reading

`site/reading.html` — a browser for all 64 hexagrams, in the same visual style as the casting app. Just open the file directly (double-click, or `open reading.html`) — no server, no build step.

It reads `site/data/text/` and `site/data/phil/` directly, with no copied/generated data: the page has a fixed list of 128 `<script src="data/text/...">` / `<script src="data/phil/...">` tags, and each file registers its own contents by calling `HEX(kind, {...})` when it loads. Editing a `site/data/text/` or `site/data/phil/` file and reloading the page shows the change immediately — the two folders *are* the data, not a source that gets copied somewhere else.

Two navigation blocks sit above the reader:

- **卦序** — the standard 1–64 sequence, as a row of glyphs.
- **上下卦表** — the same 64 hexagrams arranged in an 8×8 table by upper/lower trigram (rows = upper trigram, columns = lower trigram, axes labeled with the trigram symbols ☰☱☲☳☴☵☶☷). This grouping is computed directly from each hexagram's own line pattern, not from a separate lookup table.

Click any glyph in either block, use the 前卦/後卦 buttons, arrow keys, or a `#n` URL hash (e.g. `reading.html#5`) to navigate.

Each hexagram page shows the ASCII hexagram, the classical text (卦辭, 彖, 大象, 爻辭 with paired 小象, and 文言 for hexagrams 1–2), followed by the PHIL skeleton: 卦義 and 結構 split into 體/用, the 爻位 groups (hovering a group highlights the corresponding lines in the hexagram), and the 陰陽 key.

## Casting

`site/casting.html` — a self-contained single-file web app implementing the traditional yarrow-stalk method (大衍筮法). Open it in any browser; no server or dependencies required.

The method uses 50 stalks. One is set aside permanently (太極). The remaining 49 are divided and manipulated across three rounds to produce one line. Six lines make a hexagram.

### Algorithm

Each of the three rounds per line:

1. **太極** (taiji, round 1 only) — click any one stalk to remove it from play.
2. **分策爲二** (split) — click a gap in each row to divide all stalks into a yang pile (left) and yin pile (right). Splits that would leave either pile empty are rejected.
3. **掛一** (ren) — click one stalk from either pile to set aside as the "human" count.
4. The remainder of each pile passes through mod₄: `(n−1) mod 4 + 1`, giving values in {1,2,3,4}. These two remainders plus the 人 stalk are set aside. The remaining stalks carry forward to the next round.

After three rounds the set-aside counts sum to one of {13, 17, 21, 25}:

| Sum | Name | Line | Symbol |
|-----|------|------|--------|
| 25 | 老陽 九 | solid, moving | `#########` |
| 21 | 少陰 八 | broken, stable | `===   ===` |
| 17 | 少陽 七 | solid, stable | `=========` |
| 13 | 老陰 六 | broken, moving | `###   ###` |

This repeats six times to build the hexagram bottom-up.

### Interface

The left column shows the hexagram as it builds — a 13-row block, top half 本卦 (present hexagram), bottom half 變卦 (transformed hexagram, where moving lines flip). The right column is the stalk workspace.

- **列數** — adjusts how many rows the stalks are distributed across (default 5, range 1–10). Takes effect immediately if you haven't started a line yet.
- **重置** — restart from the beginning, keeping the current row count.
- **確認** — confirm the current step and advance.

The log below records each round in the format:
```
陽23陰08　掛一自陰　天閏3地閏4　取8　餘41
          三變17　少陽七
```

### Moving lines and 變卦

Lines marked 老陽 or 老陰 are "moving" — they transform in the second hexagram: 老陽 becomes 少陰, 老陰 becomes 少陽. The bottom half of the left block shows this transformed hexagram once all six lines are cast. If no lines are moving, 本卦 and 變卦 are identical.
