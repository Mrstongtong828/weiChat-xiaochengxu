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
	const staticDir = path.resolve(__dirname, 'static')

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
