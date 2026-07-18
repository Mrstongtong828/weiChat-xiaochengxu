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

const assetExtensions = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'])

function getStaticAssetSources() {
	const staticDir = path.resolve(__dirname, 'static')
	if (!fs.existsSync(staticDir)) return []
	return fs.readdirSync(staticDir)
		.filter((name) => assetExtensions.has(path.extname(name).toLowerCase()))
}

function escapeRegex(text) {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function readBuiltAssetMappings(outDir) {
	const assetsManifestPath = path.resolve(__dirname, outDir, 'common', 'assets.js')
	if (!fs.existsSync(assetsManifestPath)) return {}
	const content = fs.readFileSync(assetsManifestPath, 'utf8')
	const mappings = {}

	getStaticAssetSources().forEach((sourceName) => {
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

function copyDirectoryFiles(sourceDir, targetDir) {
	if (!fs.existsSync(sourceDir)) return
	fs.mkdirSync(targetDir, { recursive: true })
	fs.readdirSync(sourceDir, { withFileTypes: true }).forEach((entry) => {
		const sourcePath = path.join(sourceDir, entry.name)
		const targetPath = path.join(targetDir, entry.name)
		if (entry.isDirectory()) {
			copyDirectoryFiles(sourcePath, targetPath)
		} else {
			fs.copyFileSync(sourcePath, targetPath)
		}
	})
}

function copyMiniappAssets() {
	const outDir = process.env.UNI_OUTPUT_DIR || path.join('unpackage', 'dist', 'build', 'mp-weixin')
	const outputRoot = path.resolve(__dirname, outDir)
	const assetsDir = path.join(outputRoot, 'assets')
	fs.mkdirSync(assetsDir, { recursive: true })
	const builtAssetMappings = readBuiltAssetMappings(outDir)
	const staticDir = path.resolve(__dirname, 'static')

	getStaticAssetSources().forEach((sourceName) => {
		const outputName = builtAssetMappings[sourceName]
		const sourcePath = path.resolve(__dirname, 'static', sourceName)
		if (outputName && fs.existsSync(sourcePath)) {
			fs.copyFileSync(sourcePath, path.join(assetsDir, outputName))
		}
	})

	copyDirectoryFiles(staticDir, path.join(outputRoot, 'static'))
}

function keepMiniappRuntimeFiles() {
	const syncRuntimeFiles = () => {
		copyMiniappAssets()
	}

	return {
		name: 'keep-miniapp-runtime-files',
		writeBundle() {
			syncRuntimeFiles()
		},
		closeBundle() {
			syncRuntimeFiles()
		}
	}
}

module.exports = {
	plugins: [uni(), keepMiniappRuntimeFiles()]
}
