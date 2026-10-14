import { test, expect } from '@playwright/test';
import { api, createProject } from './helpers';
import { MANAGER_STORAGE, MEMBER_STORAGE } from './global-setup';
import { MANAGER_USER_FILE, MEMBER_USER_FILE } from './global-setup';
import { readFileSync } from 'node:fs';
import { chooseMessageAction } from './chat-actions';
import tr from '../src/i18n/messages/tr.json';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==','base64');
test.use({actionTimeout:15000});

test('central messaging keeps a DM across projects, uploads a real file and publishes exact read info',async({browser})=>{
 test.setTimeout(180000);
 const a=await browser.newContext({storageState:MANAGER_STORAGE}),b=await browser.newContext({storageState:MEMBER_STORAGE});
 for(const [context,file,storage] of [[a,MANAGER_USER_FILE,MANAGER_STORAGE],[b,MEMBER_USER_FILE,MEMBER_STORAGE]] as const) {
  const account=JSON.parse(readFileSync(file,'utf8')) as {email:string;password:string};
  await context.request.get('http://localhost:8080/api/v1/auth/csrf');
  const csrf=(await context.cookies()).find(cookie=>cookie.name==='XSRF-TOKEN')!;
  const response=await context.request.post('http://localhost:8080/api/v1/auth/login',{headers:{'X-XSRF-TOKEN':decodeURIComponent(csrf.value),Origin:'http://localhost:3000'},data:{email:account.email,password:account.password}});
  expect(response.status()).toBe(200);
  await context.storageState({path:storage});
 }
 const manager=await a.newPage(),member=await b.newPage();
 const errors:string[]=[];manager.on('pageerror',e=>errors.push(e.message));member.on('pageerror',e=>errors.push(e.message));
 try{
  await manager.goto('/dashboard');await member.goto('/dashboard');
  const me=(await api(manager,'GET','/auth/me')).json as {id:string};const peer=(await api(member,'GET','/auth/me')).json as {id:string;nickname:string};
  const names=[`Central A ${Date.now()}`,`Central B ${Date.now()}`];const slugs:string[]=[];
  for(const name of names){const slug=await createProject(manager,name);slugs.push(slug);const project=(await api(manager,'GET',`/projects/by-slug/${slug}`)).json as {id:string};const team=(await api(manager,'POST',`/projects/${project.id}/teams`,{name:'Chat team'})).json as {id:string};const invite=(await api(manager,'POST',`/projects/${project.id}/invitations`,{userId:peer.id,roles:['TESTER'],teamId:team.id})).json as {invitationId:string;token:string};expect((await api(member,'POST',`/projects/${project.id}/invitations/${invite.invitationId}/accept`,{token:invite.token})).status).toBe(200);}
  const dm=(await api(manager,'POST',`/chat/direct/${peer.id}`)).json as {id:string};
  await manager.getByTestId('chat-nav-item').click();await expect(manager.getByTestId('chat-panel')).toBeVisible();
  await manager.getByRole('navigation',{name:tr.chat.conversations}).locator(`[aria-label="${tr.chat.categories.label}"]`).getByRole('button',{name:tr.chat.categories.projects,exact:true}).click();for(const name of names)await expect(manager.getByTestId('chat-conversation-group').filter({hasText:name})).toBeVisible();
  await manager.getByRole('navigation',{name:tr.chat.conversations}).locator(`[aria-label="${tr.chat.categories.label}"]`).getByRole('button',{name:tr.chat.categories.direct,exact:true}).click();await manager.locator(`[data-peer-id="${peer.id}"]`).click();
  await expect(manager.getByTestId('chat-composer')).toBeEnabled();
  const text=`Central message ${Date.now()}`;await manager.getByTestId('chat-composer').fill(text);await manager.getByTestId('chat-send').click();await expect(manager.getByTestId('chat-message-text').filter({hasText:text})).toBeVisible();
  await manager.getByTestId('chat-minimize').click();await manager.getByRole('link',{name:'Projeler',exact:true}).click();
  await expect(manager).toHaveURL(/\/projeler$/);
  await manager.locator(`a[href$="/${slugs[0]}/genel-bakis"]`).first().click();
  await expect(manager).toHaveURL(url=>url.pathname.endsWith(`/${slugs[0]}/genel-bakis`));
  await expect(manager.getByRole('heading',{name:names[0],exact:true})).toBeVisible();
  await manager.getByTestId('chat-nav-item').click();await expect(manager.getByTestId('chat-message-text').filter({hasText:text})).toBeVisible();
  const info=await api(manager,'GET',`/chat/conversations/${dm.id}/messages`);const message=(info.json as {messages:{id:string;content:string}[]}).messages.find(m=>m.content===text)!;
  const initial=await api(manager,'GET',`/chat/conversations/${dm.id}/messages/${message.id}/info`);expect((initial.json as {readers:{readAt:string|null}[]}).readers[0].readAt).toBeNull();
  await manager.getByTestId('chat-conversation').locator('input[type="file"]').setInputFiles({name:'central.png',mimeType:'image/png',buffer:png});await expect(manager.getByTestId('chat-file-preview')).toContainText('central.png');await manager.getByTestId('chat-send').click();await expect(manager.getByTestId('chat-message-attachment').last()).toBeVisible();
  await expect(manager.getByTestId('chat-conversation').locator('input[type="file"]')).toBeEnabled();
  await manager.getByTestId('chat-conversation').locator('input[type="file"]').setInputFiles({name:'huge.pdf',mimeType:'application/pdf',buffer:Buffer.alloc(2097153)});await expect(manager.getByText('Dosya başına en fazla 2 MB gönderebilirsiniz.')).toBeVisible();
  await member.getByTestId('chat-nav-item').click();await member.getByRole('navigation',{name:tr.chat.conversations}).locator(`[aria-label="${tr.chat.categories.label}"]`).getByRole('button',{name:tr.chat.categories.direct,exact:true}).click();await member.locator(`[data-peer-id="${me.id}"]`).click();await expect(member.getByTestId('chat-message-text').filter({hasText:text})).toBeVisible();
  await expect.poll(async()=>{const r=await api(manager,'GET',`/chat/conversations/${dm.id}/messages/${message.id}/info`);return (r.json as {readers:{readAt:string|null}[]}).readers[0].readAt;}).not.toBeNull();
  const bubble=manager.locator(`[data-message-id="${message.id}"]`);await bubble.getByTestId('chat-message-actions').click();await manager.getByTestId('chat-message-info').click();await expect(manager.getByRole('dialog')).toContainText('Okuyanlar (1)');await expect(manager.getByRole('dialog')).toContainText(peer.nickname);await manager.keyboard.press('Escape');await expect(manager.getByTestId('chat-panel')).toBeVisible();
  const fileMessage=manager.getByTestId('chat-message').filter({has:manager.getByTestId('chat-message-attachment')}).last();
  await chooseMessageAction(fileMessage,'reply');await expect(manager.getByTestId('chat-reply-context')).toContainText('central.png');
  const replyText=`File reply ${Date.now()}`;await manager.getByTestId('chat-composer').fill(replyText);await manager.getByTestId('chat-send').click();
  const reply=manager.getByTestId('chat-message').filter({hasText:replyText});await expect(reply.getByTestId('chat-reply-quote')).toContainText('central.png');
  const received=member.getByTestId('chat-message').filter({hasText:replyText});await expect(received).toBeVisible();await chooseMessageAction(received,'react');await member.getByTestId('emoji-THUMBS_UP').click();await expect(reply.getByTestId('chat-reaction-THUMBS_UP')).toContainText('1');
  const replyId = (await reply.getAttribute('data-message-id'))!;
  await reply.getByTestId('chat-message-actions').click();await manager.getByTestId('chat-message-delete').click();await manager.getByTestId('chat-delete-confirm').click();await expect(manager.locator(`[data-message-id="${replyId}"]`).getByTestId('chat-message-deleted')).toBeVisible();await expect(manager.getByTestId('chat-message-text').filter({hasText:replyText})).toHaveCount(0);await expect(member.locator(`[data-message-id="${replyId}"]`).getByTestId('chat-message-deleted')).toBeVisible();await expect(member.getByTestId('chat-message-text').filter({hasText:replyText})).toHaveCount(0);
  await manager.setViewportSize({width:390,height:844});await manager.locator(`[data-peer-id="${peer.id}"]`).click();await expect(manager.getByTestId('chat-composer')).toBeVisible();await manager.screenshot({path:'../.local/chat-central-mobile.png'});
  expect(await manager.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  await manager.setViewportSize({width:1440,height:1000});await manager.screenshot({path:'../.local/chat-central-desktop.png'});
  expect(errors).toEqual([]);
 }finally{await Promise.allSettled([a.close(),b.close()]);}
});
