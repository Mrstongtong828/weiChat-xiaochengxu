import sharp from 'sharp'
import fs from 'fs'
import path from 'path'

// 无损/近无损重编码：JPEG 走 mozjpeg q78，PNG 走调色板量化。
// 保持原始像素尺寸（避免高分屏发虚），仅在体积确实变小时才覆盖。
// 原图已提交 git，可随时 revert。
const dir = 'static'
const files = fs.readdirSync(dir).filter(f => /\.(png|jpe?g)$/i.test(f))
let before = 0
let after = 0
for (const f of files) {
  const p = path.join(dir, f)
  const orig = fs.readFileSync(p)
  before += orig.length
  let out
  try {
    const img = sharp(orig)
    if (/\.png$/i.test(f)) {
      out = await img.png({ palette: true, quality: 82, effort: 10 }).toBuffer()
    } else {
      out = await img.jpeg({ quality: 78, mozjpeg: true }).toBuffer()
    }
  } catch (e) {
    console.log(`skip ${f}: ${e.message}`)
    after += orig.length
    continue
  }
  if (out.length < orig.length) {
    fs.writeFileSync(p, out)
    after += out.length
    console.log(`${(orig.length / 1024).toFixed(1)}K -> ${(out.length / 1024).toFixed(1)}K  (-${(100 - out.length / orig.length * 100).toFixed(0)}%)  ${f}`)
  } else {
    after += orig.length
    console.log(`keep  ${(orig.length / 1024).toFixed(1)}K  (no gain)  ${f}`)
  }
}
console.log(`\nstatic total: ${(before / 1024).toFixed(0)}K -> ${(after / 1024).toFixed(0)}K  saved ${((before - after) / 1024).toFixed(0)}K`)
