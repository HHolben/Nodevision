// Nodevision/scripts/bridging-browser.mjs
// Exercise Bridging against the production HTML editor, source serializer, history and save handler, with a simulated Notebook transport.
import {renderEditor} from '/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditor.mjs';
import {startBridging} from '/Sessions/BridgingSession.mjs';
import {createBridgingWordCount} from '/Sessions/BridgingWordCount.mjs';
import {dispatchNodevisionCommand} from '/Commands/NodevisionCommandDispatcher.mjs';
import {loadCallback} from '/callbackLoader.mjs';
let checks=0;const check=(value,message)=>{if(!value)throw Error(message);checks++;};
const wait=async predicate=>{for(let n=0;n<150;n++){if(predicate())return;await new Promise(r=>setTimeout(r,20));}throw Error('Timed out: '+predicate);};
try {
  window.NodevisionState={};const fetchOriginal=window.fetch.bind(window);let saved=[],fail=false,createdPath;
  const source='<!doctype html><html lang="en"><head><title>Bridge</title><meta name="test" content="retained"><style>.invisible{display:none}</style></head><body class="writing"><h1 id="heading">Heading</h1><p id="passage" class="prose">'+Array(498).fill('word').join(' ')+'</p><table id="table"><tbody><tr><td id="cell">cell</td></tr></tbody></table><p hidden>hidden words</p><div class="invisible">also hidden</div><script>const ignored="script words";</script></body></html>';
  window.fetch=async(url,options)=>{
    if(String(url).includes('/Notebook/reopened.html'))return new Response(saved.at(-1).content);
    if(String(url).startsWith('/Notebook/'))return new Response(source);
    if(url==='/api/create'){createdPath=JSON.parse(options.body).path;return new Response(JSON.stringify({success:true}));}
    if(String(url).startsWith('/api/files'))return new Response(JSON.stringify([{name:'other.html',path:'other.html',isDirectory:false}]));
    if(url==='/api/save'){if(fail)return new Response(JSON.stringify({error:'Offline'}),{status:500});saved.push(JSON.parse(options.body));return new Response(JSON.stringify({success:true}));}
    return fetchOriginal(url,options);
  };
  const host=document.getElementById('editor');await renderEditor('bridge.html',host);const ctx=host.__nvHtmlEditorContext,editor=ctx.editorElement;
  let cleanup;
  async function open({growth=100,seconds=0}={}) {
    const root=document.createElement('div');root.id='nv-session-root';root.style.cssText='position:fixed;inset:0;background:white;z-index:1000';document.body.append(root);
    await startBridging({executionContext:{addCleanup:fn=>cleanup=fn,emit:()=>{cleanup();root.remove();}}});
    const numbers=root.querySelectorAll('input[type=number]'),toggles=root.querySelectorAll('input[type=checkbox]');numbers[0].value=growth;numbers[1].value=0;numbers[2].value=seconds;toggles[1].checked=Boolean(seconds);
    root.querySelector('form').dispatchEvent(new Event('input',{bubbles:true}));
    return root;
  }
  const button=text=>[...document.querySelectorAll('#nv-session-root button')].find(b=>b.textContent===text);
  const begin=()=>document.querySelector('#nv-session-root form').requestSubmit();
  const select=(node,start,end=start)=>{editor.focus();const range=document.createRange();range.setStart(node,start);range.setEnd(node,end);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);};
  const append=text=>{const node=editor.querySelector('#passage').firstChild;select(node,node.length);document.execCommand('insertText',false,text);};
  const cellBefore=editor.querySelector('#cell').firstChild;select(cellBefore,0,cellBefore.length);document.execCommand('insertText',false,'cells');editor.__nvProgrammaticHistory.flush();
  await open();check(document.querySelector('#nv-session-root form').textContent.includes('Current: 500 words · Required: 600'),'500 baseline and 600 required');
  const originalHeading=editor.querySelector('#heading'),originalTable=editor.querySelector('#table');begin();
  document.execCommand('undo');check(editor.querySelector('#cell').textContent==='cell','Preexisting undo history survives entering Session');
  check(document.querySelector('#nv-session-root form').hidden,'Configuration hidden when writing');
  check(document.querySelector('#nv-session-root').textContent.includes('+0 / 100'),'Starts with zero growth');
  let rejected=false;try{await dispatchNodevisionCommand('editor.setContent',['bad']);}catch{rejected=true;}check(rejected,'Dispatcher rejects source replacement');
  const callback=await loadCallback('insert','tableMergeCells');rejected=false;try{await callback();}catch{rejected=true;}check(rejected,'Callback entry point rejects table tools');
  check(document.execCommand('bold')===false,'Programmatic formatting denied');
  const event=new KeyboardEvent('keydown',{key:'b',ctrlKey:true,cancelable:true,bubbles:true});editor.dispatchEvent(event);check(event.defaultPrevented,'Formatting shortcut blocked');
  const escape=new KeyboardEvent('keydown',{key:'Escape',cancelable:true,bubbles:true});editor.dispatchEvent(escape);check(escape.defaultPrevented && editor.isConnected,'Escape does not terminate');
  const clip=new DataTransfer();clip.setData('text/plain','plain words');clip.setData('text/html','<img src=x><b>rich</b>');
  select(editor.querySelector('#cell').firstChild,0,4);editor.dispatchEvent(new ClipboardEvent('paste',{clipboardData:clip,bubbles:true,cancelable:true}));
  check(editor.querySelector('#cell').textContent==='plain words' && !editor.querySelector('#cell img'),'Paste inserts only plain text');document.execCommand('undo');
  const node=editor.querySelector('#passage').firstChild;select(node,0,250);document.execCommand('delete');append(' '+Array(100).fill('new').join(' '));
  await wait(()=>document.querySelector('#nv-session-root').textContent.includes('+50 / 100'));check(saved.length===0,'Deletion then writing measures net +50, no completion');
  document.execCommand('undo');await wait(()=>document.querySelector('#nv-session-root').textContent.includes('-50 / 100'));check(true,'Undo decreases net count');
  document.execCommand('redo');await wait(()=>document.querySelector('#nv-session-root').textContent.includes('+50 / 100'));check(true,'Redo increases net count');
  await dispatchNodevisionCommand('editor.save');check(saved.length===1,'Command save routed to owned HTML editor');
  check(document.querySelector('#nv-session-root').textContent.includes('+50 / 100'),'Saving does not reset baseline');
  append(' '+Array(50).fill('finish').join(' '));await wait(()=>document.querySelector('#nv-session-root').textContent.includes('Bridging — saved'));
  check(saved.length===2,'Target completion saves once');check(editor.querySelector('#heading')===originalHeading && editor.querySelector('#table')===originalTable,'Unchanged live nodes preserved');
  const parsed=new DOMParser().parseFromString(saved.at(-1).content,'text/html');
  check(parsed.querySelector('meta[name=test]')?.content==='retained' && parsed.body.className==='writing','Head metadata and body attributes preserved');
  check(parsed.querySelector('#passage').className==='prose' && parsed.querySelector('#cell').textContent==='cell','Classes IDs and table structure preserved');
  check(!saved.at(-1).content.includes('nv-bridging') && !saved.at(-1).content.includes('End Session'),'Session controls excluded from saved document');
  button('Return to workspace').click();check(host.contains(editor),'Borrowed editor returns to its owner');
  const reopenHost=document.createElement('div');document.body.append(reopenHost);const releaseReopened=await renderEditor('reopened.html',reopenHost);
  check(reopenHost.querySelector('#passage').className==='prose' && reopenHost.querySelector('#cell').textContent==='cell','Saved HTML reopens in graphical editor with structure intact');releaseReopened();reopenHost.remove();ctx.activate();
  await open({growth:1000,seconds:1});begin();fail=true;await wait(()=>document.querySelector('#nv-session-root').textContent.includes('Save failed'));
  check(editor.isConnected && button('Retry save').hidden===false,'Timer save failure retains editor and retry');fail=false;button('Retry save').click();await wait(()=>document.querySelector('#nv-session-root').textContent.includes('Ended: timer'));check(true,'Timer summary after successful retry');button('Return to workspace').click();
  await open({growth:1000,seconds:1});begin();editor.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));await new Promise(r=>setTimeout(r,1100));
  check(!document.querySelector('#nv-session-root').textContent.includes('Bridging — saved'),'Timer completion waits for composition');
  editor.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true}));await wait(()=>document.querySelector('#nv-session-root').textContent.includes('Bridging — saved'));button('Return to workspace').click();
  await open();button('Choose HTML document').click();await wait(()=>document.querySelector('dialog')?.textContent.includes('other.html'));
  [...document.querySelectorAll('dialog button')].find(b=>b.textContent==='other.html').click();
  await wait(()=>document.querySelector('#nv-session-root').textContent.includes('other.html') && !button('Begin writing').disabled);
  check(window.__nvActiveHtmlEditorContext.filePath==='other.html','Notebook picker mounts the real HTML editor for another document');begin();
  const owned=window.__nvActiveHtmlEditorContext.editorElement;owned.focus();const ownedRange=document.createRange();ownedRange.selectNodeContents(owned.querySelector('#cell'));getSelection().removeAllRanges();getSelection().addRange(ownedRange);document.execCommand('insertText',false,'recover');
  cleanup();document.getElementById('nv-session-root').remove();
  check(owned.isConnected && [...document.querySelectorAll('button')].some(b=>b.textContent==='Save and close'),'Unexpected cleanup retains dirty newly mounted editor');
  [...document.querySelectorAll('button')].find(b=>b.textContent==='Save and close').click();await wait(()=>!owned.isConnected);
  check(window.__nvActiveHtmlEditorContext===ctx,'Recovery save restores previous editor ownership');
  await open();window.__bridgingNewDocumentRequest={filename:'new.html',useTemplate:false};button('New HTML document').click();
  await wait(()=>window.__nvActiveHtmlEditorContext?.filePath==='new.html' && !button('Begin writing').disabled);
  check(createdPath==='new.html','Standard New Document workflow creates and loads HTML');button('Cancel').click();window.__bridgingNewDocumentRequest=null;
  // Native key/mouse cases run after setup via Chromium DevTools.
  await open({growth:1000});begin();
  window.bridgingTest={
    saveCount(){return saved.length;},
    saved(n){check(saved.length===n+1,'Native Ctrl+S saves the owned document');},
    prepare(){const node=editor.querySelector('#cell').firstChild;select(node,2);return true;},
    caret(offset){check(getSelection().focusOffset===offset,'Native caret offset '+offset);},
    replace(){const node=editor.querySelector('#cell').firstChild;select(node,0,node.length);},
    text(text){check(editor.querySelector('#cell').textContent===text,'Native text edit '+text);},
    mouse(){const node=editor.querySelector('#heading').firstChild,range=document.createRange();range.setStart(node,1);range.setEnd(node,2);const rect=range.getBoundingClientRect();return {x:rect.x+2,y:rect.y+rect.height/2};},
    clicked(){check(editor.querySelector('#heading').contains(getSelection().anchorNode),'Click positions caret in existing heading');},
    async finish(){
      const n=saved.length;button('End Session').click();await wait(()=>document.querySelector('#nv-session-root').textContent.includes('Ended: manual'));check(saved.length===n+1,'Manual end saves once');button('Return to workspace').click();
      check(document.execCommand('bold')!==false,'Formatting restored outside Session');
      const large=document.createElement('div');large.contentEditable='true';large.style.cssText='height:100px;overflow:auto';large.innerHTML=Array(2000).fill('<p>'+Array(50).fill('word').join(' ')+'</p>').join('');document.body.append(large);
      const start=performance.now(),count=createBridgingWordCount(large);check(count.count===100000,'Large document count accurate');const initial=performance.now()-start;
      const before=performance.now();for(let i=0;i<1000;i++)count.flush();check(performance.now()-before<50,'Clean count reads cached');const editStart=performance.now();large.firstElementChild.firstChild.data+=' added';check(count.flush()===100001,'Changed-block count updates synchronously');const editMs=performance.now()-editStart;check(editMs<100,'Large document recount remains localized');
      count.dispose();large.replaceChildren();large.innerHTML='<span>one</span><span>word</span>';const inline=createBridgingWordCount(large);check(inline.count===1,'Adjacent inline runs retain word boundaries');inline.dispose();large.remove();
      return `PASS: ${checks} Bridging browser checks; 100,000-word initial count ${initial.toFixed(1)} ms; changed-block recount ${editMs.toFixed(1)} ms`;
    }
  };
  document.getElementById('result').textContent='PASS: Bridging fixture ready';
}catch(error){document.getElementById('result').textContent='FAIL: '+error.stack;}
