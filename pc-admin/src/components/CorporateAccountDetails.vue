<template>
  <section class="corporate-account" aria-label="对公收款账户">
    <div class="corporate-account__heading">
      <el-icon><OfficeBuilding /></el-icon>
      <div>
        <strong>对公收款账户</strong>
        <span>客户转账时备注工单编号，财务以银行流水为准核销</span>
      </div>
    </div>
    <dl class="corporate-account__details">
      <div>
        <dt>户名</dt>
        <dd>{{ account.companyName }}</dd>
      </div>
      <div>
        <dt>开户行</dt>
        <dd>{{ account.bankName }}</dd>
      </div>
      <div>
        <dt>账号</dt>
        <dd class="corporate-account__number">{{ account.accountNo }}</dd>
      </div>
    </dl>
  </section>
</template>

<script setup>
import { OfficeBuilding } from '@element-plus/icons-vue'

defineProps({
  account: {
    type: Object,
    required: true
  }
})
</script>

<style scoped>
.corporate-account {
  display: grid;
  grid-template-columns: minmax(190px, 0.8fr) minmax(0, 2fr);
  gap: 18px;
  padding: 14px 16px;
  border-block: 1px solid #d9e2ec;
  background: #f7f9fb;
}
.corporate-account__heading { display: flex; align-items: flex-start; gap: 10px; color: #17212f; }
.corporate-account__heading > .el-icon { flex: none; margin-top: 2px; color: #1677ff; font-size: 18px; }
.corporate-account__heading div { display: flex; min-width: 0; flex-direction: column; gap: 4px; }
.corporate-account__heading strong { font-size: 14px; }
.corporate-account__heading span { color: #6b7785; font-size: 12px; line-height: 1.5; }
.corporate-account__details { display: grid; grid-template-columns: 1.2fr 1fr 1fr; gap: 14px; margin: 0; }
.corporate-account__details div { min-width: 0; }
.corporate-account__details dt { margin-bottom: 4px; color: #86909c; font-size: 12px; }
.corporate-account__details dd { margin: 0; overflow-wrap: anywhere; color: #1d2129; font-size: 13px; font-weight: 600; line-height: 1.5; }
.corporate-account__number { font-family: Consolas, "Courier New", monospace; }

@media screen and (max-width: 900px) {
  .corporate-account { grid-template-columns: 1fr; }
  .corporate-account__details { grid-template-columns: 1fr; }
}
</style>
