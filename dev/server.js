const http=require('http'),url=require('url');
const {load}=require('./mock_gas');
const {ctx,sheets}=load();
const srv=http.createServer((req,res)=>{
  const u=url.parse(req.url,true);
  res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Headers','*');
  if(req.method==='OPTIONS'){res.writeHead(204);return res.end();}
  if(u.pathname==='/__dump'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({users:(sheets.Users||{rows:[]}).rows,matches:(sheets.Matches||{rows:[]}).rows}));}
  if(u.pathname==='/__seed'){ // 다른 기기에서 저장한 것처럼 데이터 심기
    const p=u.query;const r=JSON.parse(ctx.doPost({postData:{contents:JSON.stringify({action:'save',id:p.id,updatedAt:Number(p.at),data:JSON.parse(p.data)})}}).getContent());
    res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(r));}
  let out;
  if(req.method==='POST'){let b='';req.on('data',d=>b+=d);req.on('end',()=>{out=ctx.doPost({postData:{contents:b}}).getContent();res.setHeader('Content-Type','application/json');res.end(out);});return;}
  out=ctx.doGet({parameter:u.query}).getContent();res.setHeader('Content-Type','application/json');res.end(out);
});
srv.listen(8787,()=>console.log('mock up'));
