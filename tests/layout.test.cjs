const {test}=require('node:test');
const assert=require('node:assert/strict');
const core=require('../core.js');
function line(text,y,size=10,x=20) {
 return [...text].map((c,i)=>({c,fontSize:size,rect:[x+i*5,y,x+i*5+5,y+size],lineBreakAfter:i===text.length-1}));
}
test('body stream excludes footnotes while notes remain hoverable',()=>{
 const p=core.buildPage([...line('The body continues',300),...line('1 A footnote.',35,8),...line('across the column.',500,10,300)],[0,0,600,800]);
 assert.equal(p.segments[0].text,'The body continues across the column.');
 assert.equal(core.atPoint(p,32,39).sentence.text,'1 A footnote.');
 assert.equal(core.atPoint(p,302,505).sentence.text,p.segments[0].text);
});
test('caption stream is translated separately from the body',()=>{
 const p=core.buildPage([...line('The body continues',600),...line('Figure 1. A caption.',400,9),...line('across this figure.',350)],[0,0,600,800]);
 assert.equal(p.segments[0].text,'The body continues across this figure.');
 const hit=core.atPoint(p,82,404);
 assert.ok(hit.sentence.text.includes('caption'));
 assert.ok(!hit.sentence.text.includes('body'));
});
test('unknown geometry keeps original text rather than discarding content',()=>{
 const chars=line('Some text.',200).map(({fontSize,...c})=>c);
 assert.equal(core.buildPage(chars,[0,0,600,800]).segments[0].text,'Some text.');
});
test('page continuation skips footnotes and keeps page-specific hit geometry',()=>{
 const pages=[{pageIndex:0,viewBox:[0,0,600,800],chars:[...line('A sentence continues',250),...line('1 Note on page one.',35,8)]},
 {pageIndex:1,viewBox:[0,0,600,800],chars:line('onto the next page.',700)}];
 const p=core.joinPages(pages);
 assert.equal(core.atPoint(p,22,255,0).sentence.text,'A sentence continues onto the next page.');
 assert.equal(core.atPoint(p,22,705,1).sentence.text,'A sentence continues onto the next page.');
 assert.equal(core.atPoint(p,32,39,0).sentence.text,'1 Note on page one.');
 assert.equal(core.atPoint(p,22,255,1),null);
});
test('uppercase heading does not continue an incomplete previous page',()=>{
 const p=core.joinPages([{pageIndex:0,viewBox:[0,0,600,800],chars:line('Incomplete fragment',250)},
 {pageIndex:1,viewBox:[0,0,600,800],chars:line('Methods and results',700)}]);
 assert.deepEqual(p.segments.map(s=>s.text),['Incomplete fragment','Methods and results']);
});
test('sparse table row stays out of prose and remains hoverable',()=>{
 const cells=[...line('Method',400,10,20),...line('Value',400,10,180),...line('Error',400,10,320)];
 for(const c of cells) c.lineBreakAfter=false;
 cells[cells.length-1].lineBreakAfter=true;
 const p=core.buildPage([...line('The body continues',600),...cells,...line('after the table.',350)],[0,0,600,800]);
 assert.equal(p.segments[0].text,'The body continues after the table.');
 assert.ok(core.atPoint(p,182,405).sentence.text.includes('Value'));
 assert.ok(!core.atPoint(p,182,405).sentence.text.includes('body'));
});

test('column continuation uses the line start rather than the last glyph at the gutter',()=>{
 const left=line('A sentence runs to the edge of the col-',250,10,20);
 left[left.length-1].paragraphBreakAfter=true;
 const right=line('umn and continues here.',650,10,210);
 const p=core.buildPage([...left,...right],[0,0,600,800]);
 assert.equal(p.segments[0].text,'A sentence runs to the edge of the column and continues here.');
});
