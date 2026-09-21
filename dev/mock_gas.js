// Apps Script 환경을 흉내 내는 최소 목업 (Code.gs 로직 검증용)
const vm=require('vm'),fs=require('fs');
function makeSheet(name){
  const rows=[];
  return {name,rows,
    appendRow(a){rows.push(a.slice());},
    getLastRow(){return rows.length;},
    getRange(r,c,nr,nc){nr=nr||1;nc=nc||1;return{
      getValues(){const o=[];for(let i=0;i<nr;i++){const row=rows[r-1+i]||[];const line=[];for(let j=0;j<nc;j++)line.push(row[c-1+j]===undefined?'':row[c-1+j]);o.push(line);}return o;},
      setValues(v){for(let i=0;i<nr;i++){rows[r-1+i]=rows[r-1+i]||[];for(let j=0;j<nc;j++)rows[r-1+i][c-1+j]=v[i][j];}}};}
  };
}
function load(){
  const sheets={};
  const ctx={console,
    SpreadsheetApp:{getActiveSpreadsheet:()=>({getSheetByName:n=>sheets[n]||null,insertSheet:n=>(sheets[n]=makeSheet(n))})},
    LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},
    ContentService:{MimeType:{JSON:'json'},createTextOutput:t=>({t,setMimeType(){return this;},getContent(){return t;}})},
    Utilities:{formatDate:(d,tz,f)=>new Date(d).toISOString().replace('T',' ').slice(0,19),
      DigestAlgorithm:{SHA_256:'sha256'},
      computeDigest:(alg,s)=>Array.from(require('crypto').createHash('sha256').update(s).digest()).map(b=>b>127?b-256:b)},
    JSON,Date,Math,Number,String,Object,isFinite};
  vm.createContext(ctx);vm.runInContext(fs.readFileSync(__dirname+'/../backend/Code.gs','utf8'),ctx);
  return {ctx,sheets};
}
module.exports={load};
