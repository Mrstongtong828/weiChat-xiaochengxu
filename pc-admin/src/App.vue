<template>
  <router-view />
</template>

<style>
:root {
  --el-color-primary: hsl(var(--primary));
  --el-color-primary-light-9: hsl(var(--primary) / 0.08);
  --el-border-radius-base: calc(var(--radius) - 4px);
  --el-bg-color-page: hsl(var(--background));
}

html, body {
  margin: 0;
  padding: 0;
  height: 100%;
  font-family: Inter, -apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", sans-serif;
  background: var(--el-bg-color-page);
}

#app {
  min-height: 100vh;
}
</style>
