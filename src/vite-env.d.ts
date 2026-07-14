/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 业务 dev 服务地址，用于详情页拉取源码 */
  readonly VITE_SOURCE_PROXY_TARGET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<object, object, unknown>;
  export default component;
}
