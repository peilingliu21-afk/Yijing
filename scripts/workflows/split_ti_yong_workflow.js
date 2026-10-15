export const meta = {
  name: 'split-ti-yong',
  description: 'Split interpretation and structural_rationale into 體/用 for each PHIL file',
  phases: [
    { title: 'Scout',  detail: 'List PHIL JSON files' },
    { title: 'Split',  detail: 'Add 體/用 fields to each file' },
  ],
}

// Run with the repository root as the working directory, or provide an absolute root.
const ROOT_DIR = globalThis.YIJING_ROOT ?? '.'

const PHIL_DIR     = `${ROOT_DIR}/site/data/phil`
const RESEARCH_DIR = `${ROOT_DIR}/materials/research`
const BATCH_SIZE   = 8

const FILES_SCHEMA = {
  type: 'object',
  required: ['files'],
  properties: {
    files: {
      type: 'array',
      items: { type: 'string' },
    },
  },
}

function buildSplitPrompt(filePath) {
  const filename     = filePath.split('/').pop()           // e.g. 05_需.js
  const stem         = filename.replace('.js', '')         // e.g. 05_需
  const researchPath = `${RESEARCH_DIR}/${stem}.txt`

  return `你有兩份資料可供參考：

1. 現有的精簡版（PHIL）：
${filePath}

2. 完整研究筆記（RESEARCH）：
${researchPath}

PHIL 檔的內容格式是 \`HEX('phil', { ... });\`——一個呼叫 HEX() 函式的 JS 陳述式，括號內是物件字面量。這是為了讓網頁能以 <script> 標籤直接載入而不需要伺服器；除了拆分下述兩個欄位以外，不要更動這層包裝。

請先讀取兩份資料。PHIL 檔有兩個欄位需要拆分：\`interpretation\` 與 \`structural_rationale\`。
拆分時以 PHIL 的現有文字為主，RESEARCH 作為補充參考——若 PHIL 的用內容因壓縮而流失，可從 RESEARCH 補回，但不得添加 PHIL 原本沒有意圖的新內容。

拆分規則：
- 體（ti）：純描述性——說明此卦象徵什麼處境、意象或格局。只說「是什麼」。
- 用（yong）：凡是說應該怎麼做、應注意什麼、吉凶判斷、正確態度、行動方向等，一律歸用。

判斷標準：含有「故不可」「須」「應」「宜」「忌」「待」「才能」「方可」「不得」等字眼的子句，幾乎必然是用，即使它嵌在同一個長句中。

操作要求：
- 這是拆分任務，不是改寫任務。盡量保留原文字句。
- 允許在句中切分：若一個長句前半是體、後半是用，可在語義邊界（如「故」「因此」「，」）處截斷，前半入體、後半入用。不需要整句或整段才能切分。
- 原文的所有實質內容必須出現在體或用之一，不得遺漏，不得添加新內容。
- 若某欄位確實完全沒有用的內容，對應的用欄位設為空字串 ""。但請認真審視每句話——prescriptive 子句常嵌於描述句末。

讀取檔案後，將以下欄位加入物件字面量的最前面（在 hexagram_number 之後，在現有的 interpretation 之前），保留 \`HEX('phil', ... );\` 包裝，並覆寫原檔：

HEX('phil', {
  "hexagram_number": (原值),
  "hexagram_name": (原值),
  "interpretation_ti": "體的部分",
  "interpretation_yong": "用的部分",
  "structural_rationale_ti": "體的部分",
  "structural_rationale_yong": "用的部分（如無則為空字串）",
  "interpretation": (原值，保留),
  "structural_rationale": (原值，保留),
  "line_position_key": (原值，保留),
  "yin_yang_key": (原值，保留)
});

確保物件部分為有效 JSON、整體為有效 JS 陳述式，UTF-8 編碼，覆寫原檔。`
}

// ── Scout ─────────────────────────────────────────────────────────────────────

phase('Scout')
const scout = await agent(
  `List all .js files in ${PHIL_DIR}. Return only the full file paths as an array of strings.`,
  { schema: FILES_SCHEMA }
)
log(`找到 ${scout.files.length} 個檔案`)

// ── Split (skip files already processed) ─────────────────────────────────────

const DONE_CHECK_SCHEMA = {
  type: 'object',
  required: ['already_split'],
  properties: { already_split: { type: 'boolean' } },
}

phase('Split')
const batches = []
for (let i = 0; i < scout.files.length; i += BATCH_SIZE) {
  batches.push(scout.files.slice(i, i + BATCH_SIZE))
}

let done = 0
for (const batch of batches) {
  await parallel(batch.map(filePath => async () => {
    const check = await agent(
      `Read the file ${filePath}. Does it already contain a field called "interpretation_ti"? Answer already_split: true or false.`,
      { schema: DONE_CHECK_SCHEMA, effort: 'low' }
    )
    if (check && check.already_split) {
      log(`跳過 ${filePath.split('/').pop()}（已處理）`)
      return
    }
    return agent(buildSplitPrompt(filePath), {
      label:  `split: ${filePath.split('/').pop()}`,
      effort: 'medium',
    })
  }))
  done += batch.length
  log(`${done} / ${scout.files.length} 完成`)
}
