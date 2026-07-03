# Yijing

Tools for I-Ching (周易) study. Approached as philosophy, not divination mysticism.

## Structure

```
casting/        yarrow-stalk casting app (casting.html)
interpretation/ working notes on hexagram meanings
```

## Interpretation

Source text and analysis live under `interpretation/working/`, processed in four stages:

| Directory | Contents | How produced |
|-----------|----------|--------------|
| `OPS/` | Raw XHTML files from a Wikisource EPUB, one per hexagram plus the Ten Wings | Downloaded source |
| `JSON/` | Structured source text: hexagram number, name, ASCII art, 卦辭, 爻辭, 彖, 象 | `parse_hexagrams.py` — re-runnable |
| `RESEARCH/` | Verbose research notes per hexagram: modern sinological interpretation, structural logic, line positions, yin/yang meaning | `analyze_hexagrams_workflow.js` stage 1 (Opus, web search) |
| `PHIL/` | Clean interpretive skeleton per hexagram; each file contains both the original fields and the 體/用 split described below | `analyze_hexagrams_workflow.js` stage 2 (condensed from RESEARCH), then `split_ti_yong_workflow.js` |

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

## Casting

`casting/casting.html` — a self-contained single-file web app implementing the traditional yarrow-stalk method (大衍筮法). Open it in any browser; no server or dependencies required.

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
