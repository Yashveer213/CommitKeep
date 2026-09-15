'use client';

import { useEffect, useState } from 'react';

type InstallPromptEvent=Event&{prompt():Promise<void>;userChoice:Promise<{outcome:'accepted'|'dismissed'}>};

export default function PwaRegistration() {
  const [update,setUpdate]=useState<ServiceWorker|null>(null);const [install,setInstall]=useState<InstallPromptEvent|null>(null);const [ios,setIos]=useState(false);
  useEffect(() => {
    if (!('serviceWorker' in navigator) || process.env.NODE_ENV !== 'production') return;
    let refreshing=false;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(!refreshing){refreshing=true;location.reload()}});
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).then(registration=>{if(registration.waiting)setUpdate(registration.waiting);registration.addEventListener('updatefound',()=>{const worker=registration.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)setUpdate(worker)})})}).catch(() => undefined);
    const beforeInstall=(event:Event)=>{event.preventDefault();setInstall(event as InstallPromptEvent)};window.addEventListener('beforeinstallprompt',beforeInstall);queueMicrotask(()=>setIos(/iphone|ipad|ipod/i.test(navigator.userAgent)&&!(navigator as Navigator&{standalone?:boolean}).standalone));return()=>window.removeEventListener('beforeinstallprompt',beforeInstall);
  }, []);
  if(update)return <aside className="pwa-notice" role="status"><span>A new Commit-Keep version is ready.</span><button onClick={()=>update.postMessage({type:'SKIP_WAITING'})}>Update</button></aside>;
  if(install)return <aside className="pwa-notice"><span>Install Commit-Keep for quicker access.</span><button onClick={async()=>{await install.prompt();await install.userChoice;setInstall(null)}}>Install</button></aside>;
  if(ios)return <aside className="pwa-notice"><span>Install on iPhone or iPad from Share → Add to Home Screen.</span><button onClick={()=>setIos(false)}>Got it</button></aside>;
  return null;
}
