export const meta = {
  name: 'split-ti-yong',
  description: 'Split interpretation and structural_rationale into 體/用 for each PHIL file',
  phases: [
    { title: 'Scout',  detail: 'List PHIL JSON files' },
    { title: 'Split',  detail: 'Add 體/用 fields to each file' },
  ],
}

const PHIL_DIR     = '/Users/zzhao89/Documents/Git_Code/Yijing/interpretation/working/PHIL'
const RESEARCH_DIR = '/Users/zzhao89/Documents/Git_Code/Yijing/interpretation/working/RESEARCH'
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
  const filename     = filePath.split('/').pop()           // e.g. 05_需.json
  const stem         = filename.replace('.json', '')       // e.g. 05_需
  const researchPath = `${RESEARCH_DIR}/${stem}.txt`

  return `你有兩份資料可供參考：

1. 現有的精簡版（PHIL）：
${filePath}

2. 完整研究筆記（RESEARCH）：
${researchPath}

請先讀取兩份資料。PHIL 檔有兩個欄位需要拆分：\`interpretation\` 與 \`structural_rationale\`。
拆分時以 PHIL 的現有文字為主，RESEARCH 作為補充參考——若 PHIL 的用內容因壓縮而流失，可從 RESEARCH 補回，但不得添加 PHIL 原本沒有意圖的新內容。

此檔有兩個欄位需要拆分：\`interpretation\` 與 \`structural_rationale\`。

拆分規則：
- 體（ti）：純描述性——說明此卦象徵什麼處境、意象或格局。只說「是什麼」。
- 用（yong）：其餘所有內容——凡是說應該怎麼做、應注意什麼、吉凶判斷、正確態度等，一律歸用。

操作要求：
- 這是拆分任務，不是改寫任務。盡量保留原文字句，僅在一句話橫跨兩側時才最低限度地調整斷句。
- 原文的所有實質內容必須出現在體或用之一，不得遺漏，不得添加新內容。
- 若某欄位完全沒有用的內容（例如 structural_rationale 純粹是結構描述），則對應的用欄位設為空字串 ""。

讀取檔案後，將以下欄位加入 JSON 物件的最前面（在 hexagram_number 之後，在現有的 interpretation 之前），並覆寫原檔：

{
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
}

確保輸出為有效 JSON，UTF-8 編碼，覆寫原檔。`
}

// ── Scout ─────────────────────────────────────────────────────────────────────

phase('Scout')
const scout = await agent(
  `List all .json files in ${PHIL_DIR}. Return only the full file paths as an array of strings.`,
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
