import 'dotenv/config';

export default {
  expo: {
    name: "bottle",
    slug: "bottle",

    // ✅ 안드로이드 설정 추가
    android: {
      package: "com.hyoso.bottle", // 네 앱의 고유 ID
      versionCode: 1,              // 처음이면 1, 나중에 업데이트 때 2,3... 올려주면 됨
    },

    extra: {
      apiKey: process.env.API_KEY,
      authDomain: process.env.AUTH_DOMAIN,
      projectId: process.env.PROJECT_ID,
      storageBucket: process.env.STORAGE_BUCKET,
      messagingSenderId: process.env.MESSAGING_SENDER_ID,
      appId: process.env.APP_ID,

      eas: {
        projectId: "9c81c238-bc74-4a9a-916c-f2d17dce873c",
      },
    },
  },
};
