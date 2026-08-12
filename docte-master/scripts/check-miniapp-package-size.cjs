const fs = require('fs')
const path = require('path')

const outputRoot = path.resolve(process.argv[2] || 'unpackage/dist/build/mp-weixin')
const limitBytes = 2 * 1024 * 1024
const appConfigPath = path.join(outputRoot, 'app.json')

if (!fs.existsSync(appConfigPath)) {
	console.error(`[package-size] Missing build output: ${appConfigPath}`)
	process.exit(1)
}

const appConfig = JSON.parse(fs.readFileSync(appConfigPath, 'utf8'))
const subpackageRoots = new Set(
	(appConfig.subPackages || appConfig.subpackages || []).map(({ root }) => String(root || '').replace(/[\\/]+$/, ''))
)

const files = []
const pendingDirectories = [outputRoot]

while (pendingDirectories.length) {
	const directory = pendingDirectories.pop()
	fs.readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
		const entryPath = path.join(directory, entry.name)
		if (entry.isDirectory()) {
			pendingDirectories.push(entryPath)
			return
		}
		if (!entry.isFile()) return

		const relativePath = path.relative(outputRoot, entryPath).split(path.sep).join('/')
		const topLevelDirectory = relativePath.split('/')[0]
		if (!subpackageRoots.has(topLevelDirectory)) {
			files.push({ relativePath, bytes: fs.statSync(entryPath).size })
		}
	})
}

const mainPackageBytes = files.reduce((total, file) => total + file.bytes, 0)
const kibibytes = (bytes) => (bytes / 1024).toFixed(1)
const largestFiles = files.sort((left, right) => right.bytes - left.bytes).slice(0, 8)

console.log(`[package-size] Main package: ${kibibytes(mainPackageBytes)} KiB / ${kibibytes(limitBytes)} KiB`)

if (mainPackageBytes > limitBytes) {
	console.error(`[package-size] Main package exceeds the limit by ${kibibytes(mainPackageBytes - limitBytes)} KiB.`)
	largestFiles.forEach(({ relativePath, bytes }) => {
		console.error(`  ${kibibytes(bytes).padStart(8)} KiB  ${relativePath}`)
	})
	process.exit(1)
}

console.log(`[package-size] Remaining margin: ${kibibytes(limitBytes - mainPackageBytes)} KiB`)
