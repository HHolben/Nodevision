// Nodevision/scripts/php-editor-browser.mjs
// This fixture verifies the PHP editor module boundaries through editing, previews, tool panels, save commands and disposal without writing Notebook files.
import { renderEditor } from '/PanelInstances/EditorPanels/GraphicalEditors/PHPeditor.mjs';
const ok=(value,message)=>{if(!value)throw Error(message);};
const originalFetch=window.fetch;
let saved=null;
window.fetch=async (url,options)=>{
  if(url==='/Notebook/fixture.php')return new Response('<?php echo "fixture"; ?>');
  if(url==='/api/save'){saved=JSON.parse(options.body);return Response.json({success:true});}
  return originalFetch(url,options);
};
try {
  window.NodevisionState={};
  const host=document.getElementById('editor');
  for(const name of ['device-manager','logic-editor','dashboard-config','logging']){
    const panel=document.createElement('div');panel.className='panel';
    panel.dataset.instanceId=`nv-php-${name}-panel`;
    panel.innerHTML='<div class="panel-content"></div>';document.body.append(panel);
  }
  const editor=await renderEditor('fixture.php',host);
  editor.state.runtimeEnabled=false;
  const input=host.querySelector('textarea');
  input.value='<?php echo "updated"; ?>';input.dispatchEvent(new Event('input'));
  ok(editor.state.code===input.value,'input updates shared state');
  ok(host.querySelector('iframe').srcdoc.includes('updated'),'preview updates');
  ok(host.querySelectorAll('.nv-php-widget').length===4,'dashboard mounts');
  const command=async name=>{
    window.dispatchEvent(new CustomEvent('nv-php-editor-command',{detail:{command:name}}));
    await new Promise(resolve=>setTimeout(resolve,30));
  };
  for(const name of ['device-manager','logic-editor','dashboard-config','data-logging'])await command(name);
  ok(document.querySelectorAll('.nv-php-card').length>=5,'tool panels build');
  await command('save');ok(saved.path==='fixture.php'&&saved.content===input.value,'save uses current code');
  await command('toggle-preview');ok(editor.state.runtimeEnabled,'runtime resumes');
  for(let i=0;i<200&&!editor.state.logging.records.length;i++)await new Promise(resolve=>setTimeout(resolve,20));
  ok(editor.state.logging.records.length>0,'runtime logs');
  editor.dispose();const count=editor.state.logging.records.length;saved=null;
  await command('save');ok(saved===null,'command listener removed');
  await new Promise(resolve=>setTimeout(resolve,60));ok(editor.state.logging.records.length===count,'animation stops');
  ok(!window.saveMDFile,'save hooks removed');
  document.getElementById('result').textContent='PASS: PHP editing, preview, dashboard, tool panels, save, runtime and disposal';
} catch(error){document.getElementById('result').textContent='FAIL: '+error.stack;}
finally {window.fetch=originalFetch;}
