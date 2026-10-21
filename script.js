const $=id=>document.getElementById(id);
const fmtNumber=(value,digits=2)=>new Intl.NumberFormat('es-CO',{minimumFractionDigits:digits,maximumFractionDigits:digits}).format(value);
const menuToggle=document.querySelector('.menu-toggle'),navLinks=$('nav-links');
menuToggle?.addEventListener('click',()=>{const open=navLinks.classList.toggle('open');menuToggle.setAttribute('aria-expanded',String(open))});
navLinks?.querySelectorAll('a').forEach(link=>link.addEventListener('click',()=>{navLinks.classList.remove('open');menuToggle?.setAttribute('aria-expanded','false')}));
if($('year')) $('year').textContent=new Date().getFullYear();

const track=$('ticker-track'),viewport=document.querySelector('.ticker-viewport');
let tickerCycle=null;
if(track){
  tickerCycle=document.createElement('div');tickerCycle.className='ticker-cycle';
  while(track.firstChild)tickerCycle.append(track.firstChild);
  track.append(tickerCycle);
}
function sizeTicker(){
  if(!track||!viewport||!tickerCycle)return;
  track.querySelector('.ticker-copy')?.remove();
  tickerCycle.style.minWidth=viewport.clientWidth+'px';
  const width=tickerCycle.getBoundingClientRect().width;
  const copy=tickerCycle.cloneNode(true);copy.classList.add('ticker-copy');
  copy.setAttribute('aria-hidden','true');copy.inert=true;
  copy.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));
  track.append(copy);
  track.style.setProperty('--ticker-travel',-width+'px');
  track.style.setProperty('--ticker-duration',Math.max(20,width/38)+'s');
}
function setTickerPaused(paused){
  track?.classList.toggle('ticker-paused',paused);
  $('ticker-pause')?.setAttribute('aria-pressed',String(paused));
  $('ticker-pause')?.setAttribute('aria-label',paused?'Reanudar desplazamiento':'Pausar desplazamiento');
  if($('ticker-pause'))$('ticker-pause').textContent=paused?'▶':'Ⅱ';
}
if(track&&viewport){
  new ResizeObserver(sizeTicker).observe(viewport);
  document.fonts?.ready.then(sizeTicker);
  const motionPreference=matchMedia('(prefers-reduced-motion: reduce)');
  setTickerPaused(motionPreference.matches);
  motionPreference.addEventListener('change',e=>setTickerPaused(e.matches));
}
$('ticker-pause')?.addEventListener('click',()=>setTickerPaused(!track.classList.contains('ticker-paused')));

let focusedBeforeDialog=null;
function openDialog(id){const modal=$(id);if(!modal)return;focusedBeforeDialog=document.activeElement;modal.classList.add('open');modal.setAttribute('aria-hidden','false');document.body.classList.add('modal-open');modal.querySelector('button')?.focus();}
function closeDialog(id){const modal=$(id);modal?.classList.remove('open');modal?.setAttribute('aria-hidden','true');if(!document.querySelector('.location-modal.open'))document.body.classList.remove('modal-open');focusedBeforeDialog?.focus();}
for(const id of ['location-modal','engineering-modal'])$(id)?.addEventListener('click',e=>{if(e.target===$(id))closeDialog(id)});
document.addEventListener('keydown',e=>{
  const modal=document.querySelector('.location-modal.open');if(!modal)return;
  if(e.key==='Escape'){closeDialog(modal.id);return;}
  if(e.key!=='Tab')return;
  const list=[...modal.querySelectorAll('button,a[href],summary,[tabindex="0"]')].filter(el=>el.getClientRects().length);
  const first=list[0],last=list[list.length-1];
  if(e.shiftKey&&document.activeElement===first){last.focus();e.preventDefault();}
  else if(!e.shiftKey&&document.activeElement===last){first.focus();e.preventDefault();}
});
$('engineering-button')?.addEventListener('click',()=>openDialog('engineering-modal'));
$('engineering-close')?.addEventListener('click',()=>closeDialog('engineering-modal'));
$('location-button')?.addEventListener('click',()=>openDialog('location-modal'));
for(const id of ['location-close','location-deny'])$(id)?.addEventListener('click',()=>closeDialog('location-modal'));

