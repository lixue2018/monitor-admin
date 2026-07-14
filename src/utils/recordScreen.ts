import { Base64 } from 'js-base64';
import pako from 'pako';

/** 解压 SDK 上报的录屏 events（与 web-see 一致） */
export function unzipRecordScreen(b64Data: string): unknown[] {
  const strData = Base64.atob(b64Data);
  const charData = strData.split('').map((x) => x.charCodeAt(0));
  const binData = new Uint8Array(charData);
  const data = pako.ungzip(binData);

  let str = '';
  const chunk = 8 * 1024;
  let i = 0;
  for (i = 0; i < data.length / chunk; i += 1) {
    str += String.fromCharCode.apply(null, Array.from(data.slice(i * chunk, (i + 1) * chunk)));
  }
  str += String.fromCharCode.apply(null, Array.from(data.slice(i * chunk)));

  const unzipStr = Base64.decode(str);
  try {
    const parsed = JSON.parse(unzipStr);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
}
