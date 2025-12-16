<template>
    <div class="login-page " style="margin-top: 0px;">
        <div class="panel-container ">
            <div class="block text-center">
                <el-carousel height="550px" style="width:800px;" motion-blur>
                    <el-carousel-item v-for="item in 4" :key="item">
                        <section class="login-intro custom-primary-bg">
                            <h1 class="intro-title">{{ appName }}</h1>
                            <p class="intro-subtitle">欢迎登录！</p>
                            <img :src="loginImg" alt="login" />
                        </section>
                    </el-carousel-item>
                </el-carousel>
            </div>

            <section class="login-panel">
                <h1 style="margin-bottom: 10px" v-if="device == 'mobile'">
                    {{ appName }}
                </h1>
                <h1 style="color: var(--el-color-primary) !important;">{{ loginStatus ? "登录" : "注册" }}</h1>
                <el-form :model="loginForm" class="login-form" v-show="loginStatus" label-position="top">
                    <el-form-item label="账号">
                        <el-input placeholder="请输入账号" v-model="loginForm.account" />
                    </el-form-item>
                    <el-form-item label="密码">
                        <el-input type="password" placeholder="请输入密码" v-model="loginForm.password" />
                    </el-form-item>
                    <el-form-item>
                        <el-button type="primary" class="login-btn" @click="onLoginClick" :loading="loginBtnLoading">
                            登录
                        </el-button>
                        <div class="form-bottom">
                            <el-button type="text" @click="onTogglePanelStatus">
                                注册
                            </el-button>
                        </div>
                    </el-form-item>
                </el-form>
                <el-form :model="registerForm" class="login-form" v-show="!loginStatus" label-position="top">
                    <el-form-item label="用户名" name="username">
                        <el-input style="color: black;" placeholder="请输入用户名" v-model="registerForm.username" />
                    </el-form-item>
                    <el-form-item label="密码">
                        <el-input type="password" placeholder="请设置密码" v-model="registerForm.password" />
                    </el-form-item>
                    <el-form-item label="邮箱" name="email">
                        <el-input placeholder="请输入邮箱" v-model="registerForm.email" :prefix-icon="Message" />
                    </el-form-item>
                    <el-form-item label="手机号码" name="phone">
                        <el-input placeholder="请输入手机号码" v-model="registerForm.phone" :prefix-icon="Iphone" />
                    </el-form-item>
                    <el-form-item>
                        <el-button type="primary" class="login-btn" @click="onRegisterClick">
                            注册
                        </el-button>
                        <div class="form-bottom">
                            <el-button type="text" @click="onTogglePanelStatus">
                                密码登录
                            </el-button>
                        </div>
                    </el-form-item>
                </el-form>
            </section>
        </div>
    </div>
</template>


<script>
import { reactive, ref, computed, onMounted } from "vue";
import loginSvg from "../assets/images/login.svg";
import axios from 'axios';
import router from '../router/index.js'; // 假设你使用了 Vue Router
import { ElNotification } from 'element-plus'
import { Message, Iphone } from '@element-plus/icons-vue'
import emitter from "./EventBus.js";
import { ElMessage } from "element-plus";


onMounted(() => {
    emitter.emit('show_menu', false)
});

