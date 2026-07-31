const POLICY_LOADERS = {
	warranty: 'getWarrantyPolicy',
	fees: 'getFeePolicy'
}

export const createPolicyDocumentRefresher = ({ getWarrantyPolicy, getFeePolicy, updateDoc }) => {
	const loaders = { getWarrantyPolicy, getFeePolicy }

	return async (key) => {
		const loader = loaders[POLICY_LOADERS[key]]
		if (!loader) return null

		const document = await loader()
		updateDoc(key, document)
		return document
	}
}
