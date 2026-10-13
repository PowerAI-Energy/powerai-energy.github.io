const $=id=>document.getElementById(id);
const fmtNumber=(value,digits=2)=>new Intl.NumberFormat('es-CO',{minimumFractionDigits:digits,maximumFractionDigits:digits}).format(value);
const menuToggle=document.querySelector('.menu-toggle'),navLinks=$('nav-links');
menuToggle?.addEventListener('click',()=>{const open=navLinks.classList.toggle('open');menuToggle.setAttribute('aria-expanded',String(open))});
navLinks?.querySelectorAll('a').forEach(link=>link.addEventListener('click',()=>{navLinks.classList.remove('open');menuToggle?.setAttribute('aria-expanded','false')}));
if($('year')) $('year').textContent=new Date().getFullYear();

const track=$('ticker-track'),viewport=document.querySelector('.ticker-viewport');
function sizeTicker(){
  if(!track||!viewport)return;
  const travel=Math.max(0,track.scrollWidth-viewport.clientWidth);
  track.style.setProperty('--ticker-travel',-travel+'px');
  track.style.animationDuration=Math.max(40,travel/32)+'s';
}
if(track&&viewport){new ResizeObserver(sizeTicker).observe(viewport);}
$('ticker-pause')?.addEventListener('click',()=>{
  const paused=track.classList.toggle('ticker-paused');
  $('ticker-pause').setAttribute('aria-pressed',String(paused));
  $('ticker-pause').setAttribute('aria-label',paused?'Reanudar desplazamiento':'Pausar desplazamiento');
  $('ticker-pause').textContent=paused?'▶':'Ⅱ';
});

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

function dateLabel(date){return /^\d{4}-\d{2}-\d{2}/.test(date||'')?date.slice(0,10).split('-').reverse().join('/'): 'Fecha no disponible';}
function chip(parent,label,value,date=''){
  const span=document.createElement('span');span.className='ticker-item';
  span.append(document.createTextNode(label+' '));const bold=document.createElement('b');bold.textContent=value;span.append(bold);
  if(date){const small=document.createElement('small');small.textContent=' · '+date;span.append(small);}
  parent.append(span);
}
function tableRow(name,value,date){const tr=document.createElement('tr');for(const text of [name,value,date]){const td=document.createElement('td');td.textContent=text;tr.append(td)}$('engineering-rows')?.append(tr);}
async function loadEngineeringData(){
  if(!$('xm-items'))return;
  try{
    const response=await fetch('data/engineering-data.json',{cache:'no-store',signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw new Error('snapshot');
    const data=await response.json(),xm=data.xm||{},oil=data.oil||{};
    for(const id of ['xm-items','oil-items','engineering-rows','engineering-catalog'])$(id)?.replaceChildren();
    const indicators=(xm.indicators||[]).filter(i=>Number.isFinite(i.value)&&i.unit&&i.date);
    if(!indicators.length){chip($('xm-items'),'XM','No disponible');tableRow('XM','Sin datos publicados disponibles','—');}
    for(const i of indicators){
      const value=fmtNumber(i.value,2)+' '+i.unit;
      const label=i.name+(i.code&&i.code!=='Sistema'?' · '+i.code:'');
      chip($('xm-items'),label,value,dateLabel(i.date)+(xm.available===false?' · último guardado':''));
      tableRow(label,value,dateLabel(i.date)+' · '+i.period+(xm.available===false?' · fuente no disponible; último guardado':''));
    }
    const oils=(oil.indicators||[]).filter(i=>Number.isFinite(i.cop)&&i.cop>0&&i.date&&i.trmDate);
    if(!oils.length){chip($('oil-items'),'PETRÓLEO COP/barril','No disponible');}
    for(const i of oils){const value=fmtNumber(i.cop,0)+' COP/barril';chip($('oil-items'),i.name+' ref.',value,dateLabel(i.date)+(oil.available===false?' · último guardado':''));tableRow(i.name+' spot · referencia convertida',value,'Petróleo '+dateLabel(i.date)+' · TRM '+dateLabel(i.trmDate)+(oil.available===false?' · último guardado':''));}
    const unique=new Set();for(const m of xm.catalog||[]){const key=m.MetricId+'|'+m.Entity;if(unique.has(key))continue;unique.add(key);const li=document.createElement('li');li.textContent=m.MetricName+' · '+m.Entity+' · '+m.MetricUnits;$('engineering-catalog')?.append(li);}
    if($('engineering-status'))$('engineering-status').textContent=indicators.length+' indicadores técnicos disponibles. Última consulta: '+(data.generatedAt?new Date(data.generatedAt).toLocaleString('es-CO',{timeZone:'America/Bogota'}):'No disponible')+'.'+(xm.available===false?' XM no respondió en la última actualización.':'')+(oil.available===false?' Petróleo/TRM no disponibles en la última actualización.':'');
    const previous=$('xm-unavailable');previous?.remove();
    if((xm.unavailable||[]).length){const note=document.createElement('p');note.id='xm-unavailable';note.textContent='Sin observaciones recientes: '+xm.unavailable.map(x=>x.name).join(', ');$('engineering-status')?.after(note);}
    sizeTicker();
  }catch{
    $('xm-items').replaceChildren();$('oil-items').replaceChildren();$('engineering-rows')?.replaceChildren();$('engineering-catalog')?.replaceChildren();$('xm-unavailable')?.remove();tableRow('Datos públicos','No disponibles','—');chip($('xm-items'),'XM','No disponible');chip($('oil-items'),'PETRÓLEO COP/barril','No disponible');if($('engineering-status'))$('engineering-status').textContent='No se pudo consultar el conjunto de datos. Reintente más tarde.';sizeTicker();
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
const CONTACT_FORM=$('contact-form');
CONTACT_FORM?.addEventListener('submit',()=>{const d=new FormData(CONTACT_FORM);try{sessionStorage.setItem('powerai_contact_pending',JSON.stringify({nombre:d.get('nombre')||'',empresa:d.get('empresa')||'',email:d.get('email')||'',tension:d.get('tension')||'',servicio:d.get('servicio')||'',mensaje:d.get('mensaje')||''}))}catch{}});
