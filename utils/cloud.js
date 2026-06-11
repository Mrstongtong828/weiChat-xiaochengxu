export function callCloudFunction(name, data = {}) {
  return new Promise((resolve, reject) => {
    const token = uni.getStorageSync('token')
    if (token) {
      data.token = token
    }

    uniCloud.callFunction({
      name,
      data,
      success: (res) => {
        const result = res.result || {}
        if (result.code === 0) {
          resolve(result.data || result)
        } else {
          if ([401, 1004, 100401].includes(Number(result.code))) {
            uni.removeStorageSync('token')
            uni.removeStorageSync('userInfo')
            uni.removeStorageSync('isLoggedIn')
          }
          reject(new Error(result.message || result.msg || '请求失败'))
        }
      },
      fail: (err) => {
        reject(err)
      }
    })
  })
}

export function importCloudObject(name) {
  return uniCloud.importObject(name)
}
