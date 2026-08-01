export async function downloadCloudFileWithClient({ cloudClient, fileID, downloadFile }) {
	const value = String(fileID || '').trim()
	if (!value) throw new Error('云文件地址为空')
	if (!cloudClient) throw new Error('云服务未初始化')

	if (typeof cloudClient.downloadFile === 'function') {
		return cloudClient.downloadFile({ fileID: value })
	}

	if (typeof cloudClient.getTempFileURL !== 'function') {
		throw new Error('当前云服务不支持文件下载')
	}
	if (typeof downloadFile !== 'function') {
		throw new Error('当前运行环境不支持文件下载')
	}

	const tempResult = await cloudClient.getTempFileURL({ fileList: [value] })
	const item = tempResult && Array.isArray(tempResult.fileList) && tempResult.fileList[0]
	const url = item && (item.tempFileURL || item.url)
	if (!url) throw new Error('云文件临时地址解析失败')

	const result = await downloadFile({ url })
	if (result && result.statusCode && Number(result.statusCode) !== 200) {
		throw new Error(`文档下载失败（HTTP ${result.statusCode}）`)
	}
	return result
}
