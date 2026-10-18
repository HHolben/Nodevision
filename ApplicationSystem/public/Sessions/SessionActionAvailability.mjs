// Nodevision/ApplicationSystem/public/Sessions/SessionActionAvailability.mjs
// Session owners can veto application entry points without a global policy singleton or changing availability outside that Session.
export function sessionActionAvailable(action, target = globalThis.document) {
  if(!target?.dispatchEvent)return true;
  return target.dispatchEvent(new CustomEvent('nodevision-session-action', {cancelable:true,detail:{action}}));
}
export function assertSessionActionAvailable(action) {
  if(!sessionActionAvailable(action))throw Error('This action is unavailable during the active writing Session.');
}

export function interceptSessionCommand(id) {
  const detail={id,result:undefined};
  const event=new CustomEvent('nodevision-session-command',{cancelable:true,detail});
  globalThis.document?.dispatchEvent(event);
  return {handled:event.defaultPrevented,result:detail.result};
}