export default {
    name: "login",

    setup() {

        //切换登录、注册面板
        const loginStatus = ref(true);
        const onTogglePanelStatus = () => {
            loginStatus.value = !loginStatus.value;
        };

        //获取验证码
        const onGetCodeClick = () => {
            console.log("获取验证码");
        };

        //登录操作
        const loginForm = reactive({
            account: "shardora",
            password: "test",
        });

        let loginBtnLoading = ref(false);

        const onLoginClick = async () => {
            console.log("1")
            delete axios.defaults.headers.common['Authorization'];

            try {
                const response = await axios.post('/rest_token/', {
                    username: loginForm.account,
                    password: md5(md5(md5(loginForm.password))),
                });

                console.log("2")
                const token = response.data.access;
                localStorage.setItem('access_token', response.data.access)
                // localStorage.setItem('refresh_token', response.data.refresh)

                axios.defaults.headers.common['Authorization'] = `Bearer ${token}`; // 设置默认请求头
                // axios.interceptors.response.use(response => response, error => {
                //     if (error.response.status === 401) {
                //         return axios.post('/rest_refresh/', {
                //             refresh: localStorage.getItem('refresh_token')
                //         }).then(response => {
                //             localStorage.setItem('access_token', response.data.access)
                //             error.config.headers['Authorization'] = `Bearer ${response.data.access}`
                //             return axios.request(error.config)
                //         })
                //     }
                //     return Promise.reject(error)
                // })


                console.log("3")
                ElMessage({title: "成功", type: "success", message:  "欢迎： " + loginForm.account})
                emitter.emit('show_menu', true)
                router.push('/pipeline'); // 登录成功后跳转到主页
            } catch (error) {
                ElMessage({title: "失败", type: "danger", message:   "登录失败：" + error})
            }
        };

        //注册操作
        const registerForm = reactive({
            username: "",
            email: "",
            phone: "",
            password: "",
            code: "",
        });
        const onRegisterClick = async () => {
            try {
                const response = await axios.post('/rest_register/', {
                    username: registerForm.username,
                    password: md5(md5(md5(registerForm.password))),
                    email: registerForm.email,
                    phone: registerForm.phone,
                });
                // 注册成功后可以进行页面跳转
                ElMessage({title: "注册成功", type: "success", message:  "欢迎： " + registerForm.username})
                ElNotification({ title: "注册成功", message: "请登录", type: "success", position: 'top-left',})
                router.push("/login")
            } catch (error) {
                ElMessage({title: "注册失败：", type: "danger", message:  error})
            }
        };
        return {
            loginForm,
            loginImg: loginSvg,
            loginStatus,
            loginBtnLoading,
            registerForm,
            onRegisterClick,
            onLoginClick,
            onGetCodeClick,
            onTogglePanelStatus,
            appName: computed(() => "智能计算平台"),
            device: computed(() => "store.state.app.device"),
        };
    },
};


