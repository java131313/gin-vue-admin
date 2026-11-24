<script setup>
// 学NodeJS 学习页 —— 复用通用的 CourseStudy 组件，只传模块名
// （Node/Vue/React 三个模块结构完全相同，所以共用一套页面代码）
import CourseStudy from '@/components/CourseStudy.vue'
</script>

<template>
  <CourseStudy module="node" />
</template>
