<template>
  <router-view />
</template>

<style>
:root {
  --el-color-primary: #165DFF;
  --el-color-primary-light-9: #e8f3ff;
  --el-border-radius-base: 8px;
  --el-bg-color-page: #f4f5f7;
}

html, body {
  margin: 0;
  padding: 0;
  height: 100%;
  font-family: -apple-system, "PingFang SC", "Helvetica Neue", sans-serif;
  background: var(--el-bg-color-page);
}

#app {
  height: 100vh;
}
</style>