function md5(e) {
    var t = 1 < arguments.length && void 0 !== arguments[1] ? arguments[1] : 32, n = e;

    function u(e, t) {
        return e << t | e >>> 32 - t
    }

    function l(e, t) {
        var n, r, o, i, a;
        return o = 2147483648 & e, i = 2147483648 & t, a = (1073741823 & e) + (1073741823 & t), (n = 1073741824 & e) & (r = 1073741824 & t) ? 2147483648 ^ a ^ o ^ i : n | r ? 1073741824 & a ? 3221225472 ^ a ^ o ^ i : 1073741824 ^ a ^ o ^ i : a ^ o ^ i
    }

    function r(e, t, n, r, o, i, a) {
        var s;
        return l(u(e = l(e, l(l((s = t) & n | ~s & r, o), a)), i), t)
    }

    function o(e, t, n, r, o, i, a) {
        var s;
        return l(u(e = l(e, l(l(t & (s = r) | n & ~s, o), a)), i), t)
    }

    function i(e, t, n, r, o, i, a) {
        return l(u(e = l(e, l(l(t ^ n ^ r, o), a)), i), t)
    }

    function a(e, t, n, r, o, i, a) {
        return l(u(e = l(e, l(l(n ^ (t | ~r), o), a)), i), t)
    }

    function s(e) {
        var t, n = "", r = "";
        for (t = 0; t <= 3; t++) n += (r = "0" + (e >>> 8 * t & 255).toString(16)).substr(r.length - 2, 2);
        return n
    }

    var c, f, p, d, h, v, m, y, g, b = Array();
    for (b = function (e) {
        for (var t, n = e.length, r = n + 8, o = 16 * ((r - r % 64) / 64 + 1), i = Array(o - 1), a = 0, s = 0; s < n;) a = s % 4 * 8, i[t = (s - s % 4) / 4] = i[t] | e.charCodeAt(s) << a, s++;
        return a = s % 4 * 8, i[t = (s - s % 4) / 4] = i[t] | 128 << a, i[o - 2] = n << 3, i[o - 1] = n >>> 29, i
    }(n), v = 1732584193, m = 4023233417, y = 2562383102, g = 271733878, c = 0; c < b.length; c += 16) m = a(m = a(m = a(m = a(m = i(m = i(m = i(m = i(m = o(m = o(m = o(m = o(m = r(m = r(m = r(m = r(p = m, y = r(d = y, g = r(h = g, v = r(f = v, m, y, g, b[c + 0], 7, 3614090360), m, y, b[c + 1], 12, 3905402710), v, m, b[c + 2], 17, 606105819), g, v, b[c + 3], 22, 3250441966), y = r(y, g = r(g, v = r(v, m, y, g, b[c + 4], 7, 4118548399), m, y, b[c + 5], 12, 1200080426), v, m, b[c + 6], 17, 2821735955), g, v, b[c + 7], 22, 4249261313), y = r(y, g = r(g, v = r(v, m, y, g, b[c + 8], 7, 1770035416), m, y, b[c + 9], 12, 2336552879), v, m, b[c + 10], 17, 4294925233), g, v, b[c + 11], 22, 2304563134), y = r(y, g = r(g, v = r(v, m, y, g, b[c + 12], 7, 1804603682), m, y, b[c + 13], 12, 4254626195), v, m, b[c + 14], 17, 2792965006), g, v, b[c + 15], 22, 1236535329), y = o(y, g = o(g, v = o(v, m, y, g, b[c + 1], 5, 4129170786), m, y, b[c + 6], 9, 3225465664), v, m, b[c + 11], 14, 643717713), g, v, b[c + 0], 20, 3921069994), y = o(y, g = o(g, v = o(v, m, y, g, b[c + 5], 5, 3593408605), m, y, b[c + 10], 9, 38016083), v, m, b[c + 15], 14, 3634488961), g, v, b[c + 4], 20, 3889429448), y = o(y, g = o(g, v = o(v, m, y, g, b[c + 9], 5, 568446438), m, y, b[c + 14], 9, 3275163606), v, m, b[c + 3], 14, 4107603335), g, v, b[c + 8], 20, 1163531501), y = o(y, g = o(g, v = o(v, m, y, g, b[c + 13], 5, 2850285829), m, y, b[c + 2], 9, 4243563512), v, m, b[c + 7], 14, 1735328473), g, v, b[c + 12], 20, 2368359562), y = i(y, g = i(g, v = i(v, m, y, g, b[c + 5], 4, 4294588738), m, y, b[c + 8], 11, 2272392833), v, m, b[c + 11], 16, 1839030562), g, v, b[c + 14], 23, 4259657740), y = i(y, g = i(g, v = i(v, m, y, g, b[c + 1], 4, 2763975236), m, y, b[c + 4], 11, 1272893353), v, m, b[c + 7], 16, 4139469664), g, v, b[c + 10], 23, 3200236656), y = i(y, g = i(g, v = i(v, m, y, g, b[c + 13], 4, 681279174), m, y, b[c + 0], 11, 3936430074), v, m, b[c + 3], 16, 3572445317), g, v, b[c + 6], 23, 76029189), y = i(y, g = i(g, v = i(v, m, y, g, b[c + 9], 4, 3654602809), m, y, b[c + 12], 11, 3873151461), v, m, b[c + 15], 16, 530742520), g, v, b[c + 2], 23, 3299628645), y = a(y, g = a(g, v = a(v, m, y, g, b[c + 0], 6, 4096336452), m, y, b[c + 7], 10, 1126891415), v, m, b[c + 14], 15, 2878612391), g, v, b[c + 5], 21, 4237533241), y = a(y, g = a(g, v = a(v, m, y, g, b[c + 12], 6, 1700485571), m, y, b[c + 3], 10, 2399980690), v, m, b[c + 10], 15, 4293915773), g, v, b[c + 1], 21, 2240044497), y = a(y, g = a(g, v = a(v, m, y, g, b[c + 8], 6, 1873313359), m, y, b[c + 15], 10, 4264355552), v, m, b[c + 6], 15, 2734768916), g, v, b[c + 13], 21, 1309151649), y = a(y, g = a(g, v = a(v, m, y, g, b[c + 4], 6, 4149444226), m, y, b[c + 11], 10, 3174756917), v, m, b[c + 2], 15, 718787259), g, v, b[c + 9], 21, 3951481745), v = l(v, f), m = l(m, p), y = l(y, d), g = l(g, h);
    return 32 == t ? s(v) + s(m) + s(y) + s(g) : s(m) + s(y)
}

