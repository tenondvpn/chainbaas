<template>
  <div>
    <div class="iframe-container" style="border: 0px;">
      <iframe
        :src="externalLink"
        width="100%"
        height="100%"
        frameborder="0"
        sandbox="allow-scripts allow-same-origin allow-popups"
      ></iframe>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const externalLink = ref('http://82.156.224.174:8003/#/index');

// 你可以动态改变这个链接
// const changeLink = () => {
//   externalLink.value = 'https://www.google.com/'; // 注意：谷歌会阻止嵌入
// };
</script>

<style scoped>
.iframe-container {
  width: 100%;
  height: 600px; /* 设置一个固定的高度，以便 iframe 可见 */
  border: 1px solid #ccc;
  border-radius: 8px;
  overflow: hidden;
}
</style>


<!-- 
<template>
  <div class="redirect-container">
    <p>正在跳转到外部网站...</p>
  </div>
</template>

<script>
export default {
  mounted() {
    const externalUrl = 'http://127.0.0.1:8112/';
    console.log("externalUrl: ", externalUrl)
    if (this.validateUrl(externalUrl)) {
      window.location.href = externalUrl;
    console.log("now load externalUrl: ", externalUrl)
      
    } else {
      this.$router.replace('/error/403');
    console.log("now load error: ", externalUrl)
    }
  },
  methods: {
    validateUrl(url) {
        return true;
    //   return /^http?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)$/.test(url);
    }
  }
}
</script>

<style scoped>
.redirect-container {
  padding: 2rem;
  text-align: center;
}
</style> -->
