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

const assetSources = [
	'brand-cicada-tooth-blue.png',
	'brand-cicada-tooth-blue-original.png',
	'default-user-avatar.png',
	'login-auth-bg.jpg',
	'logo-banner.jpg',
	'logo-cicada-full.jpg',
	'logo-cicada-mark.jpg',
	'new-logo.png',
	'photo-building.jpg',
	'photo-factory.jpg',
	'qr-wechat.jpg',
	'survey-poster.jpg',
	'survey-qr-wechat.jpg'
]

function escapeRegex(text) {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function readBuiltAssetMappings(outDir) {
	const assetsManifestPath = path.resolve(__dirname, outDir, 'common', 'assets.js')
	if (!fs.existsSync(assetsManifestPath)) return {}
	const content = fs.readFileSync(assetsManifestPath, 'utf8')
	const mappings = {}

	assetSources.forEach((sourceName) => {
		const ext = path.extname(sourceName)
		const base = path.basename(sourceName, ext)
		const pattern = new RegExp(`/assets/${escapeRegex(base)}\\.([a-z0-9]+)${escapeRegex(ext)}`, 'i')
		const match = content.match(pattern)
		if (match) {
			mappings[sourceName] = `${base}.${match[1]}${ext}`
		}
	})

	return mappings
}

function copyMiniappAssets() {
	const outDir = process.env.UNI_OUTPUT_DIR || path.join('unpackage', 'dist', 'build', 'mp-weixin')
	if (outDir.includes(`${path.sep}dev${path.sep}`) || outDir.includes('/dev/')) {
		return
	}

	const assetsDir = path.resolve(__dirname, outDir, 'assets')
	fs.mkdirSync(assetsDir, { recursive: true })
	const builtAssetMappings = readBuiltAssetMappings(outDir)

	assetSources.forEach((sourceName) => {
		const outputName = builtAssetMappings[sourceName]
		if (!outputName) return
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
