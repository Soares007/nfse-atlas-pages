const $=id=>document.getElementById(id),escapeHTML=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));let data={cities:[],particularities:[],sources:{},changes:[]},tab='cities',page=0,selected=null,explicitCity=null;const size=12;const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();const fields=c=>c.fields||{};const provider=c=>fields(c).Provedor||fields(c).Provider||'Não informado';const name=c=>fields(c).Nome||fields(c).Municipio||'Município não informado';const uf=c=>fields(c).UF||'';const label=v=>v||'Não informado';const date=v=>v?new Date(v).toLocaleString('pt-BR'):'Ainda não disponível';const titleCase=s=>s.replace(/([a-z])([A-Z])/g,'$1 $2');function notify(s){const n=document.createElement('div');n.className='toast';n.textContent=s;document.body.append(n);setTimeout(()=>n.remove(),2500)}function filters(){return {q:norm($('query').value.trim()),uf:$('uf').value,provider:$('provider').value,cap:$('capability').value,env:$('environment').value}}// Relevância: cidade/IBGE exatos primeiro, depois prefixo, palavras e demais campos.
// Endpoints só entram como correspondência secundária: um domínio com "itu" não
// deve esconder o município de Itu em páginas posteriores.
function searchScore(c,q,isCity){
 if(!q)return 0;
 const v=isCity?fields(c):{};
 const primary=isCity?name(c):c.name;
 const code=isCity?String(c.id||''):String(c.version||'');
 const prov=isCity?provider(c):c.name;
 const n=norm(primary),p=norm(prov),id=norm(code);
 const words=q.split(/\s+/).filter(Boolean);
 const all=isCity?norm([c.id,...Object.values(v)].join(' ')):norm([c.name,c.version].join(' '));
 if(!words.every(w=>all.includes(w)))return -1;
 if(n===q||id===q)return 10000;
 if(n.startsWith(q))return 8000;
 if(n.split(/[^a-z0-9]+/).some(w=>w.startsWith(q)))return 6500;
 if(n.includes(q))return 5000;
 if(id.startsWith(q))return 4800;
 if(p===q)return 4200;
 if(p.startsWith(q))return 3500;
 if(p.includes(q))return 2800;
 const nonEndpoint=isCity?norm(Object.entries(v).filter(([k])=>!/(recepcionar|consultar|cancelar|substituir|url|endpoint|soap|wsdl)/i.test(k)).map(([,val])=>val).join(' ')):all;
 if(nonEndpoint.includes(q))return 1600;
 return 500;
}
function uniqueProviders(items){
 const result=new Map();
 for(const p of items){
  const key=norm(p.name).trim()+'|'+norm(p.version).trim();
  if(!result.has(key))result.set(key,{...p,flags:[...p.flags]});
  else result.get(key).flags=result.get(key).flags.map((flag,i)=>Boolean(flag||p.flags[i]));
 }
 return [...result.values()];
}
function filtered(){
 const f=filters(),capIdx={layout:0,cert:1,emit:2,cancel:3,replace:4}[f.cap];
 const rows=tab==='cities'?data.cities.filter(c=>{
  const v=fields(c);
  if(f.uf&&uf(c)!==f.uf)return false;
  if(f.provider&&norm(provider(c))!==norm(f.provider))return false;
  if(f.env&&!Object.keys(v).some(k=>f.env==='prod'?/^pro/i.test(k):/^hom/i.test(k)))return false;
  if(f.cap&&!data.particularities.some(r=>norm(r.name)===norm(provider(c))&&r.flags[capIdx]))return false;
  return true;
 }):uniqueProviders(data.particularities).filter(p=>{
  if(f.provider&&norm(p.name)!==norm(f.provider))return false;
  if(f.cap&&!p.flags[capIdx])return false;
  if(f.uf&&!data.cities.some(c=>uf(c)===f.uf&&norm(provider(c))===norm(p.name)))return false;
  if(f.env&&!data.cities.some(c=>norm(provider(c))===norm(p.name)&&Object.keys(fields(c)).some(k=>f.env==='prod'?/^pro/i.test(k):/^hom/i.test(k))))return false;
  return true;
 });
 const isCity=tab==='cities';
 return rows.map((item,index)=>({item,index,score:searchScore(item,f.q,isCity)}))
  .filter(x=>x.score>=0)
  .sort((a,b)=>b.score-a.score||(isCity?name(a.item).localeCompare(name(b.item),'pt-BR'):a.item.name.localeCompare(b.item.name,'pt-BR'))||a.index-b.index)
  .map(x=>x.item);
}
function opts(){const f=filters();const ufs=[...new Set(data.cities.map(uf).filter(Boolean))].sort();const ps=[...new Set([...data.cities.map(provider),...data.particularities.map(x=>x.name)].filter(x=>x!=='Não informado'))].sort((a,b)=>a.localeCompare(b));$('uf').innerHTML='<option value="">Todas as UFs</option>'+ufs.map(x=>`<option ${x===f.uf?'selected':''}>${escapeHTML(x)}</option>`).join('');$('provider').innerHTML='<option value="">Todos os provedores</option>'+ps.map(x=>`<option ${x===f.provider?'selected':''}>${escapeHTML(x)}</option>`).join('')}function keyOf(c){return tab==='cities'?'city:'+c.id:'provider:'+c.name+':'+c.version}
function render(){
 const list=filtered(),pages=Math.max(1,Math.ceil(list.length/size));page=Math.min(page,pages-1);
 $('count').textContent=`${list.length.toLocaleString('pt-BR')} resultado(s) · ${tab==='cities'?'Municípios':'Versões de provedores'}`;
 $('pageinfo').textContent=`Página ${page+1} de ${pages}`;$('prev').disabled=page===0;$('next').disabled=page>=pages-1;
 const chunk=list.slice(page*size,(page+1)*size);
 if(!chunk.some(c=>keyOf(c)===selected))selected=null;
 $('results').innerHTML=chunk.length?chunk.map((c,i)=>tab==='cities'?`<article class="result ${keyOf(c)===selected?'active':''}" role="button" tabindex="0" data-item="${i}"><h3>${escapeHTML(name(c))} <span class="chip">${escapeHTML(uf(c))}</span></h3><p>${escapeHTML(provider(c))} · IBGE ${escapeHTML(c.id)}</p></article>`:`<article class="result ${keyOf(c)===selected?'active':''}" role="button" tabindex="0" data-item="${i}"><h3>${escapeHTML(c.name)} <span class="chip">v${escapeHTML(c.version)}</span></h3><p>${c.flags.filter(Boolean).length} capacidades documentadas</p></article>`).join(''):'<div class="empty"><b>Nenhum resultado encontrado</b>Remova algum filtro ou tente outro termo.</div>';
 $('results').querySelectorAll('[data-item]').forEach(el=>{const choose=()=>{selected=keyOf(chunk[Number(el.dataset.item)]);if(tab==='cities')explicitCity=selected;render()};el.onclick=choose;el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose()}}});
 const chosen=chunk.find(c=>keyOf(c)===selected);if(chosen)openDetail(chosen);else $('detail').innerHTML='<div class="empty"><b>Sem dados para exibir</b>Selecione um município ou provedor na lista para visualizar os detalhes.</div>';
}
function openDetail(c){
 const isCity=tab==='cities',v=isCity?fields(c):{},matches=isCity?uniqueProviders(data.particularities).filter(p=>norm(p.name)===norm(provider(c))):[c];
 const field=(k,val,extra='')=>`<div class="field ${extra}"><label>${escapeHTML(titleCase(k))}<button class="copy" data-copy="${escapeHTML(val)}" aria-label="Copiar ${escapeHTML(k)}">Copiar ↗</button></label><div class="value">${escapeHTML(label(val))}</div></div>`;
 let html=`<div class="detailheader"><div><span class="eyebrow">${isCity?'Ficha do município':'Ficha do provedor'}</span><h3>${escapeHTML(isCity?name(c):c.name)}</h3><span class="tiny">${isCity?`${escapeHTML(uf(c))} · ${escapeHTML(provider(c))} · ${escapeHTML(c.id)}`:`Versão ${escapeHTML(c.version)}`}</span></div></div>`;
 if(isCity){html+=`<section class="detailsection"><h4>Identificação</h4><div class="detailgrid">${field('Código IBGE',c.id)}${field('Município',name(c))}${field('UF',uf(c))}${field('Provedor',provider(c))}</div></section>`;
 const endpoints=Object.entries(v).filter(([k])=>/(recepcionar|consultar|cancelar|substituir|url|endpoint|soap|wsdl)/i.test(k));
 html+=`<section class="detailsection"><h4>Endpoints e webservices</h4>${endpoints.length?`<div class="detailgrid">${endpoints.map(([k,val])=>field(k,val,'endpointfield')).join('')}</div>`:'<p class="tiny">Nenhum endpoint informado no INI.</p>'}</section>`;
 const other=Object.entries(v).filter(([k])=>!['Nome','Municipio','UF','Provedor','Provider'].includes(k)&&!endpoints.some(([e])=>e===k));
 if(other.length)html+=`<section class="detailsection"><h4>Outras configurações do INI</h4><div class="detailgrid">${other.map(([k,val])=>field(k,val)).join('')}</div></section>`;
 }
 html+=`<section class="detailsection"><h4>Particularidades de emissão · ${escapeHTML(isCity?provider(c):c.name)}</h4>`;
 if(matches.length){html+=matches.map(p=>`<div class="versionline">Versão ${escapeHTML(p.version)}</div><div class="capgrid">${['Layout próprio','Certificado','Emitir','Cancelar','Substituir'].map((k,i)=>`<div class="capitem ${p.flags[i]?'':'no'}"><b>${p.flags[i]?'✓':'—'}</b>${k}</div>`).join('')}</div>`).join('');html+='<p class="tiny" style="margin-top:14px">— indica recurso não assinalado na documentação, não necessariamente indisponível.</p>'}else html+='<p class="tiny">Não há particularidades confirmadas para este provedor na fonte consultada.</p>';
 html+='</section>';
 if(!isCity)html+=`<section class="detailsection"><h4>Municípios vinculados</h4><p class="tiny">${data.cities.filter(x=>norm(provider(x))===norm(c.name)).length} município(s) na base ACBr</p></section>`;
 $('detail').innerHTML=html;$('detail').classList.remove('hidden');$('detail').querySelectorAll('[data-copy]').forEach(b=>b.onclick=()=>navigator.clipboard.writeText(b.dataset.copy).then(()=>notify('Copiado')).catch(()=>notify('Não foi possível copiar')));
}
function sources(){const names={ini:'Base de municípios · ACBr INI',forum:'Particularidades · Fórum ACBr'};$('sources').innerHTML=['ini','forum'].map(k=>{const s=data.sources?.[k]||{};return `<article class="source"><div class="sourcehead"><h3>${names[k]}</h3><span class="status ${escapeHTML(s.status||'')}">${s.status==='ok'?'● Sincronizada':s.status==='error'?'● Falha na consulta':'● Aguardando'}</span></div><p>${Number(s.count||0).toLocaleString('pt-BR')} registros · Última verificação: ${escapeHTML(date(s.checkedAt))}<br>Última alteração detectada: ${escapeHTML(date(s.updatedAt))}</p>${s.error?`<p style="color:var(--red)">Erro: ${escapeHTML(s.error)}</p>`:''}<a href="${escapeHTML(s.url||'#')}" target="_blank" rel="noopener noreferrer">Abrir fonte original ↗</a></article>`}).join('');$('timeline').innerHTML=(data.changes||[]).length?data.changes.slice(0,12).map(x=>`<div class="timelineitem"><span class="dot"></span><div><b>${escapeHTML(x.description)}</b><p>${escapeHTML(date(x.at))}</p></div></div>`).join(''):'<div class="empty"><b>Nenhuma alteração registrada</b>As alterações identificadas aparecerão aqui depois de sincronizações bem-sucedidas.</div>';$('topstatus').textContent=Object.values(data.sources||{}).some(s=>s.status==='error')?'Uma fonte indisponível':Object.values(data.sources||{}).length===2&&Object.values(data.sources).every(s=>s.status==='ok')?'Fontes sincronizadas':'Aguardando sincronização'}async function load(){try{const r=await fetch('./data.json',{cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);data=await r.json();data.particularities=uniqueProviders(data.particularities||[]);$('statcities').textContent=data.cities.length.toLocaleString('pt-BR');$('statproviders').textContent=new Set([...data.cities.map(provider),...data.particularities.map(p=>p.name)]).size.toLocaleString('pt-BR');$('statversions').textContent=data.particularities.length.toLocaleString('pt-BR');$('statupdates').textContent=(data.changes||[]).length;opts();render();sources()}catch(e){$('count').textContent='Não foi possível carregar os dados publicados';$('results').innerHTML='<div class="empty"><b>Base indisponível</b>A base de consulta está temporariamente indisponível.</div>';notify('Não foi possível carregar os dados')}}// Cada aba guarda sua própria pesquisa, filtros, página e seleção.
const tabStates={
 cities:{query:'',uf:'',provider:'',environment:'',capability:'',page:0,selected:null,explicitCity:null},
 providers:{query:'',uf:'',provider:'',environment:'',capability:'',page:0,selected:null,explicitCity:null}
};
const filterIds=['query','uf','provider','environment','capability'];
function saveTabState(){
 const state=tabStates[tab];
 for(const id of filterIds)state[id]=$(id).value;
 state.page=page;state.selected=selected;state.explicitCity=explicitCity;
}
function restoreTabState(next){
 const state=tabStates[next];
 for(const id of filterIds)$(id).value=state[id];
 page=state.page;selected=state.selected;explicitCity=state.explicitCity;
}
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{
 const next=b.dataset.tab;
 if(next===tab)return;
 saveTabState();
 if(next==='providers'&&tab==='cities'){
  const city=explicitCity?data.cities.find(c=>'city:'+c.id===explicitCity):null;
  // Só transfere o provedor quando o usuário selecionou uma cidade de fato.
  if(city){
   const providerName=provider(city);
   // Se houver várias versões, abrir a primeira versão da lista ordenada.
   const matching=uniqueProviders(data.particularities||[])
     .filter(p=>norm(p.name)===norm(providerName))
     .sort((a,b)=>String(a.version).localeCompare(String(b.version),'pt-BR',{numeric:true}));
   tabStates.providers={
    query:providerName,uf:'',provider:'',environment:'',capability:'',page:0,
    selected:matching.length?'provider:'+matching[0].name+':'+matching[0].version:null,
    explicitCity:null
   };
  }
 }
 tab=next;
 restoreTabState(next);
 document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t===b));
 render();
});
['query','uf','provider','capability','environment'].forEach(id=>$(id).addEventListener(id==='query'?'input':'change',()=>{page=0;selected=null;explicitCity=null;render()}));$('clear').onclick=()=>{['query','uf','provider','capability','environment'].forEach(id=>$(id).value='');page=0;selected=null;explicitCity=null;render()};$('prev').onclick=()=>{page--;render();$('consulta').scrollIntoView({block:'start',behavior:'smooth'})};$('next').onclick=()=>{page++;render();$('consulta').scrollIntoView({block:'start',behavior:'smooth'})};$('theme').onclick=()=>{document.body.classList.toggle('light');localStorage.setItem('nfse-theme',document.body.classList.contains('light')?'light':'dark')};if(localStorage.getItem('nfse-theme')==='light')document.body.classList.add('light');load();setInterval(load,30000);

// Atalho de pesquisa: Ctrl+K / Cmd+K, Escape limpa o termo.
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('query').focus();$('query').select()}else if(e.key==='Escape'&&document.activeElement===$('query')){$('query').value='';page=0;render();$('query').blur()}});
