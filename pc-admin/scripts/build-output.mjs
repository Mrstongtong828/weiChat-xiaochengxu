import { mkdir, readdir, rm, stat } from 'node:fs/promises'

export const cleanBuildOutput = async (outputPath) => {
  await rm(outputPath, { recursive: true, force: true })
  await mkdir(outputPath, { recursive: true })
}

export const collectBuildStats = async (outputPath) => {
  let fileCount = 0
  let totalBytes = 0
  const visit = async (dir) => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = `${dir}/${entry.name}`
      if (entry.isDirectory()) await visit(path)
      else {
        fileCount += 1
        totalBytes += (await stat(path)).size
      }
    }
  }
  await visit(outputPath)
  return { fileCount, totalBytes }
}

export const assertBuildBudget = (stats, budget = {}) => {
  const maxFiles = budget.maxFiles ?? 120
  const maxBytes = budget.maxBytes ?? 12 * 1024 * 1024
  if (stats.fileCount > maxFiles) throw new Error(`构建文件数量 ${stats.fileCount} 超过上限 ${maxFiles}`)
  if (stats.totalBytes > maxBytes) {
    throw new Error(`构建体积 ${(stats.totalBytes / 1024 / 1024).toFixed(2)}MB 超过上限 ${(maxBytes / 1024 / 1024).toFixed(2)}MB`)
  }
  return stats
}

export const assertNoEagerHeavyPreloads = (html) => {
  const preloadTags = String(html).match(/<link\b[^>]*rel=["']modulepreload["'][^>]*>/gi) || []
  const forbidden = ['vendor-editor', 'vendor-excel', 'jspdf', 'exceljs', 'docx-preview', 'html2canvas']
  const offender = preloadTags.find(tag => forbidden.some(name => tag.includes(name)))
  if (offender) throw new Error(`不应在首屏预加载重型模块：${offender}`)
  return true
}
