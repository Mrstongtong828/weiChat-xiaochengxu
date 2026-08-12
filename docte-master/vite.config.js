const path = require('path')
const fs = require('fs')
const sharp = require('sharp')
const esbuild = require('esbuild')

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
	'cicada-boot-logo-white.png',
	'cicada-logo-compact.png',
	'cicada-logo-header.png',
	'cicada-wordmark.png',
	'cicada-wordmark-registered.png',
	'cicada-wordmark-registered-white.png',
	'cicada-wordmark-white.png',
	'company-intro-header-v2.jpg',
	'company-product-black.jpg',
	'company-product-light.jpg',
	'company-product-multi-view.jpg',
	'default-user-avatar.png',
	'home-top-background.jpg',
	'login-auth-bg.jpg',
	'logo-banner.jpg',
	'logo-cicada-full.jpg',
	'logo-cicada-mark.jpg',
	'maintenance-w201l-cover.jpg',
	'new-logo.png',
	'photo-building.jpg',
	'photo-factory.jpg',
	'product-implant.jpg',
	'product-prevention.jpg',
	'product-restoration.jpg',
	'product-root-canal.jpg',
	'product-video-link-qr.png',
	'qr-wechat.jpg',
	'survey-poster.jpg',
	'survey-qr-wechat.jpg'
]

const miniappPhotoAssets = new Set([
	'company-intro-header-v2.jpg',
	'company-product-black.jpg',
	'company-product-light.jpg',
	'company-product-multi-view.jpg',
	'home-top-background.jpg',
	'login-auth-bg.jpg',
	'maintenance-w201l-cover.jpg',
	'photo-building.jpg',
	'photo-factory.jpg',
	'product-implant.jpg',
	'product-prevention.jpg',
	'product-restoration.jpg',
	'product-root-canal.jpg'
])

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

async function writeMiniappAsset(sourcePath, outputPath) {
	const metadata = await sharp(sourcePath).metadata()
	const longestEdge = Math.max(metadata.width || 0, metadata.height || 0)

	if (metadata.format === 'jpeg' && miniappPhotoAssets.has(path.basename(sourcePath))) {
		await sharp(sourcePath)
			.rotate()
			.resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true })
			.jpeg({ quality: 75, mozjpeg: true })
			.toFile(outputPath)
		return
	}

	if (metadata.format === 'jpeg' && longestEdge > 1440) {
		await sharp(sourcePath)
			.rotate()
			.resize({ width: 1440, height: 1440, fit: 'inside', withoutEnlargement: true })
			.jpeg({ quality: 82, mozjpeg: true })
			.toFile(outputPath)
		return
	}

	fs.copyFileSync(sourcePath, outputPath)
}

async function minifyMiniappJavaScript(outDir) {
	const outputRoot = path.resolve(__dirname, outDir)
	const pendingDirectories = [outputRoot]
	const files = []

	while (pendingDirectories.length) {
		const directory = pendingDirectories.pop()
		fs.readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
			const entryPath = path.join(directory, entry.name)
			if (entry.isDirectory()) {
				pendingDirectories.push(entryPath)
				return
			}
			if (!entry.isFile() || path.extname(entry.name) !== '.js') return

			const relativePath = path.relative(outputRoot, entryPath).split(path.sep).join('/')
			if (relativePath !== 'app.js') files.push(entryPath)
		})
	}

	await Promise.all(files.map(async (file) => {
		const source = fs.readFileSync(file, 'utf8')
		const result = await esbuild.transform(source, {
			loader: 'js',
			minify: true,
			target: 'es2018'
		})
		fs.writeFileSync(file, result.code)
	}))
}