</script>

<style lang="scss" scoped>
$primaryColor: #409EFF;
$secondaryColor: rgb($primaryColor, 0.1);
$bgColor: #f6f7f9;

$blue: #409EFF;
$red: #F56C6C;
$green: #67C23A;
$yellow: #E6A23C;

//app背景色
$appBgColor: #fff;

@mixin flex-row-center-center {
    display: flex;
    justify-content: center;
    align-items: center;
}

@mixin flex-col-center-center {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
}


//单行溢出
@mixin ellipsis-singe-line {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

//多行溢出
@mixin ellipsis-multi-line($line) {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: $line;
    overflow: hidden;
}

.el-form .el-form-item__label {
    color: var(--el-color-primary) !important;
    font-size: 15px;
}

.el-form .el-input__inner {
    -webkit-appearance: none;
    background: none;
    border: none;
    box-sizing: border-box;
    color: var(--el-color-info);
    flex-grow: 1;
    font-size: inherit;
    height: var(--el-input-inner-height);
    line-height: var(--el-input-inner-height);
    outline: none;
    padding: 0;
    width: 100%;
}

.demonstration {
    color: var(--el-text-color-secondary);
}

.el-carousel__item:nth-child(2n) {
    background-color: var(--el-color-primary) !important;
}

.el-carousel__item:nth-child(2n + 1) {
    background-color: var(--el-color-primary) !important;
}

/* 全局样式文件或者组件内的 <style> */
.custom-primary-bg {
    background-color: var(--el-color-primary) !important;
}

:deep(.el-input__inner) {
    color: #000;
}

:deep(.el-form-item__label) {
    color: #000;
}

.login-page {
    width: 100%;
    height: 100vh;
    @include flex-row-center-center;

    .panel-container {
        position: relative;
        @include flex-row-center-center;
        width: auto;

        .login-intro {
            width: 900px;
            height: 500px;
            flex-shrink: 0;
            background-color: $primaryColor;
            padding: 50px;
            color: #ffffff !important;
            box-sizing: border-box;
            padding-right: 60px;
            /* border-right: 1px dashed rgba(0, 0, 0, 0.1); */
            border-top-left-radius: 6px;
            border-bottom-left-radius: 6px;

            @media screen and (max-width: 750px) {
                display: none;
            }

            >img {
                width: 100%;
                height: 100%;
            }

            .intro-title,
            .intro-subtitle {
                text-align: left;
            }

            .intro-title {
                font-weight: bold;
                font-size: 22px;
            }

            .intro-subtitle {
                font-size: 14px;
                margin-top: 10px;
            }
        }

        .login-panel {
            width: 400px;
            min-height: 550px;
            padding: 50px;
            background-color: #ffffff;
            box-sizing: border-box;
            transition: all 0.5s;
            flex-shrink: 0;
            border-top-right-radius: 6px;
            border-bottom-right-radius: 6px;

            @media screen and (max-width: 750px) {
                width: 90vw;
                padding: 50px 30px;
            }

            h1 {
                text-align: center;
                font-size: 24px;
                width: 100%;
                margin: 0 auto;
            }

            .login-form {
                margin-top: 40px;

                .login-btn {
                    width: 100%;
                    height: 40px;
                    margin-top: 30px;
                }

                .form-bottom {
                    margin-top: 10px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
            }
        }

        .code-by {
            position: absolute;
            bottom: -50px;
            left: 50%;
            transform: translateX(-50%);
            color: #ccc;
        }
    }
}
</style>