// jsdom UI test: farmer and buyer must see different things.   node tests/ui_roles_test.js  (needs: npm i jsdom)
const fs=require('fs'),path=require('path'); const {JSDOM}=require(process.env.JSDOM_PATH||'jsdom');
const file=process.argv[2]||path.join(__dirname,'..','static','index.html');
const dom=new JSDOM(fs.readFileSync(file,'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,beforeParse(w){w.scrollTo=()=>{};w.fetch=()=>Promise.reject(new Error('no backend'));}});
const w=dom.window,d=w.document,errs=[]; w.addEventListener('error',e=>errs.push(e.message));
const $=s=>d.querySelector(s), $$=s=>[...d.querySelectorAll(s)], click=s=>{const e=$(s);if(!e)throw new Error('missing '+s);e.click();};
let fails=0; const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m); if(!c)fails++;};
const home=()=>$('#home').textContent;
setTimeout(()=>{
 // ---- Home differs
 ok(home().includes('Buyers near you')&&!home().includes('Listings near you'),'farmer home shows "Buyers near you" (not listings)');
 ok($$('#home .item [data-act="offer"]').length===3,'farmer home: 3 nearest buyer requests with Offer buttons');
 ok(home().includes('List your first batch'),'farmer home: empty "Your batches" prompt');
 const farmerFirst=$('#home .item .imid b').textContent;
 click('[data-act="role"][data-r="buyer"]');
 ok(home().includes('Fresh listings near you')&&home().includes('Your requirements')&&!home().includes('Buyers near you'),'buyer home shows "Fresh listings" + "Your requirements"');
 ok($$('#home .item [data-act="req"]').length===3,'buyer home: 3 nearest listings with + request buttons');
 ok($('#home .item .imid b').textContent!==farmerFirst,'first card differs between roles');
 // ---- Market differs
 click('#nav [data-nav="market"]'); ok($('#mtitle').textContent==='Browse listings'&&!!$('#mpost button'),'buyer market = Browse listings + Post requirement button');
 const buyerOpts=$$('#msort option').map(o=>o.textContent).join('|');
 click('[data-act="role"][data-r="farmer"]'); click('#nav [data-nav="market"]');
 ok($('#mtitle').textContent==='Buyer demand board'&&!$('#mpost button'),'farmer market = Buyer demand board');
 ok($('#mcount').textContent.includes('7 open requests'),'farmer market lists 7 open buyer requests');
 ok($$('#msort option').map(o=>o.textContent).join('|')!==buyerOpts,'sort options differ per role');
 // ---- Farmer lists a batch -> sees personalised net estimate -> offers to a buyer
 click('#nav .fab'); $('#fCrop').value='Rice Straw'; $('#fQty').value='4'; click('[data-act="analyze"]');
 click('#nav [data-nav="home"]');
 ok(home().includes('Your 4 t would net'),'farmer sees "Your 4 t would net ₹…" on buyer cards');
 ok($$('#home .item .imid small').some(s=>s.textContent.startsWith('You')),'farmer home lists own batch under "Your batches"');
 click('[data-act="offer"]'); // nearest buyer
 ok($$('#orders .card').length===1&&$('#orders').textContent.includes('Konark Cattle Feeds')||$$('#orders .card').length===1,'offer creates an order');
 const ord=$('#orders').textContent; ok(/Rice Straw/.test(ord),'order is for the offered batch');
 // ---- Buyer posts a requirement -> farmer is notified + sees it
 click('[data-act="role"][data-r="buyer"]'); click('#home [data-act="postreq"]');
 $('#rQty').value='6'; $('#rPrice').value='3500'; click('[data-act="savereq"]');
 ok(home().includes('Rice Straw · 6 t open'),'buyer sees own requirement in "Your requirements"');
 click('[data-act="role"][data-r="farmer"]');
 ok(parseInt($('#bellCount').textContent)>=1,'farmer bell shows notification for the new requirement');
 click('#nav [data-nav="market"]'); ok($('#mcount').textContent.includes('open requests')&&$('#mlist').textContent.includes('Ramesh Traders'),'farmer demand board now includes the buyer\'s requirement');
 // ---- Buyer sees farmer's new listing
 click('[data-act="role"][data-r="buyer"]'); click('#nav [data-nav="market"]');
 ok($$('#mlist [data-act="req"]').length>=5,'buyer browse shows available listings incl. farmer batches');
 // ---- partial fill + regression flow
 click('[data-act="role"][data-r="farmer"]'); click('#nav .fab'); $('#fCrop').value='Rice Straw'; $('#fQty').value='20'; click('[data-act="analyze"]');
 click('#nav [data-nav="market"]');
 const agro=$$('#mlist .item').find(i=>i.textContent.includes('AgroBoard')); agro.querySelector('[data-act="offer"]').click();
 ok($$('#orders .card').length===2,'partial offer (20 t batch -> 10 t need) creates 2nd order');
 for(let i=0;i<4;i++){const b=$('#orders [data-act="adv"]'); if(b) b.click();}
 ok(!!$('#orders .pp'),'order can be advanced to completion with passport');
 click('#nav [data-nav="home"]'); click('#home [data-act="go"][data-s="dash"]'); ok($$('#dash .stat').length===3,'dashboard still works');
 console.log(fails? `\n${fails} FAILED` : '\nALL ROLE TESTS PASSED', '| runtime errors:', errs.length?errs:'none');
 process.exit(fails?1:0);
},200);