// Editorial presentation only: source IDs, dates, units and numeric values stay untouched.
function xmEditorialText(value){
  const accents={perdidas:'pérdidas',energia:'energía',rio:'río',rios:'ríos',area:'área',subarea:'subárea',comercializacion:'comercialización',generacion:'generación',transmision:'transmisión',hidraulica:'hidráulica',termica:'térmica',eolica:'eólica',util:'útil',minimo:'mínimo',maximo:'máximo',tecnico:'técnico',historica:'histórica'};
  return String(value??'').normalize('NFC').replace(/\bRecursoComb\b/g,'recurso y combustible').replace(/\bMercadoComercializacion\b/g,'mercado de comercialización').replace(/\s+/g,' ').trim().replace(/\p{L}+/gu,word=>{
    const corrected=accents[word.toLocaleLowerCase('es-CO')];if(!corrected)return word;
    if(word===word.toLocaleUpperCase('es-CO'))return corrected.toLocaleUpperCase('es-CO');
    return word[0]===word[0].toLocaleUpperCase('es-CO')?corrected[0].toLocaleUpperCase('es-CO')+corrected.slice(1):corrected;
  });
}
function xmEntityLabel(entity){return {RecursoComb:'recurso y combustible',MercadoComercializacion:'mercado de comercialización',Subarea:'subárea',Area:'área',Rio:'río'}[entity]||xmEditorialText(entity);}
function dateLabel(date){return /^\d{4}-\d{2}-\d{2}/.test(date||'')?date.slice(0,10).split('-').reverse().join('/'): 'Fecha no disponible';}
function chip(parent,label,value,date=''){
  const span=document.createElement('span');span.className='ticker-item';
  span.append(document.createTextNode(label+' '));const bold=document.createElement('b');bold.textContent=value;span.append(bold);
  if(date){const small=document.createElement('small');small.textContent=' · '+date;span.append(small);}
  parent.append(span);
}
function tableRow(name,value,date){const tr=document.createElement('tr');for(const text of [name,value,date]){const td=document.createElement('td');td.textContent=text;tr.append(td)}$('engineering-rows')?.append(tr);}
// Related metrics can coincide; unrelated indicators remain distinct even at equal values.
function selectTickerIndicators(indicators){
  const families=[['DemaReal','DemaCome'],['Gene','GeneIdea'],['DemaRealReg','DemaComeReg'],['DemaRealNoReg','DemaComeNoReg']];
  const identical=(a,b)=>a.value===b.value&&a.unit===b.unit&&a.date===b.date&&a.period===b.period&&(a.entity||'Sistema')===(b.entity||'Sistema')&&(a.code||'Sistema')===(b.code||'Sistema');
  const seen=new Set();
  return indicators.filter(i=>{
    const key=JSON.stringify([i.id,i.code,i.entity,i.value,i.unit,i.date,i.period]);
    if(seen.has(key))return false;seen.add(key);
    const family=families.find(group=>group.includes(i.id));
    if(!family)return true;
    return !indicators.some(other=>family.includes(other.id)&&family.indexOf(other.id)<family.indexOf(i.id)&&identical(i,other));
  });
}
async function loadEngineeringData(){
  if(!$('xm-items'))return;
  try{
    const response=await fetch('data/engineering-data.json',{cache:'no-store',signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw new Error('snapshot');
    const data=await response.json(),xm=data.xm||{},oil=data.oil||{};
    for(const id of ['xm-items','oil-items','engineering-rows','engineering-catalog'])$(id)?.replaceChildren();
    const indicators=(xm.indicators||[]).filter(i=>Number.isFinite(i.value)&&i.unit&&i.date);
    const tickerIndicators=new Set(selectTickerIndicators(indicators));
    if(!indicators.length){chip($('xm-items'),'XM','No disponible');tableRow('XM','Sin datos publicados disponibles','—');}
    for(const i of indicators){
      const value=fmtNumber(i.value,2)+' '+i.unit;
      const label=xmEditorialText(i.name)+(i.code&&i.code!=='Sistema'?' · '+i.code:'');
      if(tickerIndicators.has(i))chip($('xm-items'),label,value,dateLabel(i.date)+(xm.available===false?' · último dato guardado':''));
      tableRow(label,value,dateLabel(i.date)+' · '+i.period+(xm.available===false?' · fuente no disponible; último guardado':''));
    }
    const matrix=xm.matrix||{};
    if(matrix.available && Array.isArray(matrix.shares)){
      for(const share of matrix.shares){
        if(!Number.isFinite(share.value))continue;
        const value=fmtNumber(share.value,2)+' %';
        chip($('xm-items'),'Generación '+share.name,value,dateLabel(matrix.date)+' · '+matrix.period);
        tableRow('Generación eléctrica SIN · '+share.name,value,dateLabel(matrix.date)+' · '+matrix.period);
      }
    }else{chip($('xm-items'),'Generación por fuente','No disponible');}
    const oils=(oil.indicators||[]).filter(i=>Number.isFinite(i.cop)&&i.cop>0&&i.date&&i.trmDate);
    if(!oils.length){chip($('oil-items'),'PETRÓLEO COP/barril','No disponible');}
    for(const i of oils){const value=fmtNumber(i.cop,0)+' COP/barril';chip($('oil-items'),i.name+' ref.',value,dateLabel(i.date)+(oil.available===false?' · último dato guardado':''));tableRow(i.name+' · precio de referencia',value,'Petróleo '+dateLabel(i.date)+' · TRM '+dateLabel(i.trmDate)+(oil.available===false?' · último dato guardado':''));}
    const unique=new Set();for(const m of xm.catalog||[]){const key=m.MetricId+'|'+m.Entity;if(unique.has(key))continue;unique.add(key);const li=document.createElement('li');li.textContent=xmEditorialText(m.MetricName)+' · '+xmEntityLabel(m.Entity)+' · '+m.MetricUnits;$('engineering-catalog')?.append(li);}
    if($('engineering-status'))$('engineering-status').textContent=indicators.length+' indicadores técnicos disponibles; '+tickerIndicators.size+' seleccionados para la tira. Las métricas relacionadas con valor y período idénticos se priorizan por utilidad técnica. Última consulta de las fuentes: '+(data.generatedAt?new Date(data.generatedAt).toLocaleString('es-CO',{timeZone:'America/Bogota'}):'No disponible')+'.'+(xm.available===false?' XM no respondió en la última actualización.':'')+(oil.available===false?' No se obtuvieron precios del petróleo o la TRM en la última actualización.':'');
    $('matrix-note')?.remove();const matrixNote=document.createElement('p');matrixNote.id='matrix-note';matrixNote.textContent=matrix.available?'Participación de generación por fuente: último período publicado, no medición instantánea. '+(matrix.coverageNote||''):'La fuente no devolvió participación por tecnología en esta consulta.';$('engineering-status')?.after(matrixNote);
    const previous=$('xm-unavailable');previous?.remove();
    if((xm.unavailable||[]).length){const note=document.createElement('p');note.id='xm-unavailable';note.textContent='Sin observaciones recientes: '+xm.unavailable.map(x=>xmEditorialText(x.name)).join(', ');$('engineering-status')?.after(note);}
    sizeTicker();
  }catch{
    $('xm-items').replaceChildren();$('oil-items').replaceChildren();$('engineering-rows')?.replaceChildren();$('engineering-catalog')?.replaceChildren();$('xm-unavailable')?.remove();$('matrix-note')?.remove();tableRow('Datos públicos','No disponibles','—');chip($('xm-items'),'XM','No disponible');chip($('oil-items'),'PETRÓLEO COP/barril','No disponible');if($('engineering-status'))$('engineering-status').textContent='No se pudo consultar el conjunto de datos. Reintente más tarde.';sizeTicker();
  }
}
loadEngineeringData();if($('xm-items'))setInterval(loadEngineeringData,15*60*1000);

let weatherRefreshTimer=null;
const weatherIds=['weather-temp','weather-humidity','weather-wind','weather-gust','weather-direction','weather-altitude','weather-pressure','weather-clouds','weather-rain','weather-date'];
function clearWeather(){weatherIds.forEach(id=>{if($(id))$(id).textContent='—'});}
function setWeatherText(text){if($('weather-summary'))$('weather-summary').textContent=text;sizeTicker();}
function findCurrentSeries(data){return [...(data?.properties?.timeseries||[])].sort((a,b)=>Math.abs(new Date(a.time)-Date.now())-Math.abs(new Date(b.time)-Date.now()))[0]||null;}
function weatherField(id,value,unit,digits=1){if($(id))$(id).textContent=Number.isFinite(value)?fmtNumber(value,digits)+' '+unit:'No disponible';}
async function updateLocalWeather(lat,lon){
  setWeatherText('Consultando pronóstico…');
  try{
    const latitude=Number(lat).toFixed(3),longitude=Number(lon).toFixed(3);
    const [geoResult,weatherResult]=await Promise.allSettled([
      fetch('https://api.bigdatacloud.net/data/reverse-geocode-client?'+new URLSearchParams({latitude,longitude,localityLanguage:'es'}),{signal:AbortSignal.timeout(15000)}).then(r=>{if(!r.ok)throw new Error('geo');return r.json()}),
      fetch('https://api.met.no/weatherapi/locationforecast/2.0/compact?'+new URLSearchParams({lat:latitude,lon:longitude}),{signal:AbortSignal.timeout(15000)}).then(r=>{if(!r.ok)throw new Error('weather');return r.json()})
    ]);
    if(weatherResult.status!=='fulfilled')throw new Error('weather');
    const weather=weatherResult.value,point=findCurrentSeries(weather);if(!point)throw new Error('no forecast');
    const geo=geoResult.status==='fulfilled'?geoResult.value:{},d=point.data?.instant?.details||{};
    setWeatherText((geo.city||geo.locality||geo.principalSubdivision||'Ubicación autorizada')+(geo.countryName?', '+geo.countryName:''));
    weatherField('weather-temp',d.air_temperature,'°C');weatherField('weather-humidity',d.relative_humidity,'%',0);
    weatherField('weather-wind',d.wind_speed,'m/s');weatherField('weather-gust',d.wind_speed_of_gust,'m/s');weatherField('weather-direction',d.wind_from_direction,'°',0);
    weatherField('weather-altitude',weather.geometry?.coordinates?.[2],'m s. n. m.',0);
    weatherField('weather-pressure',d.air_pressure_at_sea_level,'hPa',0);weatherField('weather-clouds',d.cloud_area_fraction,'%',0);
    weatherField('weather-rain',point.data?.next_1_hours?.details?.precipitation_amount,'mm');
    if($('weather-date'))$('weather-date').textContent=new Date(point.time).toLocaleString('es-CO',{timeZone:'America/Bogota',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
    clearTimeout(weatherRefreshTimer);weatherRefreshTimer=setTimeout(()=>updateLocalWeather(lat,lon),15*60*1000);sizeTicker();
  }catch{clearWeather();setWeatherText('Pronóstico no disponible');}
}
function requestLocation(){
  clearTimeout(weatherRefreshTimer);clearWeather();
  if(!navigator.geolocation){setWeatherText('Geolocalización no disponible');return;}
  setWeatherText('Solicitando ubicación…');
  navigator.geolocation.getCurrentPosition(p=>updateLocalWeather(p.coords.latitude,p.coords.longitude),()=>{clearWeather();setWeatherText('Ubicación no autorizada o no disponible')},{enableHighAccuracy:false,timeout:10000,maximumAge:10*60*1000});
}
$('location-allow')?.addEventListener('click',()=>{closeDialog('location-modal');requestLocation()});
// Remove coordinates retained by the previous implementation; this version keeps them only in memory.
try{localStorage.removeItem('powerai_weather_coords');localStorage.removeItem('powerai_weather_consent')}catch{}
if($('location-modal'))setTimeout(()=>{if(!document.querySelector('.location-modal.open'))openDialog('location-modal')},1800);
