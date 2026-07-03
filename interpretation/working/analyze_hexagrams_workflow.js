export const meta = {
  name: 'analyze-hexagrams',
  description: 'Research and analyze all 64 Yijing hexagrams using sinological sources',
  phases: [
    { title: 'Scout',    detail: 'List hexagram JSON files' },
    { title: 'Research', detail: 'Verbose research per hexagram' },
    { title: 'Condense', detail: 'Extract clean skeleton from research' },
  ],
}

const JSON_DIR      = '/Users/zzhao89/Documents/Git_Code/Yijing/interpretation/working/JSON'
const RESEARCH_DIR  = '/Users/zzhao89/Documents/Git_Code/Yijing/interpretation/working/RESEARCH'
const OUT_DIR       = '/Users/zzhao89/Documents/Git_Code/Yijing/interpretation/working/PHIL'
const BATCH_SIZE    = 3

const FILES_SCHEMA = {
  type: 'object',
  required: ['hexagrams'],
  properties: {
    hexagrams: {
      type: 'array',
      items: {
        type: 'object',
        required: ['number', 'name', 'filename'],
        properties: {
          number:   { type: 'integer' },
          name:     { type: 'string' },
          filename: { type: 'string' },
        },
      },
    },
  },
}

// ── Step 1: verbose research, no file output ───────────────────────────────────

function buildResearchPrompt(hex) {
  const pad    = String(hex.number).padStart(2, '0')
  const inPath = `${JSON_DIR}/${hex.filename}`

  return `你是一位易學研究助理，任務是對《周易》第 ${hex.number} 卦：${hex.name} 進行研究。

首先，讀取此卦的原文資料檔案：
${inPath}
（此檔包含卦辭、爻辭、彖、象的原文，以及 ASCII 卦象，供你參考結構。）

然後，依以下步驟進行網路搜尋。所有輸出均以繁體中文書寫。輸出格式為純文字，不需要 JSON，盡量詳盡。

完成後，將全部研究內容寫入以下路徑（確保目錄存在，UTF-8 編碼）：
${RESEARCH_DIR}/${pad}_${hex.name}.txt


在整個過程中，嚴格避免以下內容：
- 不得引用學者姓名或說「X認為Y」——只要結論，不要出處
- 不得連結到西方哲學、心理學、宗教神秘主義、或任何易學以外的傳統
- 不得加入占卜、風水、命理等實踐性應用
- 不得發揮「這讓我想到……」式的聯想，只說此卦本身
- 不得加入歷史考證（文字源流、甲骨文、金文等），除非直接影響卦義
- 重點是：此卦代表什麼處境或狀態、結構如何支撐此義、位置與陰陽各代表什麼

第一步：確立此卦的現代易學詮釋

進行多次網路搜尋，尋找此卦在現代易學與漢學界的主流詮釋。
- 優先採用具哲學深度的現代詮釋（當代易學、新儒家哲學、當代漢學等）
- 若現代詮釋與歷史性的解讀有衝突，以現代哲學詮釋為準
- 僅在現代詮釋本身存在明顯學術爭議時，才退而參照歷史詮釋，並說明爭議所在
- 應整合至少兩至三個不同來源或學術傳統的觀點

第二步：說明結構性依據

解釋此卦的卦象結構如何支撐上述詮釋：
- 此卦的自然意象（象）是什麼？如何強化這一詮釋？
- 在單爻與整卦之間，哪一層結構對解釋此卦最重要？最常見的是上下卦的功能分工，但不一定是此卦的關鍵——也可能是特殊的陰陽排列（如全部不當位）、互卦、特定爻位的對應關係，或其他。說明對此卦最關鍵的中間結構，不要預設答案。

第三步 A：爻位意義

說明各爻位（由初至上）在此卦脈絡下代表什麼。說明力求清晰準確。

第三步 B：陰陽意義

在此卦的具體脈絡下，陰爻（斷爻）與陽爻（連爻）各代表什麼性質或狀態？
必須針對此卦，不接受通泛的陰柔陽剛說明。`
}

// ── Step 2: condense research into clean skeleton ─────────────────────────────

