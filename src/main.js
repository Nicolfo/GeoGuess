import axios from '@/plugins/axios';
import 'firebase/analytics';
import firebase from 'firebase/app';
import 'firebase/app-check';
import 'firebase/auth';
import 'firebase/database';
import * as GmapVue from 'gmap-vue';
import Vue from 'vue';
import VueAxios from 'vue-axios';
import VueClipboard from 'vue-clipboard2';
import App from './App.vue';
import i18n from './lang';
import CountryNamePlugin from './plugins/countryNamePlugin';
import vuetify from './plugins/vuetify';
import './registerServiceWorker';
import router from './router';
import store from './store';

Vue.use(VueAxios, axios);

Vue.use(CountryNamePlugin);
Vue.use(VueClipboard);

Vue.use(GmapVue, {
    load: {
        key: process.env.VUE_APP_API_KEY,
        language: localStorage.getItem('language'),
        v: '3.55',
    },
});
Vue.config.productionTip = false;

const updateSizes = (obj = {}) => {
    obj.width = window.innerWidth;
    obj.height = window.innerHeight;
    document.documentElement.style.setProperty(
        '--global-height',
        window.innerHeight + 'px'
    );
    return obj;
};

Object.defineProperty(Vue.prototype, '$viewport', {
    value: Vue.observable(updateSizes()),
});

window.addEventListener('resize', () => {
    updateSizes(Vue.prototype.$viewport);
});

const firebaseConfig = {
    apiKey: process.env.VUE_APP_FIREBASE_API_KEY,
    authDomain:
        process.env.VUE_APP_FIREBASE_AUTH_DOMAIN ||
        process.env.VUE_APP_FIREBASE_PROJECT_ID + '.firebaseapp.com',
    databaseURL:
        process.env.VUE_APP_FIREBASE_DATABASE_URL ||
        'https://' +
            process.env.VUE_APP_FIREBASE_PROJECT_ID +
            '.firebaseio.com',
    projectId: process.env.VUE_APP_FIREBASE_PROJECT_ID,
    storageBucket:
        process.env.VUE_APP_STORAGE_BUCKET ||
        process.env.VUE_APP_FIREBASE_PROJECT_ID + '.appspot.com',
    messagingSenderId: process.env.VUE_APP_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VUE_APP_FIREBASE_APP_ID,
    measurementId: process.env.VUE_APP_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
if (firebaseConfig.measurementId) firebase.analytics();

// App Check: prove requests originate from the genuine app before the
// Realtime Database accepts them. Activated only when a reCAPTCHA v3 site key
// is configured, so the app keeps working until App Check is set up.
// A debug token (set in dev/CI) lets localhost and Cypress attest; register it
// under App Check > Manage debug tokens in the Firebase console.
if (process.env.VUE_APP_APPCHECK_DEBUG_TOKEN) {
    self.FIREBASE_APPCHECK_DEBUG_TOKEN =
        process.env.VUE_APP_APPCHECK_DEBUG_TOKEN === 'true'
            ? true
            : process.env.VUE_APP_APPCHECK_DEBUG_TOKEN;
}
if (process.env.VUE_APP_RECAPTCHA_SITE_KEY) {
    firebase
        .appCheck()
        .activate(process.env.VUE_APP_RECAPTCHA_SITE_KEY, true);
}

// Sign the player in anonymously so database writes can be restricted to
// authenticated clients (see database.rules.json). This is a no-op until the
// Anonymous sign-in provider is enabled in the Firebase console; the catch
// keeps the app working in the meantime.
firebase
    .auth()
    .signInAnonymously()
    .catch((error) => {
        // eslint-disable-next-line no-console
        console.error('Anonymous Firebase auth failed:', error);
    });

// Load (or create) the persistent profile once the auth state is known. This
// also fires when a previous anonymous session is restored from cache.
firebase.auth().onAuthStateChanged((user) => {
    if (user) {
        store.dispatch('userStore/initUser', user.uid);
    }
});

new Vue({
    vuetify: vuetify(i18n),
    router,
    i18n,
    store,
    axios,
    render: (h) => h(App),
}).$mount('#app');