function removeUnreferencedStaticAssets(outDir) {
	const outputRoot = path.resolve(__dirname, outDir)
	const staticDir = path.resolve(__dirname, outDir, 'static')
	if (!fs.existsSync(staticDir)) return

	const referenceExtensions = new Set(['.js', '.json', '.wxml', '.wxs', '.wxss'])
	const references = []
	const pendingDirectories = [outputRoot]

	while (pendingDirectories.length) {
		const directory = pendingDirectories.pop()
		fs.readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
			const entryPath = path.join(directory, entry.name)
			if (entry.isDirectory()) {
				// 不扫描 static/ 自身，避免 static 内部引用互相“保活”未使用图片
				if (entryPath !== staticDir) pendingDirectories.push(entryPath)
				return
			}
			if (referenceExtensions.has(path.extname(entry.name))) {
				references.push(fs.readFileSync(entryPath, 'utf8'))
			}
		})
	}

	const compiledReferences = references.join('\n')
	fs.readdirSync(staticDir, { withFileTypes: true }).forEach((entry) => {
		if (!entry.isFile()) return
		// uni-app 会把源码 static/ 原样复制进构建产物，但运行时图片实际都通过
		// common/assets.js 从 /assets/<hash> 加载；凡编译产物里没有被 /static/ 引用
		// 的图片都是重复/未使用文件。删除它们可将主包压回微信 2MB 限制以内。
		if (!compiledReferences.includes(`/static/${entry.name}`)) {
			fs.unlinkSync(path.join(staticDir, entry.name))
		}
	})

	// 目录已空则一并移除，保持产物整洁
	if (fs.readdirSync(staticDir).length === 0) {
		fs.rmdirSync(staticDir)
	}
}
function removeUnreferencedMiniappAssets(outDir) {
	const outputRoot = path.resolve(__dirname, outDir)
	const assetsDir = path.resolve(__dirname, outDir, 'assets')
	if (!fs.existsSync(assetsDir)) return

	const referenceExtensions = new Set(['.js', '.json', '.wxml', '.wxs', '.wxss'])
	const references = []
	const pendingDirectories = [outputRoot]

	while (pendingDirectories.length) {
		const directory = pendingDirectories.pop()
		fs.readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
			const entryPath = path.join(directory, entry.name)
			if (entry.isDirectory()) {
				if (entryPath !== assetsDir) pendingDirectories.push(entryPath)
				return
			}
			if (referenceExtensions.has(path.extname(entry.name))) {
				references.push(fs.readFileSync(entryPath, 'utf8'))
			}
		})
	}

	const compiledReferences = references.join('\n')
	fs.readdirSync(assetsDir, { withFileTypes: true }).forEach((entry) => {
		if (!entry.isFile()) return
		if (!compiledReferences.includes(`/assets/${entry.name}`)) {
			fs.unlinkSync(path.join(assetsDir, entry.name))
		}
	})
}

async function copyMiniappAssets() {
	const outDir = process.env.UNI_OUTPUT_DIR || path.join('unpackage', 'dist', 'build', 'mp-weixin')
	if (outDir.includes(`${path.sep}dev${path.sep}`) || outDir.includes('/dev/')) {
		return
	}

	const assetsDir = path.resolve(__dirname, outDir, 'assets')
	fs.mkdirSync(assetsDir, { recursive: true })
	const builtAssetMappings = readBuiltAssetMappings(outDir)

	await Promise.all(assetSources.map(async (sourceName) => {
		const outputName = builtAssetMappings[sourceName]
		if (!outputName) return
		const sourcePath = path.resolve(__dirname, 'static', sourceName)
		if (fs.existsSync(sourcePath)) {
			await writeMiniappAsset(sourcePath, path.join(assetsDir, outputName))
		}
	}))

	removeUnreferencedMiniappAssets(outDir)
	removeUnreferencedStaticAssets(outDir)
	await minifyMiniappJavaScript(outDir)
}

function keepMiniappAssets() {
	return {
		name: 'keep-miniapp-assets',
		async closeBundle() {
			await copyMiniappAssets()
		}
	}
}

module.exports = {
	plugins: [uni(), keepMiniappAssets()],
	build: {
		minify: false
	}
}