function buildCondensePrompt(hex) {
  const pad          = String(hex.number).padStart(2, '0')
  const researchPath = `${RESEARCH_DIR}/${pad}_${hex.name}.txt`
  const outPath      = `${OUT_DIR}/${pad}_${hex.name}.json`

  return `你的任務是將《周易》第 ${hex.number} 卦：${hex.name} 的研究資料提取為骨架。

首先讀取研究資料：
${researchPath}

然後將提取結果寫入：
${outPath}

這是一個框架提取任務，不是摘要任務。每個欄位都是一個標籤或定義，不是解釋。
想像你在為一張地圖畫圖例，不是在描述地圖上的風景。

欄位要求（嚴格遵守）：

interpretation：
  最多兩句話。說明此卦「是什麼類型的處境或狀態」。
  不得：引用學者、提及歷史、解釋推導過程、說「X認為Y」。
  只要：結論本身。

structural_rationale：
  最多兩句話。說明上下卦各象徵什麼，二者組合如何產生卦義。
  格式示例：「下卦為震（動），上卦為坎（險）；動於險中，象徵在危局中強行推進。」
  不得超出此句式範疇。

line_position_key：
  分組由結構直接決定——從你在 structural_rationale 中識別出的中間結構直接讀出，不要重新思考。
  若關鍵結構是上下卦分工，則分兩組（lines 1-3 / 4-6）。若是其他結構（如 2,2,2 或其他），則按該結構分組。
  每組給出 lines（整數陣列，1=初爻，6=上爻）與 meaning（5至20字的短語），說明該組爻位在此卦中代表什麼角色或維度。
  不得：引用爻辭、說明個別爻的吉凶、描述性的長句。
  只要：抽象角色定義。

yin_yang_key：
  yang 與 yin 各為一個短語（5至20字），說明在此卦中陽爻與陰爻各象徵什麼。
  不得：以個別爻的行為來定義、說「陽代表剛健陰代表柔順」這類通泛答案。
  只要：在此卦主題下，陰與陽各自對應的具體性質或狀態。

輸出 JSON（確保目錄存在後寫入，UTF-8 編碼）：
{
  "hexagram_number": ${hex.number},
  "hexagram_name": "${hex.name}",
  "interpretation": "...",
  "structural_rationale": "...",
  "line_position_key": [
    { "lines": [整數陣列], "meaning": "此組爻位的抽象角色（短語）" }
  ],
  "yin_yang_key": {
    "yang": "陽爻在此卦的具體象徵（短語）",
    "yin":  "陰爻在此卦的具體象徵（短語）"
  }
}

`
}

// ── Scout ─────────────────────────────────────────────────────────────────────

phase('Scout')
const scout = await agent(
  `List all .json files in the directory: ${JSON_DIR}
Return each file as structured data: number (integer parsed from the NN_ prefix), name (Chinese characters between _ and .json), filename (full filename including .json).`,
  { schema: FILES_SCHEMA }
)
log(`找到 ${scout.hexagrams.length} 卦`)

// ── File-existence check (makes every stage idempotent) ───────────────────────

const FILE_CHECK_SCHEMA = {
  type: 'object',
  required: ['exists'],
  properties: { exists: { type: 'boolean' } },
}

async function fileExists(path) {
  const r = await agent(
    `Does the file "${path}" exist on disk? Answer with exists: true or false.`,
    { schema: FILE_CHECK_SCHEMA, label: `check: ${path.split('/').pop()}`, effort: 'low' }
  )
  return r && r.exists
}

// ── Research → Condense pipeline ──────────────────────────────────────────────

const allHexagrams = scout.hexagrams.slice().sort((a, b) => a.number - b.number)

// Skip hexagrams whose PHIL output already exists — file check is cheap (Sonnet low-effort)
phase('Scout')
const needsWork = (await Promise.all(
  allHexagrams.map(async hex => {
    const pad      = String(hex.number).padStart(2, '0')
    const philPath = `${OUT_DIR}/${pad}_${hex.name}.json`
    const done     = await fileExists(philPath)
    if (done) log(`跳過 ${pad} ${hex.name}（已完成）`)
    return done ? null : hex
  })
)).filter(Boolean)

log(`需要處理 ${needsWork.length} / ${allHexagrams.length} 卦`)

const batches = []
for (let i = 0; i < needsWork.length; i += BATCH_SIZE) {
  batches.push(needsWork.slice(i, i + BATCH_SIZE))
}

let done = 0
for (const batch of batches) {
  if (budget.total && budget.remaining() < 80000) {
    log(`預算不足（剩餘 ${Math.round(budget.remaining() / 1000)}k tokens），已完成 ${done} 卦。重新執行 workflow 即可繼續（已完成的卦會自動跳過）。`)
    break
  }

  phase('Research')
  await pipeline(
    batch,
    async hex => {
      const pad          = String(hex.number).padStart(2, '0')
      const researchPath = `${RESEARCH_DIR}/${pad}_${hex.name}.txt`
      if (await fileExists(researchPath)) {
        log(`研究已存在，跳過 ${pad} ${hex.name}`)
        return hex  // pass hex through so condense can still run
      }
      return agent(buildResearchPrompt(hex), {
        label:  `research: ${pad} ${hex.name}`,
        model:  'claude-opus-4-8',
        effort: 'high',
      })
    },
    (_, hex) => agent(buildCondensePrompt(hex), {
      label:  `condense: ${String(hex.number).padStart(2, '0')} ${hex.name}`,
      model:  'claude-opus-4-8',
      effort: 'medium',
    })
  )

  done += batch.length
  log(`${done} / ${needsWork.length} 卦完成`)
}
