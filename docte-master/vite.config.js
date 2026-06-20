const path = require('path')
const fs = require('fs')

function loadLocalUniCloudSpaces() {
	if (process.env.UNI_CLOUD_PROVIDER || process.env.UNI_CLOUD_SPACES) {
		return
	}

	const localSpacesPath = path.resolve(__dirname, 'unicloud.spaces.local.json')
	if (!fs.existsSync(localSpacesPath)) {
		return
	}

	const rawSpaces = JSON.parse(fs.readFileSync(localSpacesPath, 'utf8').replace(/^\uFEFF/, ''))
	const spaces = Array.isArray(rawSpaces) ? rawSpaces : [rawSpaces]
	process.env.UNI_CLOUD_SPACES = JSON.stringify(spaces)
}

function resolveUniPlugin() {
	const hBuilderPluginsRoot =
		process.env.UNI_HBUILDERX_PLUGINS ||
		(process.env.HX_APP_ROOT
			? path.join(process.env.HX_APP_ROOT, 'plugins')
			: '')

	if (hBuilderPluginsRoot) {
		const hBuilderUniPluginPath = path.join(
			hBuilderPluginsRoot,
			'uniapp-cli-vite',
			'node_modules',
			'@dcloudio',
			'vite-plugin-uni'
		)

		return require(hBuilderUniPluginPath).default
	}

	return require('@dcloudio/vite-plugin-uni').default
}

loadLocalUniCloudSpaces()
const uni = resolveUniPlugin()

const assetCopies = [
	['brand-cicada-tooth-blue.png', 'brand-cicada-tooth-blue.e5ad1cd6.png'],
	['brand-cicada-tooth-blue-original.png', 'brand-cicada-tooth-blue-original.9fbcc731.png'],
	['default-user-avatar.png', 'default-user-avatar.77e1bac2.png'],
	['logo-banner.jpg', 'logo-banner.915b9c74.jpg'],
	['logo-cicada-full.jpg', 'logo-cicada-full.bc8283ed.jpg'],
	['logo-cicada-mark.jpg', 'logo-cicada-mark.eed3d60f.jpg'],
	['new-logo.png', 'new-logo.33fff49f.png'],
	['photo-building.jpg', 'photo-building.98b16d4b.jpg'],
	['photo-factory.jpg', 'photo-factory.74afac67.jpg'],
	['qr-wechat.jpg', 'qr-wechat.19f52a60.jpg'],
	['survey-poster.png', 'survey-poster.7a31971d.png'],
	['survey-qr-wechat.jpg', 'survey-qr-wechat.d11c53e6.jpg']
]

function copyMiniappAssets() {
	const outDir = process.env.UNI_OUTPUT_DIR || path.join('unpackage', 'dist', 'build', 'mp-weixin')
	const assetsDir = path.resolve(__dirname, outDir, 'assets')
	fs.mkdirSync(assetsDir, { recursive: true })

	assetCopies.forEach(([sourceName, outputName]) => {
		const sourcePath = path.resolve(__dirname, 'static', sourceName)
		if (fs.existsSync(sourcePath)) {
			fs.copyFileSync(sourcePath, path.join(assetsDir, outputName))
		}
	})
}

function keepMiniappAssets() {
	return {
		name: 'keep-miniapp-assets',
		closeBundle() {
			copyMiniappAssets()
		}
	}
}

module.exports = {
	plugins: [uni(), keepMiniappAssets()]
}
