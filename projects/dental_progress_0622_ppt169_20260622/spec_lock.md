# Execution Lock

## canvas
- viewBox: 0 0 1280 720
- format: PPT 16:9

## mode
- mode: briefing

## visual_style
- visual_style: swiss-minimal

## colors
- bg: #FFFFFF
- surface: #F4F7FB
- primary: #1565C0
- accent: #0D3B66
- secondary_accent: #5B8DD9
- text: #1A2230
- text_secondary: #5A6675
- text_tertiary: #93A0B0
- border: #D7DEE7
- grid: #E5EAF0
- success: #2E7D32
- caution: #B7791F
- warning: #D32F2F
- warning_bg: #FBE9EA
- on_primary: #D6E4F5

## typography
- font_family: "Microsoft YaHei", "PingFang SC", Arial, sans-serif
- title_family: SimHei, "Microsoft YaHei", Arial, sans-serif
- emphasis_family: SimHei, "Microsoft YaHei", Arial, sans-serif
- code_family: Consolas, "Courier New", monospace
- body: 18
- title: 32
- subtitle: 24
- annotation: 14
- hero_number: 56

## icons
- library: tabler-outline
- stroke_width: 2
- inventory: code, cloud, server, gauge, alert-triangle, shield, calendar, users, credit-card, bell, database, clipboard-check, circle-check

## page_rhythm
- P01: anchor
- P02: dense
- P03: dense
- P04: breathing
- P05: dense
- P06: dense
- P07: anchor
- P08: breathing
- P09: dense
- P10: dense
- P11: dense
- P12: breathing

## forbidden
- Mixing icon libraries
- rgba()
- `<style>`, `class`, `<foreignObject>`, `textPath`, `@font-face`, `<animate*>`, `<script>`, `<iframe>`, `<symbol>`+`<use>`
- `<g opacity>` (set opacity on each child element individually)
- HTML named entities in text — write as raw Unicode; XML reserved chars `& < > " '` escaped as `&amp; &lt; &gt; &quot; &apos;`
