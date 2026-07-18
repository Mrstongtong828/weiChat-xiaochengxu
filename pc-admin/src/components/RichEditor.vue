<template>
  <div class="rich-editor" :style="{ '--rich-min-height': minHeight }">
    <Toolbar
      class="rich-editor__toolbar"
      :editor="editorRef"
      :defaultConfig="toolbarConfig"
      mode="default"
    />
    <Editor
      class="rich-editor__body"
      :defaultConfig="editorConfig"
      :modelValue="modelValue"
      mode="default"
      @onCreated="handleCreated"
      @onChange="handleChange"
    />
  </div>
</template>

<script setup>
import { ref, shallowRef, onBeforeUnmount } from 'vue'
import '@wangeditor/editor/dist/css/style.css'
import { Editor, Toolbar } from '@wangeditor/editor-for-vue'
import { ElMessage } from 'element-plus'
import { uploadFileToCloud } from '../utils/upload.js'

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '请输入内容…' },
  minHeight: { type: String, default: '240px' },
  // 富文本里插入图片上传到的云存储目录
  uploadDir: { type: String, default: 'compliance/' }
})
const emit = defineEmits(['update:modelValue'])

const editorRef = shallowRef(null)

const toolbarConfig = {
  excludeKeys: ['fullScreen', 'group-video', 'insertTable', 'codeBlock']
}

const editorConfig = ref({
  placeholder: props.placeholder,
  MENU_CONF: {
    uploadImage: {
      // 自定义图片上传：走统一的云存储上传，插入返回的临时可访问地址
      async customUpload(file, insertFn) {
        try {
          const { tempUrl, fileUrl } = await uploadFileToCloud(file, props.uploadDir, 5 * 1024 * 1024)
          // 用临时可访问地址插入以便即时预览（小程序 <rich-text> 与浏览器都不解析 cloud://）
          insertFn(tempUrl || fileUrl, file.name, tempUrl || fileUrl)
        } catch (e) {
          ElMessage.error(e.message || '图片上传失败')
        }
      }
    }
  }
})

const handleCreated = (editor) => {
  editorRef.value = editor
}
const handleChange = (editor) => {
  emit('update:modelValue', editor.getHtml())
}

onBeforeUnmount(() => {
  const editor = editorRef.value
  if (editor) editor.destroy()
})
</script>

<style scoped>
.rich-editor {
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  overflow: hidden;
}
.rich-editor__toolbar {
  border-bottom: 1px solid #f0f2f5;
}
.rich-editor__body {
  min-height: var(--rich-min-height);
  overflow-y: auto;
}
:deep(.w-e-text-container) {
  min-height: var(--rich-min-height);
}
</style>
