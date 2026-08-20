export const formatOrderAttachments = (items = []) => items
  .map((item, index) => {
    const attachments = [
      ...(item.voucher_urls || []).map(url => `购买凭证: ${url}`),
      ...(item.image_urls || []).map(url => `故障图片: ${url}`),
      ...(item.video_urls || []).map(url => `故障视频: ${url}`),
      ...(item.media_urls || []).map(url => `历史附件: ${url}`)
    ]
    return attachments.length ? `产品${index + 1}\n${attachments.join('\n')}` : ''
  })
  .filter(Boolean)
  .join('\n')
