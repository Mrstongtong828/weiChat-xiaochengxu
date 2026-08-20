<template>
  <div class="glass-card access-denied">
    <el-result icon="warning" title="当前账号暂无业务权限" sub-title="请联系管理员在用户管理中为此账号勾选所需权限。" />
  </div>
</template>

<style scoped>
.access-denied { min-height: 360px; display: grid; place-items: center; }
</style>
