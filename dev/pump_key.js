// 헛다리 레볼루션 관리자 번호(숫자 4자리)의 확인값을 만든다.
// 사용법:  node dev/pump_key.js 1234   → 출력된 값을 js/pump-data.js 의 PUMP_KEY 에 붙여넣으세요.
// (js/save.js 의 pinHash 와 같은 계산이에요. 번호 자체는 소스에 남기지 않고 이 값만 남겨요.)
function pinHash(id, pin) {
  const s = id.toLowerCase() + ':' + pin; let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
const pin = String(process.argv[2] || '');
if (!/^\d{4}$/.test(pin)) { console.error('숫자 4자리를 넣어 주세요. 예) node dev/pump_key.js 1234'); process.exit(1); }
console.log(pinHash('rk-pump', pin));
